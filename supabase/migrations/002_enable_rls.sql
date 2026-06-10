-- Migration 002 : activation de Row Level Security + policies
-- Description : active RLS sur toutes les tables et définit les policies selon
--               la section 7 du CLAUDE.md. Un utilisateur ne voit/modifie que
--               ses propres données via auth.uid(). Les tables sans colonne
--               user_id directe (proche_tags, evenements, swipes, propositions)
--               vérifient la propriété via une sous-requête sur proches.
--               Les tables catalogue (cadeaux, tags, cadeau_tags) sont en
--               lecture publique, sans écriture publique.
-- Auteur : Agent BDD — Date : 2026-06

-- ---------------------------------------------------------------------------
-- profils : chacun voit/modifie son propre profil (auth.uid() = id)
-- ---------------------------------------------------------------------------
ALTER TABLE profils ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture son profil"
  ON profils FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Modification son profil"
  ON profils FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- proches : l'utilisateur ne voit/modifie que ses propres proches (user_id)
-- ---------------------------------------------------------------------------
ALTER TABLE proches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture ses proches"
  ON proches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Modification ses proches"
  ON proches FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- proche_tags : pas de user_id direct -> on passe par le proche propriétaire
-- ---------------------------------------------------------------------------
ALTER TABLE proche_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture tags de ses proches"
  ON proche_tags FOR SELECT
  USING (
    proche_id IN (SELECT id FROM proches WHERE user_id = auth.uid())
  );

CREATE POLICY "Modification tags de ses proches"
  ON proche_tags FOR ALL
  USING (
    proche_id IN (SELECT id FROM proches WHERE user_id = auth.uid())
  )
  WITH CHECK (
    proche_id IN (SELECT id FROM proches WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- evenements : pas de user_id direct -> on passe par le proche propriétaire
-- ---------------------------------------------------------------------------
ALTER TABLE evenements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture evenements de ses proches"
  ON evenements FOR SELECT
  USING (
    proche_id IN (SELECT id FROM proches WHERE user_id = auth.uid())
  );

CREATE POLICY "Modification evenements de ses proches"
  ON evenements FOR ALL
  USING (
    proche_id IN (SELECT id FROM proches WHERE user_id = auth.uid())
  )
  WITH CHECK (
    proche_id IN (SELECT id FROM proches WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- swipes : pas de user_id direct -> on passe par le proche propriétaire
-- ---------------------------------------------------------------------------
ALTER TABLE swipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture swipes de ses proches"
  ON swipes FOR SELECT
  USING (
    proche_id IN (SELECT id FROM proches WHERE user_id = auth.uid())
  );

CREATE POLICY "Modification swipes de ses proches"
  ON swipes FOR ALL
  USING (
    proche_id IN (SELECT id FROM proches WHERE user_id = auth.uid())
  )
  WITH CHECK (
    proche_id IN (SELECT id FROM proches WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- propositions : pas de user_id direct -> on passe par le proche propriétaire
-- ---------------------------------------------------------------------------
ALTER TABLE propositions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture propositions de ses proches"
  ON propositions FOR SELECT
  USING (
    proche_id IN (SELECT id FROM proches WHERE user_id = auth.uid())
  );

CREATE POLICY "Modification propositions de ses proches"
  ON propositions FOR ALL
  USING (
    proche_id IN (SELECT id FROM proches WHERE user_id = auth.uid())
  )
  WITH CHECK (
    proche_id IN (SELECT id FROM proches WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Tables catalogue : lecture publique, aucune écriture publique.
-- RLS activé + uniquement une policy SELECT pour tous (anon + authenticated).
-- L'absence de policy INSERT/UPDATE/DELETE bloque toute écriture publique ;
-- le seed se fait via la service_role key qui contourne la RLS.
-- ---------------------------------------------------------------------------
ALTER TABLE cadeaux ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture publique des cadeaux"
  ON cadeaux FOR SELECT
  USING (true);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture publique des tags"
  ON tags FOR SELECT
  USING (true);

ALTER TABLE cadeau_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture publique des cadeau_tags"
  ON cadeau_tags FOR SELECT
  USING (true);
