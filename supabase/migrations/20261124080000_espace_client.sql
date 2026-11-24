-- Espace client du Millésime : à coller dans Supabase > SQL Editor > Run (une seule fois).
-- Uniquement des ajouts : aucune donnée n'est supprimée.

create table if not exists public.clients (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  prenom text not null default '' check (char_length(prenom) <= 80),
  telephone text check (telephone is null or char_length(telephone) <= 30),
  newsletter boolean not null default false
);
alter table public.clients enable row level security;

create or replace function public.email_confirme()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select u.email_confirmed_at is not null from auth.users u where u.id = (select auth.uid())), false); $$;
revoke execute on function public.email_confirme() from public, anon;
grant execute on function public.email_confirme() to authenticated;

create or replace function public.creer_fiche_client()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(new.raw_user_meta_data->>'type', '') = 'client' then
    insert into public.clients (user_id, prenom, telephone, newsletter)
    values (new.id,
      left(coalesce(new.raw_user_meta_data->>'prenom', ''), 80),
      nullif(left(coalesce(new.raw_user_meta_data->>'telephone', ''), 30), ''),
      coalesce((new.raw_user_meta_data->>'newsletter')::boolean, false))
    on conflict (user_id) do nothing;
  end if;
  return new;
end $$;
revoke execute on function public.creer_fiche_client() from public, anon, authenticated;
drop trigger if exists apres_inscription_client on auth.users;
create trigger apres_inscription_client after insert on auth.users
  for each row execute function public.creer_fiche_client();

create or replace function public.supprimer_mon_compte()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'non connecte'; end if;
  if exists (select 1 from public.admins a where a.user_id = (select auth.uid())) then raise exception 'compte administrateur'; end if;
  delete from auth.users where id = (select auth.uid());
end $$;
revoke execute on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;

create or replace function public.export_clients()
returns table (created_at timestamptz, prenom text, email text, telephone text, newsletter boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.est_admin() then raise exception 'acces refuse'; end if;
  return query select c.created_at, c.prenom, u.email::text, c.telephone, c.newsletter
    from public.clients c join auth.users u on u.id = c.user_id order by c.created_at desc;
end $$;
revoke execute on function public.export_clients() from public, anon;
grant execute on function public.export_clients() to authenticated;

drop policy if exists "clients: lecture de sa fiche" on public.clients;
create policy "clients: lecture de sa fiche" on public.clients for select to authenticated using (user_id = (select auth.uid()) or (select public.est_admin()));
drop policy if exists "clients: modif de sa fiche" on public.clients;
create policy "clients: modif de sa fiche" on public.clients for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "inscrits: le client voit ses gains" on public.inscrits;
create policy "inscrits: le client voit ses gains" on public.inscrits for select to authenticated
  using (lower(email) = lower((select auth.jwt()->>'email')) and (select public.email_confirme()));
drop policy if exists "demandes: le client voit ses demandes" on public.demandes;
create policy "demandes: le client voit ses demandes" on public.demandes for select to authenticated
  using (lower(email) = lower((select auth.jwt()->>'email')) and (select public.email_confirme()));
create index if not exists demandes_email_idx on public.demandes (lower(email));

-- Récupère les comptes clients créés avant l'installation de ce script
insert into public.clients (user_id, prenom, telephone, newsletter)
select u.id, left(coalesce(u.raw_user_meta_data->>'prenom', ''), 80),
  nullif(left(coalesce(u.raw_user_meta_data->>'telephone', ''), 30), ''),
  coalesce((u.raw_user_meta_data->>'newsletter')::boolean, false)
from auth.users u
where coalesce(u.raw_user_meta_data->>'type', '') = 'client'
on conflict (user_id) do nothing;
