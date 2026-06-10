-- Migration 003 : ajout d'index
-- Description : index sur les colonnes de clés étrangères les plus sollicitées
--               (lookups et sous-requêtes RLS via proche_id). Simples et
--               justifiés : PostgreSQL n'indexe pas automatiquement les FK.
-- Auteur : Agent BDD — Date : 2026-06

-- Proches d'un utilisateur (dashboard + sous-requêtes RLS qui filtrent par user_id)
CREATE INDEX idx_proches_user_id ON proches (user_id);

-- Tags d'un proche (fiche proche + matching)
CREATE INDEX idx_proche_tags_proche_id ON proche_tags (proche_id);

-- Swipes d'un proche (session de swipe + calcul du vecteur de goûts)
CREATE INDEX idx_swipes_proche_id ON swipes (proche_id);

-- Tags d'un cadeau (matching : vecteur de tags du cadeau)
CREATE INDEX idx_cadeau_tags_cadeau_id ON cadeau_tags (cadeau_id);

-- Événements d'un proche (calendrier + rappels)
CREATE INDEX idx_evenements_proche_id ON evenements (proche_id);

-- Propositions d'un proche (historique + log des envois)
CREATE INDEX idx_propositions_proche_id ON propositions (proche_id);
