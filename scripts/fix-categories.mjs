// Passe de cohérence catégorie sur tout le catalogue. Revue LLM par lots ;
// ne corrige QUE les erreurs flagrantes (ex: écharpe en 'sport', herbes en 'maison').
//
//   node scripts/fix-categories.mjs --dry-run   (montre les corrections sans appliquer)
//   node scripts/fix-categories.mjs             (applique)

import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const E = {}; for (const l of fs.readFileSync(path.join(ROOT, ".env.local"), "utf-8").split(/\r?\n/)) { const t = l.trim(); if (t && !t.startsWith("#") && t.includes("=")) { const i = t.indexOf("="); E[t.slice(0, i)] = t.slice(i + 1); } }
const URL = E.NEXT_PUBLIC_SUPABASE_URL, SR = E.SUPABASE_SERVICE_ROLE_KEY, OPENAI_KEY = E.OPENAI_API_KEY;
const H = { apikey: SR, Authorization: `Bearer ${SR}` };
const DRY = process.argv.includes("--dry-run");

const CATS = ["gastronomie", "culture", "loisirs", "sport", "bien_etre", "maison", "high_tech", "mode", "experiences", "autre"];
const DEF = `gastronomie=nourriture/boissons/cuisine/épicerie/vin/bière ; culture=livres/musique/films/jeux de société/art/spectacles ; loisirs=activités créatives/DIY/jardinage/collection ; sport=équipement sportif/fitness/outdoor/rando ; bien_etre=détente/spa/méditation/cosmétique/soins ; maison=déco/mobilier/linge/ustensiles ; high_tech=électronique/gadgets/informatique/audio ; mode=vêtements/accessoires/bijoux/montres ; experiences=activité à VIVRE (cours, atelier, baptême, séjour, sortie) ; autre=aucune.`;

async function getAll() {
  const out = []; let offset = 0;
  for (;;) {
    const r = await fetch(`${URL}/rest/v1/produits?select=id,nom,categorie&order=id&limit=1000&offset=${offset}`, { headers: H });
    const page = await r.json(); out.push(...page);
    if (page.length < 1000) break; offset += 1000;
  }
  return out;
}
async function chat(messages) { const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.1, response_format: { type: "json_object" }, messages }) }); if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`); return r.json(); }
async function patch(ids, cat) { for (let i = 0; i < ids.length; i += 100) { const lot = ids.slice(i, i + 100); const r = await fetch(`${URL}/rest/v1/produits?id=in.(${lot.join(",")})`, { method: "PATCH", headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ categorie: cat }) }); if (!r.ok) throw new Error(`PATCH ${r.status}: ${await r.text()}`); } }

const rows = await getAll();
console.log(`${rows.length} produits à revoir.`);
const corrections = []; // {id, nom, ancienne, nouvelle}
const TAILLE = 40;
for (let i = 0; i < rows.length; i += TAILLE) {
  const lot = rows.slice(i, i + TAILLE);
  const liste = lot.map((p, j) => `${j + 1}. ${p.nom} [${p.categorie}]`).join("\n");
  const sys = `Tu vérifies le rangement de produits cadeaux. Catégories valides : ${CATS.join(", ")}.\nDéfinitions : ${DEF}\nPour CHAQUE produit dont la catégorie actuelle est FLAGRANTEMENT incorrecte, donne la bonne. NE corrige PAS les cas ambigus légitimes (un atelier créatif peut être 'loisirs' ou 'experiences' : laisse). Réponds JSON {"corrections":[{"i":<numéro>,"categorie":"<valide>"}]} (vide si tout est correct).`;
  const data = await chat([{ role: "system", content: sys }, { role: "user", content: liste }]);
  const cor = JSON.parse(data.choices[0].message.content).corrections || [];
  for (const c of cor) {
    const p = lot[c.i - 1];
    if (p && CATS.includes(c.categorie) && c.categorie !== p.categorie) corrections.push({ id: p.id, nom: p.nom, ancienne: p.categorie, nouvelle: c.categorie });
  }
  process.stdout.write(`\r  revu ${Math.min(i + TAILLE, rows.length)}/${rows.length} — ${corrections.length} corrections`);
}
console.log("");

// Application groupée par nouvelle catégorie.
const parCat = {};
for (const c of corrections) (parCat[c.nouvelle] ||= []).push(c.id);
if (!DRY) { for (const [cat, ids] of Object.entries(parCat)) await patch(ids, cat); }

console.log(`\n${corrections.length} corrections${DRY ? " (DRY-RUN, non appliquées)" : " appliquées"} :`);
const recap = {};
for (const c of corrections) { const k = `${c.ancienne} -> ${c.nouvelle}`; recap[k] = (recap[k] || 0) + 1; }
for (const [k, n] of Object.entries(recap).sort((a, b) => b[1] - a[1])) console.log(`  ${k} : ${n}`);
console.log("\nExemples :");
for (const c of corrections.slice(0, 25)) console.log(`  "${c.nom}" : ${c.ancienne} -> ${c.nouvelle}`);
