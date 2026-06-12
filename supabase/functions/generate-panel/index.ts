// =============================================================================
// Edge Function : generate-panel  (matching v2 — Tranche 2, EN PARALLÈLE du tags)
// -----------------------------------------------------------------------------
// Moteur de matching en 3 couches (Specs_Matching_v2 §4-5) :
//   Couche 1 (filtres durs SQL) + Couche 2 (retrieval pgvector) : déléguées à la
//     fonction SQL match_produits (top 20 produits proches du vecteur du proche,
//     hors inactifs / swipés gauche / déjà offerts).
//   Couche 3 (reranking LLM) : un appel gpt-4o compose le panel final selon la
//     répartition de portefeuille (config_audace) et génère une justification
//     par cadeau.
//
// NB : fonction SÉPARÉE du `matching` (tags), invoquée seulement par l'outil de
// comparaison — le frontend reste sur `matching`. Impact utilisateur nul.
//
// Contrat : POST { proche_id, evenement_id, nb_propositions? }
//   → { propositions: [{ produit_id, score, originalite, slot, justification }] }
//
// Auteur : Agent Backend — Date : 2026-06
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODELE_RERANK = "gpt-4o"; // évaluation au plafond (T2) ; gpt-4o-mini en prod ensuite
const NB_DEFAUT = 5;

function reponse(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reponse({ error: "Utiliser POST." }, 405);

  let body: { proche_id?: string; evenement_id?: string; nb_propositions?: number };
  try {
    body = await req.json();
  } catch {
    return reponse({ error: "Body JSON invalide." }, 400);
  }
  const procheId = body.proche_id;
  const evenementId = body.evenement_id;
  if (!procheId || !evenementId) {
    return reponse({ error: "'proche_id' et 'evenement_id' sont requis." }, 400);
  }
  const nbPropositions =
    typeof body.nb_propositions === "number" && body.nb_propositions > 0
      ? Math.floor(body.nb_propositions)
      : NB_DEFAUT;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !serviceKey) return reponse({ error: "Config Supabase manquante." }, 500);
  if (!openaiKey) return reponse({ error: "OPENAI_API_KEY manquante (secret Supabase)." }, 500);
  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Proche : embedding (pont T2 = dérivé des tags) + tags pour le contexte LLM.
  const { data: proche, error: errProche } = await supabase
    .from("proches")
    .select("id, embedding, proche_tags(tag_slug, tags(libelle))")
    .eq("id", procheId)
    .maybeSingle();
  if (errProche) return reponse({ error: `Lecture proche : ${errProche.message}` }, 500);
  if (!proche) return reponse({ error: "Proche introuvable." }, 404);
  if (!proche.embedding) {
    return reponse({ error: "Proche sans embedding — lancer scripts/embed-proches.mjs." }, 422);
  }

  // Audace fixée à 50 (neutre) en Tranche 2 ; le curseur arrive en Tranche 3.
  const audace = 50;
  const { data: cfg } = await supabase
    .from("config_audace")
    .select("nb_valeur_sure, nb_equilibre, nb_wildcard")
    .lte("position_min", audace)
    .gte("position_max", audace)
    .maybeSingle();
  const repartition = cfg ?? { nb_valeur_sure: 2, nb_equilibre: 2, nb_wildcard: 1 };

  // 2. Couches 1+2 (filtres durs + pgvector) via la fonction SQL.
  const embArray =
    typeof proche.embedding === "string" ? JSON.parse(proche.embedding) : proche.embedding;
  const { data: candidats, error: errMatch } = await supabase.rpc("match_produits", {
    query_embedding: embArray,
    p_proche_id: procheId,
    match_count: 20,
  });
  if (errMatch) return reponse({ error: `match_produits : ${errMatch.message}` }, 500);
  if (!candidats || candidats.length === 0) {
    return reponse({ propositions: [] });
  }

  // 3. Couche 3 : reranking LLM + composition portefeuille + justifications.
  const tagsProche =
    (proche.proche_tags ?? [])
      .map((pt: { tags?: { libelle?: string }; tag_slug: string }) => pt.tags?.libelle ?? pt.tag_slug)
      .join(", ") || "(aucun tag renseigné)";

  type Candidat = {
    id: string; nom: string; categorie: string; description_matching: string | null;
    score_originalite: number | null; prix_min: number | null; prix_max: number | null; distance: number;
  };
  const liste = (candidats as Candidat[])
    .map(
      (c, i) =>
        `${i + 1}. id=${c.id} | ${c.nom} (${c.categorie}, ${c.prix_min}-${c.prix_max}€) | originalité=${c.score_originalite ?? "?"} | pour qui: ${c.description_matching ?? ""}`,
    )
    .join("\n");

  const systeme = `Tu composes un panel de ${nbPropositions} cadeaux pour un proche, à partir d'une liste de candidats déjà filtrés et triés par pertinence sémantique.
Tu appliques une composition en PORTEFEUILLE à gradient d'originalité :
- ${repartition.nb_valeur_sure} "valeur sûre" : forte pertinence, originalité 1-2 (rassure).
- ${repartition.nb_equilibre} "équilibré" : forte pertinence, originalité 3-4 (zone de choix).
- ${repartition.nb_wildcard} "wildcard" : pertinence correcte mais originalité 4-5 (effet "ah cool !"). Le wildcard garde TOUJOURS un matching décent, jamais hors-sol.
Tu choisis les produits UNIQUEMENT dans la liste fournie (par leur id). Pour chacun, tu écris une justification courte et incarnée, reliée au profil du proche.
Réponds en JSON : {"propositions":[{"produit_id": string, "slot": "valeur_sure"|"equilibre"|"wildcard", "justification": string}]} avec EXACTEMENT ${nbPropositions} éléments.`;

  const utilisateur = `Profil du proche (centres d'intérêt) : ${tagsProche}
Curseur d'audace : ${audace}/100 (neutre)

Candidats (${candidats.length}) :
${liste}`;

  let choix: { produit_id: string; slot?: string; justification?: string }[] = [];
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELE_RERANK,
        temperature: 0.5,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systeme },
          { role: "user", content: utilisateur },
        ],
      }),
    });
    if (!r.ok) return reponse({ error: `OpenAI rerank : ${await r.text()}` }, 502);
    const data = await r.json();
    choix = JSON.parse(data.choices[0].message.content).propositions ?? [];
  } catch (e) {
    return reponse({ error: `Reranking LLM : ${(e as Error).message}` }, 502);
  }

  // Mapping : on n'accepte que des produits réellement présents dans les candidats.
  const parId = new Map((candidats as Candidat[]).map((c) => [c.id, c]));
  const propositions = choix
    .filter((ch) => parId.has(ch.produit_id))
    .slice(0, nbPropositions)
    .map((ch) => {
      const c = parId.get(ch.produit_id)!;
      return {
        produit_id: ch.produit_id,
        score: Number((1 - c.distance).toFixed(4)), // similarité ~ 1 - distance cosinus
        originalite: c.score_originalite,
        slot: ch.slot ?? null,
        justification: ch.justification ?? null,
      };
    });

  return reponse({ propositions });
});
