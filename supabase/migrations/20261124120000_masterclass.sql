-- Masterclass du Millésime : à coller dans Supabase > SQL Editor > Run (une seule fois).
-- Uniquement des ajouts : aucune donnée existante n'est modifiée ni supprimée.
-- Principe : le client enregistre sa carte (empreinte, aucun débit), paie sur place,
-- et n'est prélevé du prix complet que s'il ne vient pas sans avoir annulé 48 h avant.

create table if not exists public.masterclasses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  titre text not null check (char_length(titre) between 1 and 120),
  description text not null default '' check (char_length(description) <= 3000),
  debut timestamptz not null,
  duree_minutes int not null default 120 check (duree_minutes between 15 and 720),
  prix_cents int not null check (prix_cents between 100 and 500000),
  places int not null check (places between 1 and 500),
  photo text check (photo is null or char_length(photo) <= 500),
  publiee boolean not null default false
);
alter table public.masterclasses enable row level security;

create table if not exists public.reservations_mc (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  masterclass_id uuid not null references public.masterclasses(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  prenom text not null default '',
  telephone text,
  statut text not null default 'carte_en_attente' check (statut in
    ('carte_en_attente', 'confirmee', 'annulee', 'venu', 'debit_en_cours', 'absent_debite', 'absent_echec', 'absent_excuse')),
  jeton uuid not null default gen_random_uuid() unique,
  conditions_acceptees_le timestamptz,
  stripe_customer text,
  stripe_setup_intent text,
  stripe_payment_method text,
  stripe_payment_intent text,
  montant_debite_cents int,
  erreur text,
  pointe_le timestamptz,
  annulee_le timestamptz,
  debite_le timestamptz
);
alter table public.reservations_mc enable row level security;
create unique index if not exists reservations_mc_une_par_client
  on public.reservations_mc (masterclass_id, user_id) where statut <> 'annulee';
create index if not exists reservations_mc_masterclass_idx on public.reservations_mc (masterclass_id);
create index if not exists reservations_mc_user_idx on public.reservations_mc (user_id);

-- Masterclass : tout le monde voit celles qui sont publiées, seuls les administrateurs gèrent.
drop policy if exists "masterclasses: lecture" on public.masterclasses;
create policy "masterclasses: lecture" on public.masterclasses for select to authenticated
  using (publiee or (select public.est_admin()));
drop policy if exists "masterclasses: lecture visiteurs" on public.masterclasses;
create policy "masterclasses: lecture visiteurs" on public.masterclasses for select to anon using (publiee);
drop policy if exists "masterclasses: ajout admin" on public.masterclasses;
create policy "masterclasses: ajout admin" on public.masterclasses for insert to authenticated with check ((select public.est_admin()));
drop policy if exists "masterclasses: modif admin" on public.masterclasses;
create policy "masterclasses: modif admin" on public.masterclasses for update to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));
drop policy if exists "masterclasses: suppression admin" on public.masterclasses;
create policy "masterclasses: suppression admin" on public.masterclasses for delete to authenticated using ((select public.est_admin()));

-- Réservations : le client voit les siennes, l'administrateur voit tout.
-- Aucune écriture directe depuis le navigateur : tout passe par la fonction serveur « masterclass ».
drop policy if exists "reservations_mc: lecture" on public.reservations_mc;
create policy "reservations_mc: lecture" on public.reservations_mc for select to authenticated
  using (user_id = (select auth.uid()) or (select public.est_admin()));

-- Places restantes : une carte en cours de saisie bloque la place 30 minutes.
create or replace function public.places_prises(p_mc uuid)
returns int language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.reservations_mc r
  where r.masterclass_id = p_mc
    and (r.statut in ('confirmee', 'venu', 'debit_en_cours', 'absent_debite', 'absent_echec', 'absent_excuse')
         or (r.statut = 'carte_en_attente' and r.created_at > now() - interval '30 minutes'));
$$;
revoke execute on function public.places_prises(uuid) from public, anon, authenticated;

create or replace function public.masterclasses_a_venir()
returns table (id uuid, titre text, description text, debut timestamptz, duree_minutes int,
               prix_cents int, places int, photo text, places_restantes int)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.titre, m.description, m.debut, m.duree_minutes, m.prix_cents, m.places, m.photo,
         greatest(m.places - public.places_prises(m.id), 0)
  from public.masterclasses m
  where m.publiee and m.debut > now()
  order by m.debut;
$$;
revoke execute on function public.masterclasses_a_venir() from public;
grant execute on function public.masterclasses_a_venir() to anon, authenticated;

-- Réservation atomique (deux clients ne peuvent pas prendre la dernière place en même temps).
-- Appelée uniquement par la fonction serveur.
create or replace function public.reserver_place(p_mc uuid, p_user uuid, p_email text, p_prenom text, p_tel text)
returns public.reservations_mc
language plpgsql security definer set search_path = ''
as $$
declare
  m public.masterclasses;
  r public.reservations_mc;
begin
  select * into m from public.masterclasses where id = p_mc for update;
  if not found or not m.publiee then raise exception 'introuvable'; end if;
  if m.debut <= now() then raise exception 'passee'; end if;

  select * into r from public.reservations_mc
   where masterclass_id = p_mc and user_id = p_user and statut <> 'annulee' limit 1;
  if found then
    if r.statut = 'carte_en_attente' then
      -- Place expirée (carte non saisie depuis 30 min) : on revérifie qu'il en reste une
      if r.created_at <= now() - interval '30 minutes' and public.places_prises(p_mc) >= m.places then
        raise exception 'complet';
      end if;
      update public.reservations_mc set created_at = now(), prenom = p_prenom, telephone = p_tel,
        conditions_acceptees_le = now() where id = r.id returning * into r;
    end if;
    return r;
  end if;

  if public.places_prises(p_mc) >= m.places then raise exception 'complet'; end if;

  insert into public.reservations_mc (masterclass_id, user_id, email, prenom, telephone, conditions_acceptees_le)
  values (p_mc, p_user, lower(p_email), left(p_prenom, 80), left(p_tel, 30), now())
  returning * into r;
  return r;
end $$;
revoke execute on function public.reserver_place(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.reserver_place(uuid, uuid, text, text, text) to service_role;
