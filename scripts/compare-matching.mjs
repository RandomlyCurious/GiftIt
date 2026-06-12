// Comparaison côte-à-côte : matching TAGS (prod actuelle) vs generate-panel V2
// (embeddings + reranking LLM), sur les mêmes proches. Affiche le POURQUOI de
// chaque choix : tags déclencheurs côté tags, description-destinataire +
// justification LLM côté v2. Lecture seule. Secrets depuis .env.local.
//
//   node scripts/compare-matching.mjs

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
const DUMMY_EVENT = "00000000-0000-0000-0000-000000000000";

async function sbGet(q) {
  const r = await fetch(`${URL}/rest/v1/${q}`, { headers: { apikey: SR, Authorization: `Bearer ${SR}` } });
  if (!r.ok) throw new Error(`GET ${r.status}: ${await r.text()}`);
  return r.json();
}
async function callFn(nom, body) {
  const r = await fetch(`${URL}/functions/v1/${nom}`, {
    method: "POST",
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${nom} ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

const proches = await sbGet(
  "proches?select=id,prenom,relation,proche_tags(tag_slug),evenements(id)&embedding=not.is.null",
);

for (const p of proches) {
  const tagsProche = new Set((p.proche_tags ?? []).map((t) => t.tag_slug));
  const evId = p.evenements?.[0]?.id ?? DUMMY_EVENT;
  console.log("\n" + "=".repeat(78));
  console.log(`PROCHE : ${p.prenom} (${p.relation})  | tags : ${[...tagsProche].join(", ") || "(aucun)"}`);
  console.log("=".repeat(78));

  // --- Moteur TAGS ---
  let tagsRes;
  try {
    tagsRes = await callFn("matching", { proche_id: p.id, evenement_id: evId, nb_propositions: 5 });
  } catch (e) {
    console.log(`  [TAGS] erreur : ${e.message}`);
    tagsRes = { propositions: [] };
  }
  const tagsIds = (tagsRes.propositions ?? []).map((x) => x.produit_id);
  const tagsDetails = tagsIds.length
    ? await sbGet(`produits?id=in.(${tagsIds.join(",")})&select=id,nom,produit_tags(tag_slug)`)
    : [];
  const tagsMap = new Map(tagsDetails.map((d) => [d.id, d]));

  console.log("\n  ── Moteur TAGS (cosinus sur tags) ──");
  (tagsRes.propositions ?? []).forEach((prop, i) => {
    const d = tagsMap.get(prop.produit_id);
    const tagsProduit = (d?.produit_tags ?? []).map((t) => t.tag_slug);
    const declencheurs = tagsProduit.filter((t) => tagsProche.has(t));
    console.log(`  ${i + 1}. ${d?.nom ?? prop.produit_id}  (score ${prop.score?.toFixed?.(3) ?? prop.score})`);
    console.log(`       tags déclencheurs : ${declencheurs.join(", ") || "(aucun en commun !)"}`);
  });

  // --- Moteur V2 ---
  let v2Res;
  try {
    v2Res = await callFn("generate-panel", { proche_id: p.id, evenement_id: evId, nb_propositions: 5 });
  } catch (e) {
    console.log(`  [V2] erreur : ${e.message}`);
    v2Res = { propositions: [] };
  }
  const v2Ids = (v2Res.propositions ?? []).map((x) => x.produit_id);
  const v2Details = v2Ids.length
    ? await sbGet(`produits?id=in.(${v2Ids.join(",")})&select=id,nom,description_matching`)
    : [];
  const v2Map = new Map(v2Details.map((d) => [d.id, d]));

  console.log("\n  ── Moteur V2 (pgvector + reranking gpt-4o) ──");
  (v2Res.propositions ?? []).forEach((prop, i) => {
    const d = v2Map.get(prop.produit_id);
    console.log(`  ${i + 1}. ${d?.nom ?? prop.produit_id}  (score ${prop.score} | orig ${prop.originalite} | slot ${prop.slot})`);
    console.log(`       pourquoi (sémantique) : ${d?.description_matching ?? ""}`);
    console.log(`       justif LLM : ${prop.justification ?? ""}`);
  });

  // --- Recouvrement ---
  const communs = tagsIds.filter((id) => v2Ids.includes(id));
  console.log(`\n  ▶ Produits en commun aux 2 moteurs : ${communs.length}/5`);
}
console.log("");
