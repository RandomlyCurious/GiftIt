// =============================================================================
// Edge Function : matching
// -----------------------------------------------------------------------------
// Rôle :
//   Calcule, pour un proche et un événement donnés, les N meilleurs produits à
//   proposer. Le score est une similarité cosinus entre le vecteur de goûts du
//   proche et le vecteur (binaire) de tags de chaque produit du catalogue.
//
// Algorithme (cf. CLAUDE.md §4) :
//   score = Σ(proche[tag] × produit[tag]) / (|proche| × |produit|)
//   où |v| est la norme euclidienne du vecteur. produit[tag] vaut 1 si le tag
//   est présent dans produit_tags, 0 sinon. Si l'une des normes est nulle, le
//   score vaut 0 (on évite la division par zéro).
//
//   Fallback de calibration : tant que le proche n'est pas calibré
//   (calibre = false / nb_swipes < 5), son vecteur de goûts appris n'est pas
//   fiable. On utilise alors les tags manuels (proche_tags + leur poids) comme
//   vecteur de référence. Une fois calibré, on utilise vecteur_gouts.
//
//   Sont exclus les produits déjà swipés par ce proche (CdC §4.3 : un produit
//   déjà swipé n'est pas reproposé) et les produits inactifs (actif = false).
//
// Contrat HTTP :
//   POST /functions/v1/matching
//   Body : { "proche_id": "uuid", "evenement_id": "uuid", "nb_propositions": 5 }
//   Retour : { "propositions": [{ "produit_id": "uuid", "score": 0.87 }, ...] }
//
//   NB : cette fonction CALCULE et RETOURNE les propositions uniquement.
//   L'INSERT dans la table `propositions` (log) est géré par N8n (cf. §8) ;
//   il n'est volontairement pas fait ici pour garder une responsabilité unique.
//
// Auteur : Agent Backend — Date : 2026-06
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

// Un vecteur de goûts/tags : association tag -> poids.
type Vecteur = Record<string, number>;

type RequeteMatching = {
  proche_id?: string;
  evenement_id?: string;
  nb_propositions?: number;
};

type Proposition = {
  produit_id: string;
  score: number;
};

// -----------------------------------------------------------------------------
// CORS : on autorise les appels simples (N8n, navigateur en dev).
// -----------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Nombre de propositions par défaut si l'appelant n'en fournit pas (cf. §4).
const NB_PROPOSITIONS_DEFAUT = 5;

// -----------------------------------------------------------------------------
// Petites fonctions utilitaires de calcul vectoriel.
// -----------------------------------------------------------------------------

// Norme euclidienne d'un vecteur : racine de la somme des carrés des poids.
function norme(vecteur: Vecteur): number {
  let sommeCarres = 0;
  for (const valeur of Object.values(vecteur)) {
    sommeCarres += valeur * valeur;
  }
  return Math.sqrt(sommeCarres);
}

// Similarité cosinus entre le vecteur du proche et le vecteur (binaire) du
// produit. Formule §4 : produit scalaire / (norme proche × norme produit).
// Retourne 0 si l'une des normes est nulle (proche sans goûts ou produit sans
// tags) afin d'éviter toute division par zéro.
function similariteCosinus(proche: Vecteur, produit: Vecteur): number {
  const normeProche = norme(proche);
  const normeProduit = norme(produit);
  if (normeProche === 0 || normeProduit === 0) {
    return 0;
  }

  // Produit scalaire : on n'itère que sur les tags du produit, car tout tag
  // absent du produit a une valeur 0 et ne contribue pas à la somme.
  let produitScalaire = 0;
  for (const [tag, poidsProduit] of Object.entries(produit)) {
    const poidsProche = proche[tag] ?? 0;
    produitScalaire += poidsProche * poidsProduit;
  }

  return produitScalaire / (normeProche * normeProduit);
}

