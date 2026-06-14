// ELT d'enrichissement du catalogue — Tranche 1 du matching v2.
// Pour chaque produit SANS embedding, génère :
//   - description_matching : description-pivot orientée DESTINATAIRE idéal (v2 §10)
//   - score_originalite (1-5), tranche_age, occasions
//   - embedding (text-embedding-3-small) de description_matching
// Idempotent (ne traite que embedding IS NULL), reprenable.
//
// Diversité de formulation : on EMBEDDE ces descriptions, donc une structure
// répétitive créerait une similarité vectorielle parasite. On force la variété
// via (1) une consigne anti-gabarit et (2) un "angle d'attaque" rotatif par produit.
//
// Usage :
//   node scripts/enrich-catalogue.mjs --limit 5 --dry-run      → aperçu, aucune écriture
//   node scripts/enrich-catalogue.mjs --ids id1,id2 --dry-run  → aperçu d'ids précis
//   node scripts/enrich-catalogue.mjs                          → écrit tous les restants
//
// Secrets lus depuis .env.local (jamais en dur).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf-8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    env[t.slice(0, i)] = t.slice(i + 1);
  }
  return env;
}

const E = loadEnv();
const SUPABASE_URL = E.NEXT_PUBLIC_SUPABASE_URL;
const SR = E.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = E.OPENAI_API_KEY;
if (!SUPABASE_URL || !SR) {
  console.error("Manque NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY dans .env.local");
  process.exit(1);
}
if (!OPENAI_KEY) {
  console.error("Manque OPENAI_API_KEY dans .env.local");
  process.exit(1);
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const li = args.indexOf("--limit");
const LIMIT = li >= 0 ? parseInt(args[li + 1], 10) : null;
const ii = args.indexOf("--ids");
const IDS = ii >= 0 ? args[ii + 1].split(",") : null;

const MODELE_LLM = "gpt-4o-mini";
const MODELE_EMBED = "text-embedding-3-small";

// Angles d'attaque rotatifs : chaque produit en reçoit un différent, ce qui
// diversifie la STRUCTURE des descriptions (et donc les embeddings).
const ANGLES = [
  "Ouvre sur une SCÈNE concrète, un moment de vie où cette personne s'épanouit.",
  "Ouvre sur un TRAIT DE CARACTÈRE dominant, puis déploie ses goûts.",
  "Ouvre sur ce que cette personne VALORISE ou recherche profondément.",
  "Construis autour d'un CONTRASTE : ce qu'elle adore vs ce qui ne lui parle pas.",
  "Ancre la description sur un RITUEL ou une habitude qui la caractérise.",
  "Pars d'une ENVIE ou d'un manque que ce cadeau viendrait combler.",
];

const SYSTEM = `Tu es un expert en idées cadeaux. Pour un produit, tu produis une "description_matching" : 2 à 4 phrases décrivant LE DESTINATAIRE IDÉAL de ce cadeau — sa personnalité, ses goûts, ses moments de vie — et JAMAIS le produit lui-même.
On NE décrit PAS l'objet : pour un coffret de thé, on parle d'une personne qui aime les rituels calmes et la lenteur, pas du "coffret de 6 thés".

RÈGLES DE FORMULATION (cruciales — ces textes seront vectorisés) :
- NE commence JAMAIS par "Idéal pour", "Parfait pour", "Ce cadeau est pour" ni aucune formule passe-partout.
- Varie radicalement l'accroche, l'angle et la structure des phrases d'un produit à l'autre. Deux descriptions ne doivent pas se ressembler structurellement.
- Suis l'ANGLE D'ATTAQUE imposé dans le message utilisateur.
- Style naturel, incarné, spécifique. Évite les listes de goûts génériques.

Tu fournis aussi :
- score_originalite (entier 1-5) : 1=très commun (bougie, coffret chocolat), 3=original accessible (box spécialisée), 5=très original (cours de forge, baptême en planeur).
- age_min, age_max : entiers 0-99 délimitant l'âge du destinataire (enfant 3/12, ado 12/17, jeune adulte 18/30, adulte 18/99, tous 0/99). min ≤ max.
- occasions : tableau court de mots-clés (ex ["anniversaire","noel"]) ou [].
Réponds UNIQUEMENT en JSON : {"description_matching": string, "score_originalite": number, "age_min": number, "age_max": number, "occasions": string[]}.`;

async function sbGet(query) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: { apikey: SR, Authorization: `Bearer ${SR}` },
  });
  if (!r.ok) throw new Error(`Supabase GET ${r.status}: ${await r.text()}`);
  return r.json();
}

