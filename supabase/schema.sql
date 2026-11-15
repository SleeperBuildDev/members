-- =====================================================================
--  Member Registry — Supabase database setup
--  Paste this whole file into Supabase → SQL Editor → New query → Run.
--  Safe to run once on a fresh project.
-- =====================================================================


-- ---------------------------------------------------------------------
--  Tables
-- ---------------------------------------------------------------------

-- One row per login account. The first account ever created becomes admin.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  is_admin    boolean not null default false,
  status      text not null default 'pending' check (status in ('pending','active','disabled')),
  created_at  timestamptz not null default now()
);

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  name_en     text not null default '',
  created_at  timestamptz not null default now()
);

create table public.organisations (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete restrict,
  name        text not null,
  name_en     text not null default '',
  created_at  timestamptz not null default now()
);
create index on public.organisations(group_id);

-- Access grants: a user gets a role on a whole group OR on one organisation.
create table public.access (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  group_id    uuid references public.groups(id) on delete cascade,
  org_id      uuid references public.organisations(id) on delete cascade,
  role        text not null check (role in ('editor','viewer')),
  created_at  timestamptz not null default now(),
  check ((group_id is null) <> (org_id is null))
);
create unique index access_user_group on public.access(user_id, group_id) where group_id is not null;
create unique index access_user_org   on public.access(user_id, org_id)   where org_id   is not null;

create table public.members (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organisations(id) on delete restrict,
  name              text not null,
  name_en           text not null default '',
  position          text not null default '',
  birth_date        date,
  nrc_state         smallint check (nrc_state between 1 and 14),
  nrc_township      text not null default '',
  nrc_type          text not null default '',
  nrc_number        text not null default '' check (nrc_number ~ '^[0-9]{0,6}$'),
  address_region    text not null default '',
  address_township  text not null default '',
  address_street    text not null default '',
  phone             text not null default '',
  status            text not null default 'active' check (status in ('active','inactive')),
  notes             text not null default '',
  search_text       text generated always as (
                      lower(
                        name || ' ' || name_en || ' ' || position || ' ' || phone || ' ' ||
                        coalesce(nrc_state::text, '') || '/' || nrc_township || '(' || nrc_type || ')' || nrc_number || ' ' ||
                        nrc_number || ' ' || address_region || ' ' || address_township || ' ' || address_street || ' ' || notes
                      )
                    ) stored,
  deleted_at        timestamptz,
  deleted_by        uuid references public.profiles(id),
  created_by        uuid references public.profiles(id) default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_by        uuid references public.profiles(id),
  updated_at        timestamptz not null default now()
);
create index on public.members(org_id) where deleted_at is null;
create index on public.members(phone);
create index on public.members(nrc_state, nrc_township, nrc_type, nrc_number);

create table public.activity_log (
  id          bigint generated always as identity primary key,
  user_id     uuid references public.profiles(id) on delete set null,
  user_email  text not null default '',
  action      text not null,          -- created | updated | deleted | restored | purged | nrc_viewed
  member_id   uuid,
  member_name text not null default '',
  org_id      uuid,
  created_at  timestamptz not null default now()
);
create index on public.activity_log(created_at desc);

-- ---------------------------------------------------------------------
--  Permission helpers (SECURITY DEFINER so policies can call them safely)
-- ---------------------------------------------------------------------

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin and status = 'active' from profiles where id = auth.uid()), false);
$$;

create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'active' from profiles where id = auth.uid()), false);
$$;

-- Returns 'admin', 'editor', 'viewer' or null for the current user on an organisation.
create or replace function public.org_role(p_org uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when public.is_admin() then 'admin'
    when not public.is_active() then null
    else (
      select case when bool_or(a.role = 'editor') then 'editor' else 'viewer' end
      from access a
      join organisations o on o.id = p_org
      where a.user_id = auth.uid() and (a.org_id = p_org or a.group_id = o.group_id)
      having count(*) > 0
    )
  end;
$$;

create or replace function public.can_view_group(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (public.is_active() and exists (
    select 1 from access a
    left join organisations o on o.id = a.org_id
    where a.user_id = auth.uid() and (a.group_id = p_group or o.group_id = p_group)
  ));
$$;

-- ---------------------------------------------------------------------
--  Triggers
-- ---------------------------------------------------------------------

-- New sign-up → profile. Very first account becomes the active admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare first_user boolean;
begin
  select not exists (select 1 from profiles) into first_user;
  insert into profiles (id, email, full_name, is_admin, status)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''),
          first_user, case when first_user then 'active' else 'pending' end);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Members: stamp who/when, block editors from deleting via update, write the log.
create or replace function public.members_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if (new.deleted_at is distinct from old.deleted_at) and auth.uid() is not null and not public.is_admin() then
      raise exception 'Only the admin can delete or restore members';
    end if;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), old.updated_by);
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  else
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_by := coalesce(auth.uid(), new.created_by);
  end if;
  return new;
end $$;

create trigger members_before_write before insert or update on public.members
  for each row execute function public.members_before_write();

