import { supabase } from "@/lib/supabase";

// Logique métier d'édition/suppression d'un proche (hors composant, §11).
// La RLS garantit que l'utilisateur n'agit que sur ses propres proches.

export type ChampsProche = {
  prenom: string;
  nom: string | null;
  date_naissance: string;
  relation: string;
  adresse: string | null;
  description_libre: string | null;
  budget_type: string;
  audace: number;
};

// Met à jour les champs scalaires d'un proche.
export async function mettreAJourProche(id: string, champs: ChampsProche) {
  const { error } = await supabase.from("proches").update(champs).eq("id", id);
  return error;
}

// Réconcilie les centres d'intérêt : on efface puis on réinsère la sélection
// (aucune table ne dépend de proche_tags, c'est sûr).
export async function reconcilierTags(procheId: string, slugs: string[]) {
  const { error: errDel } = await supabase
    .from("proche_tags")
    .delete()
    .eq("proche_id", procheId);
  if (errDel) return errDel;
  if (slugs.length === 0) return null;
  const { error } = await supabase
    .from("proche_tags")
    .insert(slugs.map((tag_slug) => ({ proche_id: procheId, tag_slug, poids: 1.0 })));
  return error;
}

type EvenementExistant = { id: string; type: string; actif: boolean | null };

// Réconcilie les événements SANS suppression dure : ajout des nouveaux types,
// réactivation/désactivation via `actif` (un événement peut avoir des propositions
// — FK RESTRICT — donc on ne le supprime pas, on le désactive). La fréquence des
// événements existants est préservée.
export async function reconcilierEvenements(
  procheId: string,
  typesSelectionnes: string[],
  existants: EvenementExistant[],
) {
  const typesExistants = new Set(existants.map((e) => e.type));

  const aAjouter = typesSelectionnes.filter((t) => !typesExistants.has(t));
  if (aAjouter.length > 0) {
    const { error } = await supabase
      .from("evenements")
      .insert(aAjouter.map((type) => ({ proche_id: procheId, type })));
    if (error) return error;
  }

  for (const e of existants) {
    const doitEtreActif = typesSelectionnes.includes(e.type);
    if (doitEtreActif && e.actif === false) {
      const { error } = await supabase.from("evenements").update({ actif: true }).eq("id", e.id);
      if (error) return error;
    } else if (!doitEtreActif && e.actif !== false) {
      const { error } = await supabase.from("evenements").update({ actif: false }).eq("id", e.id);
      if (error) return error;
    }
  }
  return null;
}

// Supprime un proche. Le ON DELETE CASCADE emporte tags, événements, swipes,
// propositions, déclencheurs et interactions associés (CdC §3.2.2).
export async function supprimerProche(id: string) {
  const { error } = await supabase.from("proches").delete().eq("id", id);
  return error;
}