async function sbPatch(id, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/produits?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SR, Authorization: `Bearer ${SR}`,
      "Content-Type": "application/json", Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Supabase PATCH ${r.status}: ${await r.text()}`);
}

async function enrichir(p, angle) {
  const contexte = `Produit : ${p.nom}
Catégorie : ${p.categorie}
Description : ${p.description ?? "(aucune)"}
Prix : ${p.prix_min}–${p.prix_max} €
Tags : ${(p.produit_tags ?? []).map((t) => t.tag_slug).join(", ") || "(aucun)"}

ANGLE D'ATTAQUE IMPOSÉ pour cette description : ${angle}`;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELE_LLM,
      temperature: 0.85,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: contexte },
      ],
    }),
  });
  if (!r.ok) throw new Error(`OpenAI chat ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return { obj: JSON.parse(data.choices[0].message.content), usage: data.usage };
}

async function embedder(texte) {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODELE_EMBED, input: texte }),
  });
  if (!r.ok) throw new Error(`OpenAI embed ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return { vecteur: data.data[0].embedding, usage: data.usage };
}

let sel;
if (IDS) {
  sel = `produits?id=in.(${IDS.join(",")})&select=id,nom,categorie,description,prix_min,prix_max,produit_tags(tag_slug)&order=categorie`;
} else {
  sel = "produits?embedding=is.null&select=id,nom,categorie,description,prix_min,prix_max,produit_tags(tag_slug)&order=id" +
    (LIMIT ? `&limit=${LIMIT}` : "");
}
const produits = await sbGet(sel);

console.log(`${produits.length} produit(s) à enrichir${DRY_RUN ? "  [DRY-RUN — aucune écriture]" : ""}.\n`);
let ok = 0, tLLM = 0, tEmbed = 0;

for (const [i, p] of produits.entries()) {
  const angle = ANGLES[i % ANGLES.length];
  try {
    const { obj, usage } = await enrichir(p, angle);
    tLLM += usage?.total_tokens ?? 0;
    const { vecteur, usage: uE } = await embedder(obj.description_matching);
    tEmbed += uE?.total_tokens ?? 0;

    if (DRY_RUN) {
      console.log(`[${i + 1}/${produits.length}] ${p.nom}  (${p.categorie}, ${p.prix_min}-${p.prix_max}€)`);
      console.log(`  angle: ${angle}`);
      console.log(`  → ${obj.description_matching}`);
      console.log(`  → orig: ${obj.score_originalite} | age: ${obj.age_min}-${obj.age_max} | occasions: ${JSON.stringify(obj.occasions)} | embedding: vector(${vecteur.length})\n`);
    } else {
      const ageMin = Number.isInteger(obj.age_min) ? Math.max(0, Math.min(99, obj.age_min)) : 0;
      const ageMax = Number.isInteger(obj.age_max) ? Math.max(ageMin, Math.min(99, obj.age_max)) : 99;
      await sbPatch(p.id, {
        description_matching: obj.description_matching,
        score_originalite: obj.score_originalite,
        age_min: ageMin,
        age_max: ageMax,
        occasions: obj.occasions,
        embedding: `[${vecteur.join(",")}]`,
      });
      process.stdout.write(`\r  écrit ${i + 1}/${produits.length}`);
    }
    ok++;
  } catch (e) {
    console.error(`\n  ERREUR sur ${p.nom} (${p.id}) : ${e.message}`);
  }
}

const cout = (tLLM / 1e6) * 0.3 + (tEmbed / 1e6) * 0.02;
console.log(`\n\nTerminé : ${ok}/${produits.length} ok.`);
console.log(`Tokens LLM ~${tLLM}, embeddings ~${tEmbed}  →  coût estimé ~$${cout.toFixed(4)}`);
