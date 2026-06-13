-- Migration 015 : colonnes d'onboarding v2 sur proches (Tranche 3 matching v2)
-- Description : additif. Permet la capture par description libre + budget + audace.
--               proches.embedding existe déjà (013). Aucune colonne existante
--               touchée ; le matching tags reste opérationnel (repli).
-- Auteur : Agent BDD — Date : 2026-06

ALTER TABLE proches ADD COLUMN description_libre text;
ALTER TABLE proches ADD COLUMN audace integer DEFAULT 50
  CHECK (audace BETWEEN 0 AND 100);
ALTER TABLE proches ADD COLUMN budget_type text DEFAULT '50'
  CHECK (budget_type IN ('20', '50', '150', 'nolimit', 'custom'));
ALTER TABLE proches ADD COLUMN budget_min numeric(10,2);  -- si budget_type = 'custom'
ALTER TABLE proches ADD COLUMN budget_max numeric(10,2);  -- si budget_type = 'custom'
ALTER TABLE proches ADD COLUMN profil_valide boolean DEFAULT false;
