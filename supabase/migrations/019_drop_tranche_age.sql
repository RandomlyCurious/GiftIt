-- Migration 019 : suppression de la colonne texte `tranche_age`
-- Description : `tranche_age` était hétérogène (labels, plages, arrays JSON) et a été
--               normalisée vers `age_min`/`age_max` (migration 018 + scripts/normalize-age.mjs).
--               On la supprime : source d'âge unique = age_min/age_max (filtre dur).
-- Auteur : Agent BDD — Date : 2026-06

ALTER TABLE produits DROP COLUMN tranche_age;
