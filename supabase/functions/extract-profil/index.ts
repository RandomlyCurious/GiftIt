// =============================================================================
// Edge Function : extract-profil  (matching v2 — Tranche 3)
// -----------------------------------------------------------------------------
// À partir de la description libre d'un proche :
//   - extrait intérêts / anti-goûts / tags lisibles (pour la restitution UI) ;
//   - construit un `profil_text` POSITIF (intérêts uniquement) destiné à
//     l'embedding — la recherche vectorielle gère mal la négation, donc les
//     anti-goûts sont exclus de l'embedding et seront gérés par le reranker
//     (generate-panel) qui lit la description complète ;
//   - génère l'embedding (text-embedding-3-small) et le stocke sur le proche.
//
// Contrat : POST { proche_id, description_libre? }
//   → { interets[], anti_gouts[], tags_ui[] }   (pour l'écran de restitution)
//
// Auteur : Agent Backend — Date : 2026-06
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODELE_EXTRACT = "gpt-4o"; // évaluation au plafond ; gpt-4o-mini en prod ensuite
const MODELE_EMBED = "text-embedding-3-small";

function reponse(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reponse({ error: "Utiliser POST." }, 405);

  let body: { proche_id?: string; description_libre?: string };
  try {
    body = await req.json();
  } catch {
    return reponse({ error: "Body JSON invalide." }, 400);
  }
  const procheId = body.proche_id;
  if (!procheId) return reponse({ error: "'proche_id' requis." }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !serviceKey) return reponse({ error: "Config Supabase manquante." }, 500);
  if (!openaiKey) return reponse({ error: "OPENAI_API_KEY manquante." }, 500);
  const supabase = createClient(supabaseUrl, serviceKey);

  // description_libre : fournie dans le body, sinon lue sur le proche.
  let description = body.description_libre;
  if (!description) {
    const { data: p, error } = await supabase
      .from("proches")
      .select("description_libre")
      .eq("id", procheId)
      .maybeSingle();
    if (error) return reponse({ error: `Lecture proche : ${error.message}` }, 500);
    description = p?.description_libre ?? "";
  }
  if (!description.trim()) {
    return reponse({ error: "Aucune description libre à analyser." }, 422);
  }

  // 1. Extraction LLM.
  const systeme = `Tu analyses la description d'un proche pour un moteur de recommandation de cadeaux. Tu renvoies :
- interets : centres d'intérêt / goûts POSITIFS (liste courte de mots-clés).
- anti_gouts : ce que la personne N'AIME PAS, rejette, ou contraintes fortes (ex "électronique", "gadgets", "viande" si végétarien). Liste courte. [] si rien d'explicite.
- profil_text : 2 à 4 phrases décrivant la personne et ses goûts POSITIFS uniquement (n'inclus PAS les anti-goûts), orienté "quel genre de cadeau lui plairait". C'est ce texte qui sera vectorisé.
- tags_ui : quelques mots-clés lisibles pour l'affichage.
Réponds UNIQUEMENT en JSON : {"interets":[],"anti_gouts":[],"profil_text":string,"tags_ui":[]}.`;

  let extrait: { interets: string[]; anti_gouts: string[]; profil_text: string; tags_ui: string[] };
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELE_EXTRACT,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systeme },
          { role: "user", content: description },
        ],
      }),
    });
    if (!r.ok) return reponse({ error: `OpenAI extract : ${await r.text()}` }, 502);
    const data = await r.json();
    extrait = JSON.parse(data.choices[0].message.content);
  } catch (e) {
    return reponse({ error: `Extraction LLM : ${(e as Error).message}` }, 502);
  }

  // 2. Embedding du profil_text positif.
  let vecteur: number[];
  try {
    const r = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODELE_EMBED, input: extrait.profil_text || description }),
    });
    if (!r.ok) return reponse({ error: `OpenAI embed : ${await r.text()}` }, 502);
    vecteur = (await r.json()).data[0].embedding;
  } catch (e) {
    return reponse({ error: `Embedding : ${(e as Error).message}` }, 502);
  }

  // 3. Stockage : embedding + description_libre (si fournie) + profil_valide.
  const maj: Record<string, unknown> = {
    embedding: `[${vecteur.join(",")}]`,
    profil_valide: true,
  };
  if (body.description_libre) maj.description_libre = body.description_libre;
  const { error: errMaj } = await supabase.from("proches").update(maj).eq("id", procheId);
  if (errMaj) return reponse({ error: `MAJ proche : ${errMaj.message}` }, 500);

  return reponse({
    interets: extrait.interets ?? [],
    anti_gouts: extrait.anti_gouts ?? [],
    tags_ui: extrait.tags_ui ?? [],
  });
});
