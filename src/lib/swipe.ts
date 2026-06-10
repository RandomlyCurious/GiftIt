import { supabase } from "@/lib/supabase";

// Logique métier du swipe (CLAUDE.md §4 + §11 : doit vivre en lib, pas dans la page).
// Enregistre un swipe et met à jour le vecteur de goûts du proche en conséquence.

export type Direction = "gauche" | "droite";

// Vecteur de goûts : un poids (number) par slug de tag.
type VecteurGouts = Record<string, number>;

// Règle §4 : DROITE renforce (+0.5), GAUCHE atténue (-0.3, plancher à 0).
const POIDS_DROITE = 0.5;
const POIDS_GAUCHE = -0.3;

// Seuil de calibration §4 : calibré dès 5 swipes.
const SEUIL_CALIBRATION = 5;

type ResultatSwipe = { error: string | null };

/**
 * Enregistre un swipe pour un proche sur un produit, puis recalcule et persiste
 * le vecteur de goûts, le nombre de swipes et l'état de calibration du proche.
 *
 * @param tagsProduit slugs des tags du produit swipé (un produit = plusieurs tags)
 */
export async function enregistrerSwipe(
  procheId: string,
  produitId: string,
  direction: Direction,
  tagsProduit: string[],
): Promise<ResultatSwipe> {
  // 1. Insertion du swipe. La contrainte UNIQUE (proche_id, produit_id) garantit
  //    qu'un produit n'est swipé qu'une fois : en cas de doublon on s'arrête.
  const { error: erreurInsert } = await supabase
    .from("swipes")
    .insert({ proche_id: procheId, produit_id: produitId, direction });
  if (erreurInsert) {
    console.error(erreurInsert);
    return { error: "Ce produit a déjà été swipé ou l'enregistrement a échoué." };
  }

  // 2. Lecture de l'état courant du proche (vecteur + compteur de swipes).
  const { data: proche, error: erreurLecture } = await supabase
    .from("proches")
    .select("vecteur_gouts, nb_swipes")
    .eq("id", procheId)
    .single();
  if (erreurLecture || !proche) {
    console.error(erreurLecture);
    return { error: "Impossible de lire le profil du proche." };
  }

  // 3. Mise à jour du vecteur de goûts pour chaque tag du produit.
  const vecteur: VecteurGouts = { ...((proche.vecteur_gouts as VecteurGouts) ?? {}) };
  const delta = direction === "droite" ? POIDS_DROITE : POIDS_GAUCHE;
  for (const tag of tagsProduit) {
    const valeur = (vecteur[tag] ?? 0) + delta;
    // Plancher à 0 : un goût ne devient jamais négatif (§4).
    vecteur[tag] = Math.max(0, valeur);
  }

  // 4. Incrément du compteur et passage en "calibré" au-delà du seuil.
  const nbSwipes = (proche.nb_swipes ?? 0) + 1;
  const calibre = nbSwipes >= SEUIL_CALIBRATION;

  const { error: erreurUpdate } = await supabase
    .from("proches")
    .update({ vecteur_gouts: vecteur, nb_swipes: nbSwipes, calibre })
    .eq("id", procheId);
  if (erreurUpdate) {
    console.error(erreurUpdate);
    return { error: "Le swipe est enregistré mais le profil n'a pas pu être mis à jour." };
  }

  return { error: null };
}
