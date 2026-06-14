// Génération de CONCEPTS de cadeaux pour le dev/test du matching (source='genere_test').
// Pipeline T1 : description_matching destinataire (variée), score_originalite 1-5 ANCRÉ,
// tags fermés (spécifiques, pas 'autre'), embedding text-embedding-3-small.
// AUCUNE URL marchande (url_produit = lien de recherche), AUCUN prix de vrai produit.
//
// Anti-doublon : avant d'accepter un concept, on vérifie qu'il n'est pas trop proche
//   (nom OU embedding cosinus > SEUIL_DUP) d'un produit existant ou déjà accepté ce run.
//
//   node scripts/generate-catalogue.mjs --plan "gastronomie:5,sport:5,culture:5" --dry-run --shuffle
//   node scripts/generate-catalogue.mjs --plan "sport:120"     (insère)

import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const E = {}; for (const l of fs.readFileSync(path.join(ROOT, ".env.local"), "utf-8").split(/\r?\n/)) { const t = l.trim(); if (t && !t.startsWith("#") && t.includes("=")) { const i = t.indexOf("="); E[t.slice(0, i)] = t.slice(i + 1); } }
const URL = E.NEXT_PUBLIC_SUPABASE_URL, SR = E.SUPABASE_SERVICE_ROLE_KEY, OPENAI_KEY = E.OPENAI_API_KEY;
if (!URL || !SR || !OPENAI_KEY) { console.error("Manque clés dans .env.local"); process.exit(1); }

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const SHUFFLE = args.includes("--shuffle");
const planArg = args[args.indexOf("--plan") + 1] || "";
const PLAN = planArg.split(",").map((p) => { const [cat, n] = p.split(":"); return { cat: cat.trim(), n: parseInt(n, 10) }; }).filter((p) => p.cat && p.n);
if (!PLAN.length) { console.error('Donne --plan "categorie:n,..."'); process.exit(1); }

const LABELS = { gastronomie: "Gastronomie & boissons", loisirs: "Loisirs créatifs & DIY", sport: "Sport & plein air", bien_etre: "Bien-être & détente", culture: "Culture (livres, musique, jeux)", maison: "Maison & déco", high_tech: "High-tech & gadgets", mode: "Mode & accessoires", experiences: "Expériences & activités" };
const MODELE_LLM = "gpt-4o-mini", MODELE_EMBED = "text-embedding-3-small";
const SEUIL_DUP = 0.92;       // cosinus au-delà duquel deux concepts sont des quasi-doublons
const SEUIL_NOM = 0.6;        // chevauchement de tokens de nom au-delà duquel = doublon

async function sbGet(q) { const r = await fetch(`${URL}/rest/v1/${q}`, { headers: { apikey: SR, Authorization: `Bearer ${SR}` } }); if (!r.ok) throw new Error(`GET ${r.status}: ${await r.text()}`); return r.json(); }
async function sbPost(table, rows) { const r = await fetch(`${URL}/rest/v1/${table}`, { method: "POST", headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(rows) }); if (!r.ok) throw new Error(`POST ${table} ${r.status}: ${await r.text()}`); return r.json(); }
async function chat(messages) { const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODELE_LLM, temperature: 0.95, response_format: { type: "json_object" }, messages }) }); if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`); return r.json(); }
async function embed(input) { const r = await fetch("https://api.openai.com/v1/embeddings", { method: "POST", headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODELE_EMBED, input }) }); if (!r.ok) throw new Error(`Embed ${r.status}: ${await r.text()}`); return (await r.json()).data[0].embedding; }

// --- utils dédup ---
function normVec(v) { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return v.map((x) => x / s); }
function cos(a, b) { let d = 0; for (let i = 0; i < a.length; i++) d += a[i] * b[i]; return d; } // a,b normalisés
const STOP = new Set(["de", "d", "du", "des", "le", "la", "les", "un", "une", "en", "a", "à", "pour", "et", "ou", "the", "of", "soi", "meme"]);
function tokens(nom) { return new Set((nom || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t))); }
function jaccard(a, b) { let inter = 0; for (const t of a) if (b.has(t)) inter++; const uni = a.size + b.size - inter; return uni ? inter / uni : 0; }

// Références existantes (produits déjà en base) : embeddings + tokens de nom.
const existants = await sbGet("produits?select=nom,embedding");
const refsVec = []; const refsNom = [];
for (const p of existants) {
  if (p.embedding) refsVec.push(normVec(typeof p.embedding === "string" ? JSON.parse(p.embedding) : p.embedding));
  refsNom.push(tokens(p.nom));
}
console.log(`Références existantes chargées : ${refsVec.length} embeddings, ${refsNom.length} noms.\n`);

const SLUGS = (await sbGet("tags?select=slug")).map((t) => t.slug);

const ANCRES = `Échelle d'originalité ANCRÉE (références STABLES — ne dévie jamais d'un lot à l'autre) :
- 1 (très commun) : bougie parfumée, boîte de chocolats, mug, coffret de thé classique, porte-clés.
- 2 (commun) : carnet, gourde isotherme, écharpe, coffret de bières, plante en pot.
- 3 (original accessible) : box mensuelle spécialisée, atelier ou visite découverte (poterie, brasserie, parfumerie), cours d'initiation.
- 4 (original) : expérience guidée marquante (cours de cuisine du monde, baptême de plongée), objet de niche pointu.
- 5 (très original, rare) : baptême en planeur/montgolfière, cours de forge, nuit insolite (cabane perchée, igloo).
RÈGLE : un concept SIMILAIRE à un autre reçoit le MÊME score. Visite/atelier découverte = 3. Consommable courant = 1-2. Expérience rare et mémorable = 5.
NE mets JAMAIS 5 à un produit grand public ni à une activité accessible : robot aspirateur, écouteurs, enceinte, massage classique, séance de spa, initiation yoga/kayak/plongée, cours de cuisine, mini-projecteur = 2 à 4 selon le cas, PAS 5. Le 5 est réservé à l'INSOLITE et RARE (montgolfière, planeur, forge, nuit en cabane perchée, vol en hélico). Dans un lot, 5 doit rester minoritaire.`;

