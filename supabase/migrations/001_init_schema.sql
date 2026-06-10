-- Migration 001 : création du schéma initial
-- Description : crée toutes les tables du projet GiftMatch dans le bon ordre
--               (respect des dépendances de clés étrangères). Schéma conforme
--               à la section 3 du CLAUDE.md, reproduit à l'identique.
-- Auteur : Agent BDD — Date : 2026-06

-- Utilisateurs (géré par Supabase Auth, on étend avec un profil)
CREATE TABLE profils (
  id uuid REFERENCES auth.users PRIMARY KEY,
  prenom text NOT NULL,
  nom text,
  created_at timestamptz DEFAULT now()
);

-- Proches
CREATE TABLE proches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profils(id) ON DELETE CASCADE NOT NULL,
  prenom text NOT NULL,
  nom text,
  date_naissance date NOT NULL,
  relation text CHECK (relation IN ('conjoint', 'enfant', 'parent', 'grand_parent', 'ami', 'collegue', 'autre')) NOT NULL,
  adresse text,
  photo_url text,
  vecteur_gouts jsonb DEFAULT '{}',  -- { "sport": 1.5, "lecture": 0.7, ... }
  nb_swipes integer DEFAULT 0,
  calibre boolean DEFAULT false,     -- true si nb_swipes >= 5
  created_at timestamptz DEFAULT now()
);

-- Tags normalisés (table de référence)
CREATE TABLE tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text UNIQUE NOT NULL,         -- ex: "sport", "high_tech", "cuisine"
  libelle text NOT NULL,             -- ex: "Sport", "High-tech", "Cuisine"
  categorie text NOT NULL            -- ex: "loisirs", "culture", "lifestyle"
);

-- Tags associés à un proche (saisie manuelle initiale)
CREATE TABLE proche_tags (
  proche_id uuid REFERENCES proches(id) ON DELETE CASCADE,
  tag_slug text REFERENCES tags(slug),
  poids float DEFAULT 1.0,
  PRIMARY KEY (proche_id, tag_slug)
);

-- Événements
CREATE TABLE evenements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proche_id uuid REFERENCES proches(id) ON DELETE CASCADE NOT NULL,
  type text CHECK (type IN ('anniversaire', 'noel', 'fete_meres', 'fete_peres', 'fete_grands_parents', 'saint_valentin', 'autre')) NOT NULL,
  date_fixe date,                    -- pour type = 'autre'
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Catalogue de cadeaux
CREATE TABLE cadeaux (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom text NOT NULL,
  description text,
  categorie text NOT NULL,
  prix_min numeric(10,2),
  prix_max numeric(10,2),
  url_produit text NOT NULL,
  url_image text,
  affilie boolean DEFAULT false,
  actif boolean DEFAULT true,
  nb_tags integer DEFAULT 0,         -- dénormalisé pour perf
  created_at timestamptz DEFAULT now()
);

-- Tags associés à un cadeau
CREATE TABLE cadeau_tags (
  cadeau_id uuid REFERENCES cadeaux(id) ON DELETE CASCADE,
  tag_slug text REFERENCES tags(slug),
  PRIMARY KEY (cadeau_id, tag_slug)
);

-- Historique des swipes
CREATE TABLE swipes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proche_id uuid REFERENCES proches(id) ON DELETE CASCADE NOT NULL,
  cadeau_id uuid REFERENCES cadeaux(id) NOT NULL,
  direction text CHECK (direction IN ('gauche', 'droite')) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (proche_id, cadeau_id)      -- un cadeau ne peut être swipé qu'une fois par proche
);

-- Propositions envoyées
CREATE TABLE propositions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proche_id uuid REFERENCES proches(id) ON DELETE CASCADE NOT NULL,
  evenement_id uuid REFERENCES evenements(id) NOT NULL,
  cadeau_id uuid REFERENCES cadeaux(id) NOT NULL,
  score float NOT NULL,              -- score de matching calculé
  choisie boolean DEFAULT false,     -- l'utilisateur a marqué ce cadeau comme "choisi"
  envoyee_le timestamptz,
  created_at timestamptz DEFAULT now()
);
