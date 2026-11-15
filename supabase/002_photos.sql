-- =====================================================================
--  Update 002: logos for groups / organisations, photos for members.
--  For an EXISTING project: paste this whole file into Supabase → SQL Editor → Run.
--  (New projects get it automatically at the end of schema.sql.)
--  Safe to run more than once.
-- =====================================================================

alter table public.groups        add column if not exists logo_path  text;
alter table public.organisations add column if not exists logo_path  text;
alter table public.members       add column if not exists photo_path text;

-- Two storage folders ("buckets"):
--   logos          public  — group / organisation logos (not sensitive, anyone with the link can view)
--   member-photos  private — only people allowed to see that member's organisation can view
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('logos',         'logos',         true,  1048576, array['image/webp','image/png','image/jpeg']),
  ('member-photos', 'member-photos', false, 1048576, array['image/webp','image/png','image/jpeg'])
on conflict (id) do nothing;

-- Text → uuid without throwing on bad input.
create or replace function public.try_uuid(t text) returns uuid
language plpgsql immutable as $$
begin
  return t::uuid;
exception when others then
  return null;
end $$;

-- Organisation of a member, ignoring row security (used by the photo rules below).
create or replace function public.member_org(p_member uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from members where id = p_member;
$$;

-- Role of the current user for the member a photo file belongs to.
-- Photo files are stored as  <member id>/<timestamp>.webp
create or replace function public.photo_role(p_name text) returns text
language sql stable security definer set search_path = public as $$
  select public.org_role(public.member_org(public.try_uuid(split_part(p_name, '/', 1))));
$$;

drop policy if exists "admin uploads logos"           on storage.objects;
drop policy if exists "admin updates logos"           on storage.objects;
drop policy if exists "admin deletes logos"           on storage.objects;
drop policy if exists "admin lists logos"             on storage.objects;
drop policy if exists "view member photos"            on storage.objects;
drop policy if exists "editors upload member photos"  on storage.objects;
drop policy if exists "editors update member photos"  on storage.objects;
drop policy if exists "editors delete member photos"  on storage.objects;

-- Logos: only the admin can add, change or remove them.
create policy "admin lists logos" on storage.objects for select to authenticated
  using (bucket_id = 'logos' and public.is_admin());
create policy "admin uploads logos" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.is_admin());
create policy "admin updates logos" on storage.objects for update to authenticated
  using (bucket_id = 'logos' and public.is_admin());
create policy "admin deletes logos" on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and public.is_admin());

-- Member photos: viewers of the organisation can see; editors and the admin can change.
create policy "view member photos" on storage.objects for select to authenticated
  using (bucket_id = 'member-photos' and public.photo_role(name) is not null);
create policy "editors upload member photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'member-photos' and public.photo_role(name) in ('admin', 'editor'));
create policy "editors update member photos" on storage.objects for update to authenticated
  using (bucket_id = 'member-photos' and public.photo_role(name) in ('admin', 'editor'));
create policy "editors delete member photos" on storage.objects for delete to authenticated
  using (bucket_id = 'member-photos' and public.photo_role(name) in ('admin', 'editor'));
