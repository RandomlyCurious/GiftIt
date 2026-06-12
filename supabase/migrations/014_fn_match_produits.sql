-- Migration 014 : fonction de recherche vectorielle des produits (matching v2)
-- Description : couches 1 (filtres durs SQL) + 2 (retrieval pgvector) du moteur v2,
--               en une seule requête. Retourne les N produits les plus proches
--               sémantiquement du vecteur du proche, après élimination des produits
--               inactifs, swipés à gauche, ou déjà offerts. Le reranking LLM
--               (couche 3) est fait ensuite par l'Edge Function generate-panel.
--               Additif, n'affecte pas le matching tags. Exécution réservée au
--               service_role (la fonction prend un proche_id en paramètre).
-- Auteur : Agent BDD — Date : 2026-06

create or replace function public.match_produits(
  query_embedding vector(1536),
  p_proche_id uuid,
  match_count int default 20
)
returns table (
  id uuid,
  nom text,
  categorie text,
  description_matching text,
  score_originalite int,
  prix_min numeric,
  prix_max numeric,
  url_produit text,
  distance float
)
language sql
stable
set search_path = public  -- nécessaire pour résoudre l'opérateur pgvector <=>
as $$
  select
    p.id, p.nom, p.categorie, p.description_matching, p.score_originalite,
    p.prix_min, p.prix_max, p.url_produit,
    (p.embedding <=> query_embedding) as distance
  from public.produits p
  where p.actif = true
    and p.embedding is not null
    -- couche 1 : on exclut les produits swipés à gauche par ce proche
    and not exists (
      select 1 from public.swipes s
      where s.proche_id = p_proche_id
        and s.produit_id = p.id
        and s.direction = 'gauche'
    )
    -- couche 1 : on exclut les produits déjà offerts à ce proche
    and not exists (
      select 1 from public.propositions pr
      where pr.proche_id = p_proche_id
        and pr.produit_id = p.id
        and pr.offert = true
    )
  order by p.embedding <=> query_embedding   -- couche 2 : plus proches d'abord
  limit match_count;
$$;

-- Données sensibles indirectes (prend un proche_id) : réservé au service_role.
revoke all on function public.match_produits(vector, uuid, int) from public, anon, authenticated;
grant execute on function public.match_produits(vector, uuid, int) to service_role;
