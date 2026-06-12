-- Migration 012 : index vectoriel HNSW sur produits.embedding
-- Description : posé APRÈS le chargement des embeddings par l'ELT, pour une bonne
--               construction du graphe HNSW. Distance cosinus (vector_cosine_ops),
--               cohérent avec text-embedding-3-small. Sert le retrieval sémantique
--               de la Tranche 2 (matching v2) ; n'affecte EN RIEN le matching par
--               tags actuel (impact utilisateur nul). Additif et réversible.
-- Auteur : Agent BDD — Date : 2026-06

CREATE INDEX idx_produits_embedding_hnsw
  ON produits USING hnsw (embedding vector_cosine_ops);
