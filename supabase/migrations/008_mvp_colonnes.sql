-- Migration 008 : colonnes MVP (boucle de valeur cadeau)
-- Description : ajouts NON destructifs pour US-A1, US-A3, US-A4 (Roadmap v3 §3).
--               Aucune colonne/table existante n'est modifiée ou supprimée
--               (règle anti-régression 1). On ne touche pas à `choisie`.
-- Auteur : Agent BDD — Date : 2026-06

-- US-A1 : intervalle de génération des propositions, choisi par l'utilisateur.
-- Convention (text) : liste des jalons de rappel séparés par '_', parmi j30/j14/j7.
-- Défaut 'j30_j14_j7' = comportement actuel (les trois rappels). Le workflow N8n
-- lira ce champ pour décider quels rappels déclencher.
ALTER TABLE evenements
  ADD COLUMN frequence text DEFAULT 'j30_j14_j7';

-- US-A3 : marquer un cadeau réellement "offert" (distinct de "choisie").
ALTER TABLE propositions
  ADD COLUMN offert boolean DEFAULT false;
ALTER TABLE propositions
  ADD COLUMN offert_le date;

-- US-A4 : retour de satisfaction post-événement (1 tap, 3 niveaux).
-- 1 = déçu, 2 = bien, 3 = adoré. Nullable (pas encore renseigné).
ALTER TABLE propositions
  ADD COLUMN retour_satisfaction smallint
  CHECK (retour_satisfaction IN (1, 2, 3));
