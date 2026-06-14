-- Migration 017 : colonne `source` sur produits (traçabilité de l'origine)
-- Description : additive. Distingue les produits générés pour le dev/test (concepts,
--               sans URL marchande réelle) des produits vérifiés ou issus d'API.
--               Le DEFAULT s'applique aussi aux lignes existantes -> les 200 produits
--               actuels (concepts curés par LLM) sont marqués 'genere_test', ce qui
--               est exact. Aucune autre donnée existante n'est modifiée.
-- Auteur : Agent BDD — Date : 2026-06

ALTER TABLE produits ADD COLUMN source text DEFAULT 'genere_test'
  CHECK (source IN ('genere_test', 'verifie', 'api_marchande'));
