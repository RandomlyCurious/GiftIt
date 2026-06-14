// Correctif ciblé après la passe LLM sur-réactive :
//  - aliments/boissons rangés à tort en 'autre'/'high_tech' -> 'gastronomie'
//  - gourdes/thermos/bouteilles isothermes rangés en 'high_tech' -> 'sport'
//   node scripts/fix-cat-correctif.mjs
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const E = {}; for (const l of fs.readFileSync(path.join(ROOT, ".env.local"), "utf-8").split(/\r?\n/)) { const t = l.trim(); if (t && !t.startsWith("#") && t.includes("=")) { const i = t.indexOf("="); E[t.slice(0, i)] = t.slice(i + 1); } }
const URL = E.NEXT_PUBLIC_SUPABASE_URL, SR = E.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SR, Authorization: `Bearer ${SR}` };

async function getAll() { const out = []; let o = 0; for (;;) { const r = await fetch(`${URL}/rest/v1/produits?select=id,nom,categorie&order=id&limit=1000&offset=${o}`, { headers: H }); const p = await r.json(); out.push(...p); if (p.length < 1000) break; o += 1000; } return out; }
async function patch(ids, cat) { for (let i = 0; i < ids.length; i += 100) { const lot = ids.slice(i, i + 100); const r = await fetch(`${URL}/rest/v1/produits?id=in.(${lot.join(",")})`, { method: "PATCH", headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ categorie: cat }) }); if (!r.ok) throw new Error(`PATCH ${r.status}: ${await r.text()}`); } }

const FOOD = /(vin|bière|biere|brassage|whisky|champagne|spiritueux|cocktail|apéritif|aperitif|apéro|apero|chocolat|fromage|confiture|miel|tisane|infusion|épice|epice|café|cafe|expresso|dégustation|degustation|gourmand|gastronom|charcuter|pâtisser|patisser|biscuit|thés|thé |bonbon|caramel|huile d'olive|vinaigre|coffret.*saveur|coffret.*gourm)/i;
const HYDRO = /(gourde|thermos|bouteille isotherme)/i;

const rows = await getAll();
const versGastro = [], versSport = [];
for (const p of rows) {
  if (["autre", "high_tech"].includes(p.categorie) && FOOD.test(p.nom)) versGastro.push(p);
  else if (p.categorie === "high_tech" && HYDRO.test(p.nom)) versSport.push(p);
}
if (versGastro.length) await patch(versGastro.map(p => p.id), "gastronomie");
if (versSport.length) await patch(versSport.map(p => p.id), "sport");
console.log(`-> gastronomie : ${versGastro.length}`); versGastro.forEach(p => console.log(`   "${p.nom}" (était ${p.categorie})`));
console.log(`-> sport : ${versSport.length}`); versSport.forEach(p => console.log(`   "${p.nom}" (était ${p.categorie})`));
