-- Migration 006 : renommage des contraintes restées en « cadeau »
-- Description : le ALTER TABLE RENAME de la migration 004 (cadeaux -> produits)
--               n'a pas renommé les contraintes/index sous-jacents, restés avec
--               l'ancien préfixe. On les aligne sur la nomenclature produits pour
--               un schéma cohérent (les noms PK/UNIQUE renomment aussi leur index).
-- Auteur : Agent BDD — Date : 2026-06

ALTER TABLE produits     RENAME CONSTRAINT cadeaux_pkey                   TO produits_pkey;
ALTER TABLE produit_tags RENAME CONSTRAINT cadeau_tags_pkey              TO produit_tags_pkey;
ALTER TABLE produit_tags RENAME CONSTRAINT cadeau_tags_cadeau_id_fkey    TO produit_tags_produit_id_fkey;
ALTER TABLE produit_tags RENAME CONSTRAINT cadeau_tags_tag_slug_fkey     TO produit_tags_tag_slug_fkey;
ALTER TABLE swipes       RENAME CONSTRAINT swipes_cadeau_id_fkey         TO swipes_produit_id_fkey;
ALTER TABLE swipes       RENAME CONSTRAINT swipes_proche_id_cadeau_id_key TO swipes_proche_id_produit_id_key;
ALTER TABLE propositions RENAME CONSTRAINT propositions_cadeau_id_fkey   TO propositions_produit_id_fkey;