create or replace function public.members_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare act text; rec record;
begin
  if tg_op = 'DELETE' then rec := old; act := 'purged';
  elsif tg_op = 'INSERT' then rec := new; act := 'created';
  elsif old.deleted_at is null and new.deleted_at is not null then rec := new; act := 'deleted';
  elsif old.deleted_at is not null and new.deleted_at is null then rec := new; act := 'restored';
  else rec := new; act := 'updated';
  end if;
  insert into activity_log (user_id, user_email, action, member_id, member_name, org_id)
  values (auth.uid(), coalesce((select email from profiles where id = auth.uid()), ''),
          act, rec.id, rec.name, rec.org_id);
  return null;
end $$;

create trigger members_after_write after insert or update or delete on public.members
  for each row execute function public.members_after_write();

-- Users may edit their own name but never their own admin flag or status.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null for the project owner (SQL editor / dashboard), who may change anything.
  if auth.uid() is not null and not public.is_admin() then
    new.is_admin := old.is_admin;
    new.status   := old.status;
    new.email    := old.email;
  end if;
  if old.id = auth.uid() and old.is_admin and (not new.is_admin or new.status <> 'active') then
    raise exception 'You cannot remove your own admin access';
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- Log when someone reveals a full NRC number.
create or replace function public.log_nrc_view(p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select id, name, org_id into m from members where id = p_member;
  if m.id is null or public.org_role(m.org_id) is null then return; end if;
  insert into activity_log (user_id, user_email, action, member_id, member_name, org_id)
  values (auth.uid(), coalesce((select email from profiles where id = auth.uid()), ''),
          'nrc_viewed', m.id, m.name, m.org_id);
end $$;

-- Remove members that have been in the recycle bin for more than 30 days (admin only).
create or replace function public.purge_old_deleted() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  delete from members where deleted_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;

-- Duplicate check across ALL organisations; only says yes/no, never who.
create or replace function public.check_duplicates(
  p_state smallint, p_township text, p_type text, p_number text, p_phone text, p_exclude uuid
) returns table(nrc boolean, phone boolean)
language sql stable security definer set search_path = public as $$
  select
    coalesce(p_number <> '' and exists (
      select 1 from members m where m.deleted_at is null and m.id is distinct from p_exclude
        and m.nrc_state = p_state and m.nrc_township = p_township and m.nrc_type = p_type and m.nrc_number = p_number
    ), false),
    coalesce(p_phone <> '' and exists (
      select 1 from members m where m.deleted_at is null and m.id is distinct from p_exclude and m.phone = p_phone
    ), false)
  where public.is_active();
$$;

-- Filter choices (positions / townships) and member counts — run with the caller's
-- permissions, so users only ever see values from organisations they can access.
create or replace function public.member_facets() returns table(kind text, value text)
language sql stable as $$
  select distinct 'position', position from members where deleted_at is null and position <> ''
  union
  select distinct 'township', address_township from members where deleted_at is null and address_township <> '';
$$;

create or replace function public.member_counts() returns table(org_id uuid, n bigint)
language sql stable as $$
  select org_id, count(*) from members where deleted_at is null group by org_id;
$$;

-- Tiny function the keep-alive GitHub Action calls so the free project never pauses.
create or replace function public.ping() returns text language sql as $$ select 'ok' $$;

-- ---------------------------------------------------------------------
--  Row Level Security — the database itself enforces who sees what
-- ---------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.groups        enable row level security;
alter table public.organisations enable row level security;
alter table public.access        enable row level security;
alter table public.members       enable row level security;
alter table public.activity_log  enable row level security;

-- profiles
create policy "see self or admin sees all" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "update self or admin" on public.profiles for update
  using (id = auth.uid() or public.is_admin());

-- groups
create policy "view permitted groups" on public.groups for select
  using (public.can_view_group(id));
create policy "admin manages groups" on public.groups for all
  using (public.is_admin()) with check (public.is_admin());

-- organisations
create policy "view permitted orgs" on public.organisations for select
  using (public.org_role(id) is not null);
create policy "admin manages orgs" on public.organisations for all
  using (public.is_admin()) with check (public.is_admin());

-- access
create policy "see own access or admin" on public.access for select
  using (user_id = auth.uid() or public.is_admin());
create policy "admin manages access" on public.access for all
  using (public.is_admin()) with check (public.is_admin());

-- members
create policy "view members" on public.members for select
  using (public.org_role(org_id) is not null and (deleted_at is null or public.is_admin()));
create policy "editors add members" on public.members for insert
  with check (public.org_role(org_id) in ('admin','editor'));
create policy "editors edit members" on public.members for update
  using (public.org_role(org_id) in ('admin','editor') and (deleted_at is null or public.is_admin()))
  with check (public.org_role(org_id) in ('admin','editor'));
create policy "admin purges members" on public.members for delete
  using (public.is_admin());

-- activity log (written only by triggers / functions above)
create policy "admin reads log" on public.activity_log for select
  using (public.is_admin());

grant execute on function public.ping() to anon;

-- Photos and logos: run supabase/002_photos.sql after this file.