// -----------------------------------------------------------------------------
// Réponses HTTP JSON (succès / erreur), toujours avec les en-têtes CORS.
// -----------------------------------------------------------------------------
function reponseJson(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function reponseErreur(message: string, statut: number): Response {
  return reponseJson({ error: message }, statut);
}

// -----------------------------------------------------------------------------
// Handler principal
// -----------------------------------------------------------------------------
Deno.serve(async (req: Request): Promise<Response> => {
  // 1. Pré-vol CORS.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2. Seul POST est accepté.
  if (req.method !== "POST") {
    return reponseErreur("Méthode non autorisée, utiliser POST.", 405);
  }

  // 3. Lecture et validation du body.
  let corps: RequeteMatching;
  try {
    corps = await req.json();
  } catch {
    return reponseErreur("Body JSON invalide.", 400);
  }

  const procheId = corps.proche_id;
  const evenementId = corps.evenement_id;
  if (!procheId || !evenementId) {
    return reponseErreur(
      "Les champs 'proche_id' et 'evenement_id' sont requis.",
      400,
    );
  }

  const nbPropositions =
    typeof corps.nb_propositions === "number" && corps.nb_propositions > 0
      ? Math.floor(corps.nb_propositions)
      : NB_PROPOSITIONS_DEFAUT;

  // 4. Création du client Supabase (service role : accès complet côté serveur).
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return reponseErreur(
      "Configuration serveur manquante (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
      500,
    );
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // 5. Récupération du proche (vecteur de goûts, état de calibration).
  const { data: proche, error: erreurProche } = await supabase
    .from("proches")
    .select("id, vecteur_gouts, nb_swipes, calibre")
    .eq("id", procheId)
    .single();

  if (erreurProche) {
    return reponseErreur(
      `Erreur lors de la lecture du proche : ${erreurProche.message}`,
      500,
    );
  }
  if (!proche) {
    return reponseErreur("Proche introuvable.", 404);
  }

  // 6. Construction du vecteur de référence du proche.
  //    - Calibré (nb_swipes >= 5) : on se fie au vecteur appris (vecteur_gouts).
  //    - Non calibré : ce vecteur n'est pas encore fiable, on retombe sur les
  //      tags manuels (proche_tags + leur poids). Choix : tant qu'on n'a pas
  //      assez de signal de swipe, la saisie manuelle initiale est plus juste.
  let vecteurProche: Vecteur;

  if (proche.calibre) {
    // vecteur_gouts est un jsonb { "sport": 1.5, ... } ; on le sécurise.
    vecteurProche = (proche.vecteur_gouts ?? {}) as Vecteur;
  } else {
    const { data: tagsManuels, error: erreurTags } = await supabase
      .from("proche_tags")
      .select("tag_slug, poids")
      .eq("proche_id", procheId);

    if (erreurTags) {
      return reponseErreur(
        `Erreur lors de la lecture des tags manuels : ${erreurTags.message}`,
        500,
      );
    }

    vecteurProche = {};
    for (const ligne of tagsManuels ?? []) {
      // poids peut être null en BDD (DEFAULT 1.0) ; on retombe sur 1.0.
      vecteurProche[ligne.tag_slug] = ligne.poids ?? 1.0;
    }
  }

  // 7. Liste des produits déjà swipés par ce proche (à exclure des propositions).
  const { data: swipes, error: erreurSwipes } = await supabase
    .from("swipes")
    .select("produit_id")
    .eq("proche_id", procheId);

  if (erreurSwipes) {
    return reponseErreur(
      `Erreur lors de la lecture des swipes : ${erreurSwipes.message}`,
      500,
    );
  }
  const produitsSwipes = new Set((swipes ?? []).map((s) => s.produit_id));

  // 8. Récupération des produits actifs avec leurs tags (jointure produit_tags).
  const { data: produits, error: erreurProduits } = await supabase
    .from("produits")
    .select("id, produit_tags(tag_slug)")
    .eq("actif", true);

  if (erreurProduits) {
    return reponseErreur(
      `Erreur lors de la lecture des produits : ${erreurProduits.message}`,
      500,
    );
  }

  // 9. Calcul du score de chaque produit candidat (hors produits déjà swipés).
  const propositions: Proposition[] = [];
  for (const produit of produits ?? []) {
    if (produitsSwipes.has(produit.id)) {
      continue;
    }

    // Vecteur binaire du produit : 1 pour chaque tag présent.
    const vecteurProduit: Vecteur = {};
    const tagsProduit = (produit.produit_tags ?? []) as { tag_slug: string }[];
    for (const t of tagsProduit) {
      vecteurProduit[t.tag_slug] = 1;
    }

    const score = similariteCosinus(vecteurProche, vecteurProduit);
    propositions.push({ produit_id: produit.id, score });
  }

  // 10. Tri par score décroissant et sélection des N meilleurs.
  propositions.sort((a, b) => b.score - a.score);
  const meilleures = propositions.slice(0, nbPropositions);

  return reponseJson({ propositions: meilleures });
});
