-- Migration 013 : embedding du proche + table de configuration d'audace
-- Description : Tranche 2 du matching v2. Additif, impact utilisateur nul (le
--               matching tags reste seul branché côté app ; la nouvelle Edge
--               Function generate-panel est invoquée seulement via l'outil de
--               comparaison).
--               - proches.embedding : vecteur sémantique du proche. En Tranche 2,
--                 dérivé de ses tags (pont) ; en Tranche 3, issu de la description
--                 libre. proches.audace / budget restent en Tranche 3.
--               - config_audace : répartition du portefeuille (valeur sûre /
--                 équilibré / wildcard) selon la position du curseur d'audace.
--                 Stockée en table pour A/B tester sans toucher au code (v2 §5).
-- Auteur : Agent BDD — Date : 2026-06

ALTER TABLE proches ADD COLUMN embedding vector(1536);

CREATE TABLE config_audace (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  position_min integer NOT NULL,   -- borne basse du curseur (incluse)
  position_max integer NOT NULL,   -- borne haute du curseur (incluse)
  nb_valeur_sure integer NOT NULL, -- matching fort, originalité 1-2
  nb_equilibre integer NOT NULL,   -- matching fort, originalité 3-4
  nb_wildcard integer NOT NULL,    -- matching correct, originalité 4-5
  created_at timestamptz DEFAULT now()
);

-- Seed : 3 plages (classique / neutre / audacieux), total = 5 par panel (v2 §5).
INSERT INTO config_audace (position_min, position_max, nb_valeur_sure, nb_equilibre, nb_wildcard) VALUES
  (0,  33,  3, 2, 0),   -- 😴 classique
  (34, 66,  2, 2, 1),   -- neutre (défaut, audace = 50)
  (67, 100, 1, 2, 2);   -- 🎢 audacieux

-- RLS : config_audace est une table de référence (lecture publique, pas d'écriture
-- publique) ; le seed et les ajustements passent par la service_role.
ALTER TABLE config_audace ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture publique config_audace"
  ON config_audace FOR SELECT
  USING (true);