function systeme(label, n) {
  return `Tu génères ${n} CONCEPTS de cadeaux pour la catégorie « ${label} ». Idées génériques, PAS de marque, PAS de référence produit réelle.
Chaque concept (varie-les fortement entre eux, évite les redites) :
- "nom" : un cadeau CONCRET et IDENTIFIABLE qu'on pourrait trouver chez un marchand (ex : "Roman d'aventure best-seller", "Box mensuelle de thés et biscuits artisanaux", "Casque audio à réduction de bruit", "Cours de poterie en duo"). JAMAIS un concept abstrait ou vague (INTERDIT : "Souvenir musical", "Box douceur", "Lumière apaisante", "Cahier d'exercices") — nomme précisément l'objet ou l'activité. DISTINCT des autres.
- "prix_min","prix_max" : fourchette plausible € (entiers, min<max). IMPÉRATIF de gamme : vise ~30% de PETITS cadeaux à prix_max ≤ 20€ (consommables, accessoires, livres, petits objets), ~40% entre 20-50€, ~20% entre 50-150€, ~10% > 150€ uniquement si la catégorie s'y prête (expériences, high-tech premium). Ne concentre PAS tout sur 40-150€.
- "score_originalite" : entier 1-5 selon l'échelle ancrée ci-dessous.
- "age_min","age_max" : entiers 0-99 délimitant l'âge du destinataire (ex enfant 3/12, ado 12/17, jeune adulte 18/30, adulte 18/99, tous publics 0/99). min ≤ max.
- "occasions" (tableau court).
- "tags" : 1 à 4 slugs SPÉCIFIQUES de cette liste fermée : ${SLUGS.join(", ")}. Chaque tag doit décrire un ATTRIBUT RÉEL du produit ou de son destinataire — aucun tag hors-sujet (ex : ne tague pas 'jardinage' une assiette de randonnée). ÉVITE 'autre' ; si aucun tag pertinent, mets []. N'invente aucun slug.
- "description_matching" : phrases sur LE DESTINATAIRE IDÉAL (personnalité, goûts, moments de vie), JAMAIS le produit. VARIE la LONGUEUR (certaines en 2 phrases, d'autres en 3-4 plus riches et incarnées) ET la structure. Ne commence JAMAIS par "Idéal pour"/"Parfait pour"/"Ce cadeau". Évite les formules récurrentes type "amateur de X qui aime expérimenter" : chaque description doit être singulière, concrète, ancrée dans des situations de vie précises.

${ANCRES}

Réponds en JSON sous la clé "concepts" : un tableau de ${n} objets {nom, prix_min, prix_max, score_originalite, age_min, age_max, occasions, tags, description_matching}.`;
}

function bucketPrix(c) { const p = (Number(c.prix_min) + Number(c.prix_max)) / 2; return p < 20 ? "<20" : p <= 50 ? "20-50" : p <= 150 ? "50-150" : ">150"; }
function recap(tag) {
  const pc = {}, pp = { "<20": 0, "20-50": 0, "50-150": 0, ">150": 0 }, po = {};
  for (const x of acceptes) { pc[x.cat] = (pc[x.cat] || 0) + 1; pp[bucketPrix(x)]++; po[x.score_originalite] = (po[x.score_originalite] || 0) + 1; }
  const tot = acceptes.length + rejNom + rejVec;
  const taux = tot ? ((rejNom + rejVec) / tot) * 100 : 0;
  console.log(`\n=== RECAP ${tag} (${acceptes.length}) === cat ${JSON.stringify(pc)} | prix ${JSON.stringify(pp)} | orig ${JSON.stringify(po)} | rejets ${rejNom + rejVec} = ${taux.toFixed(1)}%${taux > 15 ? " ⚠️ >15% (saturation ?)" : ""} | ~$${((totalTokens / 1e6) * 0.3).toFixed(3)}`);
}

