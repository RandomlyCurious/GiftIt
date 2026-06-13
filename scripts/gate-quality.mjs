// GATE QUALITÉ (Tranche 3) — moment de vérité.
// Crée des proches de test contrastés AVEC anti-goûts marqués, les embedde via
// extract-profil (description libre), puis compare TAGS vs V2 côte à côte, avec
// détection automatique des violations d'anti-goût (le test le plus discriminant).
// Profils + user de test laissés en base (nettoyage après verdict).
//
//   node scripts/gate-quality.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const E = {};
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf-8").split(/\r?\n/)) {
  const t = line.trim();
  if (t && !t.startsWith("#") && t.includes("=")) { const i = t.indexOf("="); E[t.slice(0, i)] = t.slice(i + 1); }
}
const URL = E.NEXT_PUBLIC_SUPABASE_URL, SR = E.SUPABASE_SERVICE_ROLE_KEY;
const DUMMY_EVENT = "00000000-0000-0000-0000-000000000000";

async function api(method, pathn, body, base = `${URL}/rest/v1`) {
  const r = await fetch(`${base}${pathn}`, {
    method,
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${method} ${pathn} ${r.status}: ${txt}`);
  return txt ? JSON.parse(txt) : null;
}
async function fn(nom, body) {
  const r = await fetch(`${URL}/functions/v1/${nom}`, {
    method: "POST", headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${nom} ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

const PROFILS = [
  {
    prenom: "Marc", relation: "ami", date: "1979-05-10", budget_type: "150",
    tags: ["cuisine", "gastronomie", "vin"],
    description:
      "Marc, 45 ans, passionné de cuisine traditionnelle française et de produits du terroir. Il passe ses week-ends aux fourneaux et adore recevoir des amis autour d'une grande tablée. MAIS il déteste profondément les gadgets électroniques et la technologie : pour lui un bon couteau et une cocotte en fonte valent mieux que n'importe quel appareil connecté. Il fuit tout ce qui a une prise ou des piles.",
    antiLabel: "électronique / gadgets connectés",
    antiCat: ["high_tech"],
    antiMots: ["connect", "électro", "electro", "robot", "machine à", "domotiq", "enceinte", "écouteur", "casque", "ampoule", "aspirateur"],
  },
  {
    prenom: "Léa", relation: "ami", date: "1994-09-22", budget_type: "50",
    tags: ["sport", "outdoor", "voyage", "gastronomie"],
    description:
      "Léa, 30 ans, mordue de randonnée et de bivouac, toujours partante pour une aventure en pleine nature. Végétarienne convaincue, elle ne mange aucune viande. Minimaliste dans l'âme, elle déteste accumuler des objets inutiles et fuit le superflu : elle préfère mille fois vivre une expérience que recevoir un objet de plus.",
    antiLabel: "viande (végétarienne) / objets superflus",
    antiCat: [],
    antiMots: ["viande", "charcut", "steak", "barbecue", "saucisse", "jambon"],
  },
  {
    prenom: "Thomas", relation: "collegue", date: "1986-02-14", budget_type: "nolimit",
    tags: ["high_tech", "culture", "musique"],
    description:
      "Thomas, 38 ans, grand amateur de culture geek, de science-fiction et de musique. Paradoxe assumé : il a horreur des objets connectés et de la domotique, qu'il trouve intrusifs. Il vénère le rétro — vinyles, vieilles consoles, livres papier, hi-fi analogique. Le 'tout-connecté' moderne le rebute profondément.",
    antiLabel: "objets connectés / domotique",
    antiCat: [],
    antiMots: ["connect", "domotiq", "intelligent", "ampoule", "assistant vocal", "enceinte connect"],
  },
];

function viole(nomProduit, categorie, p) {
  const n = (nomProduit || "").toLowerCase();
  if (p.antiCat.includes(categorie)) return true;
  return p.antiMots.some((m) => n.includes(m));
}

// --- Setup : un user de test + les proches ---
const email = `gate+${Date.now().toString(36)}@giftmatch.test`;
const u = await api("POST", "/admin/users", { email, password: "TestPwd123!", email_confirm: true }, `${URL}/auth/v1`);
const userId = u.id;
console.log(`User de test : ${email}  (id ${userId})\n`);

const proches = [];
for (const p of PROFILS) {
  const [pr] = await api("POST", "/proches", {
    user_id: userId, prenom: p.prenom, date_naissance: p.date, relation: p.relation,
    description_libre: p.description, budget_type: p.budget_type,
  });
  await api("POST", "/proche_tags", p.tags.map((s) => ({ proche_id: pr.id, tag_slug: s, poids: 1.0 })));
  const extr = await fn("extract-profil", { proche_id: pr.id });
  proches.push({ ...p, id: pr.id, extrait: extr });
}

// --- Comparaison ---
for (const p of proches) {
  console.log("\n" + "█".repeat(80));
  console.log(`PROFIL : ${p.prenom}  | budget ${p.budget_type} | tags: ${p.tags.join(", ")}`);
  console.log(`Description : ${p.description}`);
  console.log(`extract-profil → intérêts: ${JSON.stringify(p.extrait.interets)}`);
  console.log(`              → ANTI-GOÛTS: ${JSON.stringify(p.extrait.anti_gouts)}`);
  console.log(`⚠️  Anti-goût à surveiller : ${p.antiLabel}`);
  console.log("█".repeat(80));

  const tags = await fn("matching", { proche_id: p.id, evenement_id: DUMMY_EVENT, nb_propositions: 5 }).catch((e) => ({ propositions: [], err: e.message }));
  const v2 = await fn("generate-panel", { proche_id: p.id, evenement_id: DUMMY_EVENT, nb_propositions: 5 }).catch((e) => ({ propositions: [], err: e.message }));

  async function details(ids) {
    if (!ids.length) return new Map();
    const d = await api("GET", `/produits?id=in.(${ids.join(",")})&select=id,nom,categorie`);
    return new Map(d.map((x) => [x.id, x]));
  }
  const dt = await details((tags.propositions || []).map((x) => x.produit_id));
  const dv = await details((v2.propositions || []).map((x) => x.produit_id));

  let violTags = 0, violV2 = 0;
  console.log(`\n  ── TAGS ${tags.err ? "(ERREUR: " + tags.err + ")" : ""} ──`);
  (tags.propositions || []).forEach((x, i) => {
    const d = dt.get(x.produit_id) || {};
    const v = viole(d.nom, d.categorie, p); if (v) violTags++;
    console.log(`  ${i + 1}. ${d.nom} [${d.categorie}]${v ? "   ❌ VIOLE anti-goût" : ""}`);
  });
  console.log(`\n  ── V2 ${v2.err ? "(ERREUR: " + v2.err + ")" : ""} ──`);
  (v2.propositions || []).forEach((x, i) => {
    const d = dv.get(x.produit_id) || {};
    const v = viole(d.nom, d.categorie, p); if (v) violV2++;
    console.log(`  ${i + 1}. ${d.nom} [${d.categorie}] (slot ${x.slot})${v ? "   ❌ VIOLE anti-goût" : ""}`);
    console.log(`        justif: ${x.justification ?? ""}`);
  });
  console.log(`\n  ▶ VIOLATIONS anti-goût « ${p.antiLabel} » :  TAGS = ${violTags}/5   |   V2 = ${violV2}/5`);
}

console.log(`\n\n=== Nettoyage différé : user de test ${userId} conservé pour re-vérif gpt-4o-mini. ===`);
