import { supabase } from "@/lib/supabase";

// US-A1 : jalons de rappel possibles avant un événement.
// Le champ `evenements.frequence` (text) encode les jalons retenus ; le workflow
// N8n lit ce champ pour décider quels rappels (J-30 / J-14 / J-7) envoyer.
// Le défaut 'j30_j14_j7' reproduit le comportement actuel (les trois rappels).
export const FREQUENCES = [
  { code: "j30_j14_j7", libelle: "J-30, J-14 et J-7 (tous)" },
  { code: "j14_j7", libelle: "J-14 et J-7" },
  { code: "j7", libelle: "J-7 seulement" },
  { code: "j30", libelle: "J-30 seulement" },
] as const;

export const FREQUENCE_DEFAUT = "j30_j14_j7";

export function libelleFrequence(code: string | null): string {
  return (
    FREQUENCES.find((f) => f.code === code)?.libelle ??
    FREQUENCES[0].libelle
  );
}

// Met à jour la fréquence de rappel d'un événement (RLS : propriétaire du proche).
export async function mettreAJourFrequence(
  evenementId: string,
  frequence: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("evenements")
    .update({ frequence })
    .eq("id", evenementId);
  if (error) {
    console.error(error);
    return false;
  }
  return true;
}