let totalTokens = 0, insered = 0, rejNom = 0, rejVec = 0;
const acceptes = [];

for (const { cat, n } of PLAN) {
  const label = LABELS[cat] || cat;
  let okCat = 0, tentatives = 0;
  const maxTentatives = Math.ceil(n / 25) * 3 + 2;
  while (okCat < n && tentatives < maxTentatives) {
    tentatives++;
    const taille = Math.min(25, (n - okCat) + 5); // sur-génère un peu pour absorber les rejets
    const data = await chat([{ role: "system", content: systeme(label, taille) }, { role: "user", content: `Génère ${taille} concepts variés pour « ${label} ».` }]);
    totalTokens += data.usage?.total_tokens ?? 0;
    const obj = JSON.parse(data.choices[0].message.content);
    const concepts = obj.concepts || Object.values(obj).find(Array.isArray) || [];

    for (const c of concepts) {
      if (okCat >= n) break;
      if (!c.nom || !c.description_matching) continue;
      const tk = tokens(c.nom);
      if (refsNom.some((r) => jaccard(tk, r) >= SEUIL_NOM)) { rejNom++; continue; }   // doublon de nom
      const vec = normVec(await embed(c.description_matching));
      if (refsVec.some((r) => cos(vec, r) > SEUIL_DUP)) { rejVec++; continue; }        // doublon d'embedding
      // accepté
      refsNom.push(tk); refsVec.push(vec);
      const tagsValides = (c.tags || []).filter((t) => SLUGS.includes(t) && t !== "autre");
      const ageMin = Number.isInteger(c.age_min) ? Math.max(0, Math.min(99, c.age_min)) : 0;
      const ageMax = Number.isInteger(c.age_max) ? Math.max(ageMin, Math.min(99, c.age_max)) : 99;
      const rec = { cat, nom: c.nom, prix_min: c.prix_min, prix_max: c.prix_max, score_originalite: c.score_originalite, age_min: ageMin, age_max: ageMax, occasions: c.occasions ?? [], tags: tagsValides, description_matching: c.description_matching, vec };
      if (!DRY) {
        const [prod] = await sbPost("produits", [{ nom: rec.nom, categorie: cat, description: null, prix_min: rec.prix_min, prix_max: rec.prix_max, url_produit: `https://www.google.com/search?q=${encodeURIComponent(rec.nom + " cadeau")}`, url_image: null, affilie: false, actif: true, nb_tags: tagsValides.length, description_matching: rec.description_matching, embedding: `[${vec.join(",")}]`, score_originalite: rec.score_originalite, age_min: rec.age_min, age_max: rec.age_max, occasions: rec.occasions, source: "genere_test" }]);
        if (tagsValides.length) await sbPost("produit_tags", tagsValides.map((tag_slug) => ({ produit_id: prod.id, tag_slug })));
        insered++; process.stdout.write(`\r  inséré ${insered}`);
        if (insered % 200 === 0) recap("@" + insered);
      }
      acceptes.push(rec); okCat++;
    }
  }
  if (okCat < n) console.error(`\n  ⚠️ ${label}: seulement ${okCat}/${n} (dédup agressive ou catégorie étroite)`);
}

const liste = SHUFFLE ? acceptes.map((c) => [Math.sin(c.nom.length * 9301 + c.prix_min) , c]).sort((a, b) => a[0] - b[0]).map((x) => x[1]) : acceptes;
if (DRY) {
  liste.forEach((c, i) => {
    console.log(`\n[${i + 1}] ${c.nom}  — ${c.cat} — ${c.prix_min}-${c.prix_max}€ — orig ${c.score_originalite} — tags: ${c.tags.join(", ") || "(aucun)"}`);
    console.log(`    → ${c.description_matching}`);
  });
}
const parCat = {}, parPrix = { "<20": 0, "20-50": 0, "50-150": 0, ">150": 0 }, parOrig = {};
for (const c of acceptes) { parCat[c.cat] = (parCat[c.cat] || 0) + 1; parPrix[bucketPrix(c)]++; parOrig[c.score_originalite] = (parOrig[c.score_originalite] || 0) + 1; }
console.log(`\n\n=== ${DRY ? "APERÇU (DRY-RUN, aucune insertion)" : "INSERTION"} : ${acceptes.length} concepts ===`);
console.log("Par catégorie :", parCat);
console.log("Par prix (médian) :", parPrix);
console.log("Par originalité :", parOrig);
console.log(`Rejets dédup : ${rejNom} (nom) + ${rejVec} (embedding)`);
console.log(`Coût LLM estimé ~$${((totalTokens / 1e6) * 0.3).toFixed(4)} (+ embeddings négligeable)`);
