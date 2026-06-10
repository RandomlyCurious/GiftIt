-- Migration 004 : renommage cadeaux -> produits (suite modif CdC §4.2, MVP table unique)
-- Description : aligne la nomenclature sur le cahier des charges. Pour le MVP on
--               conserve UNE SEULE table (un produit = un vendeur, champs marchands
--               inline) ; on se contente donc de RENOMMER cadeaux -> produits et
--               cadeau_tags -> produit_tags, ainsi que les colonnes FK cadeau_id ->
--               produit_id. Aucun champ marchand n'est retiré. Le split
--               produit_vendeur reste prévu pour la v1.5 et n'est PAS implémenté ici.
--               Les contraintes, policies et index suivent automatiquement le RENAME
--               de table ; on renomme en plus ceux dont le nom contient « cadeau »
--               pour garder une nomenclature cohérente et lisible.
-- Auteur : Agent BDD — Date : 2026-06

-- ---------------------------------------------------------------------------
-- 1. Renommage des tables
-- ---------------------------------------------------------------------------
ALTER TABLE cadeaux RENAME TO produits;
ALTER TABLE cadeau_tags RENAME TO produit_tags;

-- ---------------------------------------------------------------------------
-- 2. Renommage des colonnes FK cadeau_id -> produit_id
-- ---------------------------------------------------------------------------
ALTER TABLE produit_tags RENAME COLUMN cadeau_id TO produit_id;
ALTER TABLE swipes RENAME COLUMN cadeau_id TO produit_id;
ALTER TABLE propositions RENAME COLUMN cadeau_id TO produit_id;

-- ---------------------------------------------------------------------------
-- 3. Renommage des policies RLS (cosmétique : suivent déjà la table renommée)
-- ---------------------------------------------------------------------------
ALTER POLICY "Lecture publique des cadeaux" ON produits
  RENAME TO "Lecture publique des produits";

ALTER POLICY "Lecture publique des cadeau_tags" ON produit_tags
  RENAME TO "Lecture publique des produit_tags";

-- ---------------------------------------------------------------------------
-- 4. Renommage des index (cosmétique : suivent déjà la table renommée)
-- ---------------------------------------------------------------------------
ALTER INDEX idx_cadeau_tags_cadeau_id RENAME TO idx_produit_tags_produit_id;
