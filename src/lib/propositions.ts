import { supabase } from "@/lib/supabase";

// Logique métier des propositions (hors composant, cf. §11). Mutations effectuées
// par le propriétaire du proche (autorisé par la RLS FOR ALL sur propositions).

// US-A3 : marquer une proposition comme réellement "offerte".
// Distinct de `choisie` (qu'on ne touche pas). Renseigne aussi la date.
export async function marquerOffert(
  propositionId: string,
  offert: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .from("propositions")
    .update({
      offert,
      // date du jour au format YYYY-MM-DD si offert, sinon on efface.
      offert_le: offert ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", propositionId);
  if (error) {
    console.error(error);
    return false;
  }
  return true;
}

// US-A4 : retour de satisfaction post-événement (1 = déçu, 2 = bien, 3 = adoré).
export async function enregistrerSatisfaction(
  propositionId: string,
  niveau: 1 | 2 | 3,
): Promise<boolean> {
  const { error } = await supabase
    .from("propositions")
    .update({ retour_satisfaction: niveau })
    .eq("id", propositionId);
  if (error) {
    console.error(error);
    return false;
  }
  return true;
}
