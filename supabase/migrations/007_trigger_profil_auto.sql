-- Migration 007 : création automatique du profil à l'inscription
-- Description : un trigger sur auth.users crée la ligne `profils` correspondante
--               pour TOUT nouvel utilisateur (inscription email ET OAuth Google).
--               Indispensable car proches.user_id référence profils(id) NOT NULL :
--               sans profil, un utilisateur OAuth ne pourrait pas créer de proche.
--               Le prénom vient des métadonnées (prenom fourni au signUp email, ou
--               full_name/name fourni par Google), avec repli sur la partie locale
--               de l'e-mail (profils.prenom est NOT NULL).
-- Auteur : Agent BDD — Date : 2026-06

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profils (id, prenom, nom)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'prenom', ''),
      nullif(split_part(coalesce(new.raw_user_meta_data ->> 'full_name',
                                 new.raw_user_meta_data ->> 'name', ''), ' ', 1), ''),
      split_part(new.email, '@', 1)
    ),
    nullif(new.raw_user_meta_data ->> 'nom', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
