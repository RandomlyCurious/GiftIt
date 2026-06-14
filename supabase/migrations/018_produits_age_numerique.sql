-- Migration 018 : tranche d'âge numérique exploitable (filtre dur futur)
-- Description : additive. Le champ texte `tranche_age` est incohérent (labels,
--               plages, arrays JSON…). On ajoute deux colonnes numériques propres
--               `age_min`/`age_max` (remplies par scripts/normalize-age.mjs depuis
--               l'existant). `tranche_age` est conservé tel quel (non cassé).
-- Auteur : Agent BDD — Date : 2026-06

ALTER TABLE produits ADD COLUMN age_min integer;
ALTER TABLE produits ADD COLUMN age_max integer;
