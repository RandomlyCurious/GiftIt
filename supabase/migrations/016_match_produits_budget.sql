-- Migration 016 : ajout du filtre budget à match_produits (Tranche 3, D4)
-- Description : remplace match_produits pour intégrer la fourchette de budget du
--               proche dans la couche 1 (filtres durs). Paramètres budget avec
--               défaut NULL = pas de filtre (rétrocompatible avec l'appel actuel).
--               Modification explicitement validée (D4). N'affecte pas le matching
--               tags. Réservé au service_role.
-- Auteur : Agent BDD — Date : 2026-06

drop function if exists public.match_produits(vector, uuid, int);

create or replace function public.match_produits(
  query_embedding vector(1536),
  p_proche_id uuid,
  match_count int default 20,
  p_budget_min numeric default null,
  p_budget_max numeric default null
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
set search_path = public
as $$
  select
    p.id, p.nom, p.categorie, p.description_matching, p.score_originalite,
    p.prix_min, p.prix_max, p.url_produit,
    (p.embedding <=> query_embedding) as distance
  from public.produits p
  where p.actif = true
    and p.embedding is not null
    -- couche 1 : budget (NULL = pas de contrainte). On garde les produits dont la
    -- fourchette de prix recoupe le budget du proche.
    and (p_budget_max is null or p.prix_min <= p_budget_max)
    and (p_budget_min is null or p.prix_max >= p_budget_min)
    -- couche 1 : exclusions swipés gauche / déjà offerts
    and not exists (
      select 1 from public.swipes s
      where s.proche_id = p_proche_id and s.produit_id = p.id and s.direction = 'gauche'
    )
    and not exists (
      select 1 from public.propositions pr
      where pr.proche_id = p_proche_id and pr.produit_id = p.id and pr.offert = true
    )
  order by p.embedding <=> query_embedding   -- couche 2 : pgvector
  limit match_count;
$$;

revoke all on function public.match_produits(vector, uuid, int, numeric, numeric) from public, anon, authenticated;
grant execute on function public.match_produits(vector, uuid, int, numeric, numeric) to service_role;
