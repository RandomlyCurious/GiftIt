-- Migration 011 : pgvector + colonnes d'enrichissement du catalogue
-- Description : Tranche 1 du matching v2 (Specs_Matching_v2). Active l'extension
--               pgvector et ajoute, côté `produits`, les colonnes d'enrichissement
--               sémantique. 100 % additif : aucune colonne existante touchée, et
--               le matching par tags reste SEUL actif (impact utilisateur nul).
--               L'index vectoriel (HNSW) est posé en migration 012, APRÈS le
--               chargement des embeddings par l'ELT (meilleure construction).
-- Auteur : Agent BDD — Date : 2026-06

CREATE EXTENSION IF NOT EXISTS vector;

-- description_matching : la description-pivot orientée "pour qui c'est un bon
-- cadeau" (c'est ELLE qui est embeddée, pas le nom du produit) — cf. v2 §10.
ALTER TABLE produits ADD COLUMN description_matching text;

-- embedding : vecteur sémantique de description_matching (text-embedding-3-small).
ALTER TABLE produits ADD COLUMN embedding vector(1536);

-- score_originalite : 1 (très commun) à 5 (très original), ancres v2 §6.
ALTER TABLE produits ADD COLUMN score_originalite integer
  CHECK (score_originalite BETWEEN 1 AND 5);

-- Attributs structurés optionnels (générés par l'ELT).
ALTER TABLE produits ADD COLUMN tranche_age text;
ALTER TABLE produits ADD COLUMN occasions text[];
