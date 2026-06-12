-- Migration 010 : pont evenements -> declencheurs (support US-B3)
-- Description : backfill des événements existants en déclencheurs type 'evenement'
--               + trigger de synchro DÉFENSIF (AFTER + gestion d'exception) pour
--               qu'un échec de synchro ne bloque JAMAIS l'écriture sur evenements.
--               Isolé dans sa propre migration pour un rollback simple. 100 %
--               additif : la table evenements et sa logique de dates sont intactes.
-- Auteur : Agent BDD — Date : 2026-06

-- 1. Backfill idempotent : un déclencheur 'evenement' par événement existant.
INSERT INTO declencheurs (proche_id, type, evenement_id, actif)
SELECT e.proche_id, 'evenement', e.id, e.actif
FROM evenements e
WHERE NOT EXISTS (
  SELECT 1 FROM declencheurs d WHERE d.evenement_id = e.id
);

-- 2. Invariant : au plus un déclencheur par événement.
CREATE UNIQUE INDEX idx_declencheurs_evenement_unique
  ON declencheurs (evenement_id) WHERE evenement_id IS NOT NULL;

-- 3. Fonction de synchro DÉFENSIVE.
--    Le corps est encapsulé dans un bloc EXCEPTION : toute erreur de synchro est
--    capturée (WARNING) et NE remonte PAS, donc l'écriture sur evenements aboutit
--    quoi qu'il arrive (exigence explicite).
CREATE OR REPLACE FUNCTION public.sync_declencheur_evenement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    IF (TG_OP = 'INSERT') THEN
      INSERT INTO public.declencheurs (proche_id, type, evenement_id, actif)
      VALUES (NEW.proche_id, 'evenement', NEW.id, NEW.actif);
    ELSIF (TG_OP = 'UPDATE') THEN
      UPDATE public.declencheurs
        SET actif = NEW.actif, proche_id = NEW.proche_id
        WHERE evenement_id = NEW.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'sync_declencheur_evenement: echec pour evenement % (%)',
      NEW.id, SQLERRM;
  END;
  RETURN NULL;  -- trigger AFTER : la valeur de retour est ignorée
END;
$$;

-- 4. Trigger AFTER : la ligne evenements est déjà persistée quand il s'exécute.
--    Pas de gestion DELETE : le FK declencheurs.evenement_id ON DELETE CASCADE
--    supprime automatiquement le déclencheur quand l'événement est supprimé.
CREATE TRIGGER trg_sync_declencheur_evenement
  AFTER INSERT OR UPDATE ON evenements
  FOR EACH ROW EXECUTE FUNCTION public.sync_declencheur_evenement();
