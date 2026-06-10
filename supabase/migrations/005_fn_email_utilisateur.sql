-- Migration 005 : fonction de résolution user_id -> e-mail
-- Description : expose de façon contrôlée l'e-mail (auth.users) pour les
--               workflows N8n (rappels). SECURITY DEFINER + search_path vide
--               pour éviter le détournement de search_path. Exécution réservée
--               au rôle service_role (l'e-mail est une donnée sensible).
-- Auteur : Agent BDD — Date : 2026-06

create or replace function public.email_utilisateur(uid uuid)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select email::text from auth.users where id = uid;
$$;

-- On retire l'exécution à tout le monde, puis on l'accorde au seul service_role.
revoke all on function public.email_utilisateur(uuid) from public, anon, authenticated;
grant execute on function public.email_utilisateur(uuid) to service_role;
