// Normalise produits.tranche_age (texte hétérogène) vers age_min/age_max numériques.
// Gère : labels (adulte, jeune adulte, ado, enfant, senior, tous), plages "20-50",
// "15+", nombres seuls, et arrays JSON ["18-40"], ["18-25","25-35"].
// tranche_age est conservé tel quel. PATCH groupés par (min,max).
//
//   node scripts/normalize-age.mjs

import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const E = {}; for (const l of fs.readFileSync(path.join(ROOT, ".env.local"), "utf-8").split(/\r?\n/)) { const t = l.trim(); if (t && !t.startsWith("#") && t.includes("=")) { const i = t.indexOf("="); E[t.slice(0, i)] = t.slice(i + 1); } }
const URL = E.NEXT_PUBLIC_SUPABASE_URL, SR = E.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SR, Authorization: `Bearer ${SR}` };

async function getAll() {
  const out = []; let offset = 0;
  for (;;) {
    const r = await fetch(`${URL}/rest/v1/produits?select=id,tranche_age&order=id&limit=1000&offset=${offset}`, { headers: H });
    if (!r.ok) throw new Error(`GET ${r.status}: ${await r.text()}`);
    const page = await r.json(); out.push(...page);
    if (page.length < 1000) break; offset += 1000;
  }
  return out;
}
async function patch(ids, body) {
  for (let i = 0; i < ids.length; i += 100) {
    const lot = ids.slice(i, i + 100);
    const r = await fetch(`${URL}/rest/v1/produits?id=in.(${lot.join(",")})`, { method: "PATCH", headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`PATCH ${r.status}: ${await r.text()}`);
  }
}

function mapLabel(s) {
  if (/enfant|kid|petit/.test(s)) return [3, 12];
  if (/ado|adolescent/.test(s)) return [12, 17];
  if (/jeune adulte|young/.test(s)) return [18, 30];
  if (/senior|retrait/.test(s)) return [60, 99];
  if (/adulte|adult/.test(s)) return [18, 99];
  if (/tous|tout|family|famille|universel/.test(s)) return [0, 99];
  return null;
}
function parseAge(raw) {
  if (!raw) return [0, 99];
  let r = String(raw).trim(), parts;
  if (r.startsWith("[")) { try { parts = JSON.parse(r); } catch { parts = [r]; } } else parts = [r];
  const mins = [], maxs = [];
  for (let p of parts) {
    p = String(p).toLowerCase().trim(); let m;
    if ((m = p.match(/^(\d+)\s*[-–à]\s*(\d+)/))) { mins.push(+m[1]); maxs.push(+m[2]); continue; }
    if ((m = p.match(/^(\d+)\s*\+/))) { mins.push(+m[1]); maxs.push(99); continue; }
    if ((m = p.match(/^(\d+)$/))) { mins.push(+m[1]); maxs.push(99); continue; }
    const lab = mapLabel(p);
    if (lab) { mins.push(lab[0]); maxs.push(lab[1]); continue; }
    mins.push(0); maxs.push(99); // inconnu -> tous
  }
  if (!mins.length) return [0, 99];
  let a = Math.max(0, Math.min(...mins)), b = Math.min(99, Math.max(...maxs));
  if (b < a) [a, b] = [0, 99];
  return [a, b];
}

const rows = await getAll();
console.log(`${rows.length} produits chargés.`);
const groupes = {};
for (const p of rows) { const [a, b] = parseAge(p.tranche_age); (groupes[`${a}|${b}`] ||= []).push(p.id); }
for (const [cle, ids] of Object.entries(groupes)) {
  const [a, b] = cle.split("|").map(Number);
  await patch(ids, { age_min: a, age_max: b });
  process.stdout.write(`\r  ${cle}: ${ids.length}   `);
}
console.log("\n\nRépartition age_min-age_max :");
for (const [cle, ids] of Object.entries(groupes).sort((x, y) => y[1].length - x[1].length)) console.log(`  ${cle.replace("|", "-")} : ${ids.length}`);
