// Pont Tranche 2 : calcule proches.embedding à partir des TAGS du proche.
// On formule le proche comme une PERSONNE ("une personne qui aime…") pour le
// placer dans le même espace sémantique que les description_matching des produits
// (qui décrivent le destinataire idéal). C'est provisoire : en Tranche 3,
// l'embedding viendra de la description libre.
// Idempotent (embedding IS NULL). Secrets lus depuis .env.local.
//
//   node scripts/embed-proches.mjs            → tous les proches sans embedding
//   node scripts/embed-proches.mjs --dry-run  → aperçu sans écriture

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const E = {};
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf-8").split(/\r?\n/)) {
  const t = line.trim();
  if (t && !t.startsWith("#") && t.includes("=")) {
    const i = t.indexOf("=");
    E[t.slice(0, i)] = t.slice(i + 1);
  }
}
const URL = E.NEXT_PUBLIC_SUPABASE_URL;
const SR = E.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = E.OPENAI_API_KEY;
if (!URL || !SR || !OPENAI_KEY) {
  console.error("Manque NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / OPENAI_API_KEY dans .env.local");
  process.exit(1);
}
const DRY_RUN = process.argv.includes("--dry-run");

async function sbGet(q) {
  const r = await fetch(`${URL}/rest/v1/${q}`, { headers: { apikey: SR, Authorization: `Bearer ${SR}` } });
  if (!r.ok) throw new Error(`GET ${r.status}: ${await r.text()}`);
  return r.json();
}
async function sbPatch(id, body) {
  const r = await fetch(`${URL}/rest/v1/proches?id=eq.${id}`, {
    method: "PATCH",
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH ${r.status}: ${await r.text()}`);
}
async function embed(texte) {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texte }),
  });
  if (!r.ok) throw new Error(`OpenAI embed ${r.status}: ${await r.text()}`);
  return (await r.json()).data[0].embedding;
}

const proches = await sbGet(
  "proches?embedding=is.null&select=id,prenom,relation,proche_tags(tag_slug,tags(libelle))",
);
console.log(`${proches.length} proche(s) à embedder${DRY_RUN ? "  [DRY-RUN]" : ""}.\n`);
let ok = 0;
for (const p of proches) {
  const tags = (p.proche_tags ?? []).map((pt) => pt.tags?.libelle ?? pt.tag_slug);
  const texte = tags.length
    ? `Une personne qui aime : ${tags.join(", ")}.`
    : `Une personne (relation : ${p.relation}), sans centres d'intérêt précisés.`;
  try {
    const vecteur = await embed(texte);
    if (DRY_RUN) {
      console.log(`${p.prenom} → "${texte}"  → vector(${vecteur.length})`);
    } else {
      await sbPatch(p.id, { embedding: `[${vecteur.join(",")}]` });
      console.log(`✓ ${p.prenom} (${tags.length} tags)`);
    }
    ok++;
  } catch (e) {
    console.error(`✗ ${p.prenom} (${p.id}) : ${e.message}`);
  }
}
console.log(`\n${ok}/${proches.length} embeddés.`);
