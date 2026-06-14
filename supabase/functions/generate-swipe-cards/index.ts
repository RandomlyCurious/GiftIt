// =============================================================================
// Edge Function : generate-swipe-cards  (matching v2 — §3 & §8.2)
// -----------------------------------------------------------------------------
// Sélectionne 8-10 cartes de swipe selon la STRATÉGIE du v2 §3, pour maximiser
// le ratio signal/plaisir :
//   - Cœur de cible (6) : matching fort (les plus proches par embedding) →
//     effet "ils m'ont compris".
//   - Discriminante (3) : produits pertinents mais de CATÉGORIES différentes du
//     cœur → départagent des hypothèses du profil, max d'info par swipe.
//   - Exploratoire (1) : originalité haute (score 4-5), matching correct →
//     teste l'ouverture à la surprise.
// Exclut les produits déjà swipés. Repli si le proche n'a pas d'embedding
// (pas de portrait libre) : produits actifs variés (ancien comportement).
//
// Contrat : POST { proche_id }  →  { produit_ids: string[] }  (ordonnés : cœur,
//           puis discriminantes, puis exploratoire)
//
// Auteur : Agent Backend — Date : 2026-06
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const NB_COEUR = 6;
const NB_DISCRIM = 3;
const NB_EXPLO = 1;
const TOTAL = NB_COEUR + NB_DISCRIM + NB_EXPLO; // 10

function reponse(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Cand = { id: string; categorie: string; score_originalite: number | null; distance: number };

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reponse({ error: "Utiliser POST." }, 405);

  let body: { proche_id?: string };
  try {
    body = await req.json();
  } catch {
    return reponse({ error: "Body JSON invalide." }, 400);
  }
  const procheId = body.proche_id;
  if (!procheId) return reponse({ error: "'proche_id' requis." }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return reponse({ error: "Config Supabase manquante." }, 500);
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: proche, error: errProche } = await supabase
    .from("proches")
    .select("id, embedding")
    .eq("id", procheId)
    .maybeSingle();
  if (errProche) return reponse({ error: `Lecture proche : ${errProche.message}` }, 500);
  if (!proche) return reponse({ error: "Proche introuvable." }, 404);

  const { data: swipes } = await supabase
    .from("swipes").select("produit_id").eq("proche_id", procheId);
  const dejaSwipes = new Set((swipes ?? []).map((s) => s.produit_id));

  const ids: string[] = [];
  const pris = new Set<string>();
  const ajouter = (c: Cand) => { ids.push(c.id); pris.add(c.id); };

  if (proche.embedding) {
    const embArray =
      typeof proche.embedding === "string" ? JSON.parse(proche.embedding) : proche.embedding;
    // Pas de filtre budget : la calibration sert à apprendre les goûts.
    const { data: brut } = await supabase.rpc("match_produits", {
      query_embedding: embArray,
      p_proche_id: procheId,
      match_count: 50,
      p_budget_min: null,
      p_budget_max: null,
    });
    const pool = ((brut ?? []) as Cand[]).filter((c) => !dejaSwipes.has(c.id));

    // 1. Cœur de cible : les plus proches.
    for (const c of pool) {
      if (ids.length >= NB_COEUR) break;
      ajouter(c);
    }
    const catsCoeur = new Set(
      pool.filter((c) => pris.has(c.id)).map((c) => c.categorie),
    );

    // 2. Discriminantes : pertinentes mais d'une AUTRE catégorie que le cœur.
    for (const c of pool) {
      if (ids.length >= NB_COEUR + NB_DISCRIM) break;
      if (!pris.has(c.id) && !catsCoeur.has(c.categorie)) {
        ajouter(c);
        catsCoeur.add(c.categorie);
      }
    }
    // complément si catalogue peu diversifié.
    for (const c of pool) {
      if (ids.length >= NB_COEUR + NB_DISCRIM) break;
      if (!pris.has(c.id)) ajouter(c);
    }

    // 3. Exploratoire : originalité haute (4-5), matching encore correct.
    const explo = pool.filter((c) => !pris.has(c.id) && (c.score_originalite ?? 0) >= 4);
    for (const c of explo) {
      if (ids.length >= TOTAL) break;
      ajouter(c);
    }
    // repli exploratoire : n'importe quel reste.
    for (const c of pool) {
      if (ids.length >= TOTAL) break;
      if (!pris.has(c.id)) ajouter(c);
    }
  }

  // Repli global (proche sans embedding, ou pool insuffisant) : produits actifs variés.
  if (ids.length < TOTAL) {
    const exclus = [...new Set([...ids, ...dejaSwipes])];
    let req2 = supabase.from("produits").select("id").eq("actif", true).limit(TOTAL - ids.length);
    if (exclus.length > 0) req2 = req2.not("id", "in", `(${exclus.join(",")})`);
    const { data: autres } = await req2;
    for (const p of (autres ?? []) as { id: string }[]) ids.push(p.id);
  }

  return reponse({ produit_ids: ids });
});
