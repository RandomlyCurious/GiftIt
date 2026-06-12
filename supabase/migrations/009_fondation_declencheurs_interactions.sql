-- Migration 009 : socle générique de déclencheurs & interactions (FONDATION)
-- Description : US-B1 et US-B2 (Roadmap v3 §4). Tables 100 % additives, RLS par
--               propriété du proche (pattern §7). Aucune table/colonne existante
--               n'est modifiée (règle anti-régression 1). Le type 'evenement'
--               délègue au calendrier existant via evenement_id ; la synchro
--               evenements -> declencheurs est posée en migration 010.
-- Auteur : Agent BDD — Date : 2026-06

-- US-B1 : déclencheur générique (événement | attention | pro).
-- Les événements actuels seront représentés comme déclencheurs type 'evenement'
-- (backfill en 010), sans rien retirer à la table evenements.
CREATE TABLE declencheurs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proche_id uuid REFERENCES proches(id) ON DELETE CASCADE NOT NULL,
  type text CHECK (type IN ('evenement', 'attention', 'pro')) NOT NULL,
  evenement_id uuid REFERENCES evenements(id) ON DELETE CASCADE,  -- renseigné si type = 'evenement'
  regle_temporelle jsonb DEFAULT '{}',  -- règle de timing générique (pour attention/pro à venir)
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- US-B2 : journal des contacts suggérés et de leur issue (fondation de la mesure).
CREATE TABLE interactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proche_id uuid REFERENCES proches(id) ON DELETE CASCADE NOT NULL,
  declencheur_id uuid REFERENCES declencheurs(id) ON DELETE SET NULL,
  type_suggestion text,
  statut text CHECK (statut IN ('propose', 'vu', 'agi', 'ignore')) NOT NULL DEFAULT 'propose',
  date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Index sur les clés étrangères les plus sollicitées (+ filtrage type/actif).
CREATE INDEX idx_declencheurs_proche_id ON declencheurs (proche_id);
CREATE INDEX idx_declencheurs_evenement_id ON declencheurs (evenement_id);
CREATE INDEX idx_declencheurs_type_actif ON declencheurs (type, actif);
CREATE INDEX idx_interactions_proche_id ON interactions (proche_id);
CREATE INDEX idx_interactions_declencheur_id ON interactions (declencheur_id);

-- RLS : chaque utilisateur ne voit/modifie que les données de SES proches.
ALTER TABLE declencheurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture declencheurs de ses proches"
  ON declencheurs FOR SELECT
  USING (proche_id IN (SELECT id FROM proches WHERE user_id = auth.uid()));

CREATE POLICY "Modification declencheurs de ses proches"
  ON declencheurs FOR ALL
  USING (proche_id IN (SELECT id FROM proches WHERE user_id = auth.uid()))
  WITH CHECK (proche_id IN (SELECT id FROM proches WHERE user_id = auth.uid()));

ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture interactions de ses proches"
  ON interactions FOR SELECT
  USING (proche_id IN (SELECT id FROM proches WHERE user_id = auth.uid()));

CREATE POLICY "Modification interactions de ses proches"
  ON interactions FOR ALL
  USING (proche_id IN (SELECT id FROM proches WHERE user_id = auth.uid()))
  WITH CHECK (proche_id IN (SELECT id FROM proches WHERE user_id = auth.uid()));
