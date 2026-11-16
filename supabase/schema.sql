-- Team Fun Hub: one-time database setup for Supabase.
--
-- HOW TO USE
--   1. On the line marked CHANGE THIS below, replace CHANGE-ME with your team passcode.
--   2. In Supabase, open "SQL Editor", paste this whole file, and press Run.
--   Running it again later is safe: it keeps your data and just updates the passcode.
--
-- WHAT IT SETS UP
--   * One table, "records", holding the games, players and results.
--   * Anyone with the site link can READ it.
--   * Nobody can change it directly. Changes go through two functions that
--     first check the team passcode (stored scrambled, never as plain text).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.records (
  kind text not null check (kind in ('games', 'players', 'plays')),
  id text not null check (char_length(id) between 1 and 80),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (kind, id)
);

alter table public.records enable row level security;

drop policy if exists "anyone can read records" on public.records;
create policy "anyone can read records" on public.records for select using (true);
-- There are deliberately no insert/update/delete policies: direct changes are refused.

create table if not exists public.tf_secret (
  id int primary key default 1 check (id = 1),
  passcode_hash text not null
);

alter table public.tf_secret enable row level security;
-- No policies at all: the passcode table cannot be read or changed through the site.

insert into public.tf_secret (id, passcode_hash)
values (1, extensions.crypt('CHANGE-ME', extensions.gen_salt('bf')))  -- <-- CHANGE THIS
on conflict (id) do update set passcode_hash = excluded.passcode_hash;

create or replace function public.tf_check(p_passcode text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not exists (
    select 1 from public.tf_secret where passcode_hash = crypt(coalesce(p_passcode, ''), passcode_hash)
  ) then
    raise exception 'bad passcode';
  end if;
end;
$$;

create or replace function public.tf_upsert(p_passcode text, p_kind text, p_id text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.tf_check(p_passcode);
  if pg_column_size(p_data) > 20000 then
    raise exception 'record too large';
  end if;
  insert into public.records (kind, id, data)
  values (p_kind, p_id, p_data)
  on conflict (kind, id) do update set data = excluded.data, updated_at = now();
end;
$$;

create or replace function public.tf_delete(p_passcode text, p_kind text, p_id text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.tf_check(p_passcode);
  delete from public.records where kind = p_kind and id = p_id;
end;
$$;

revoke all on function public.tf_check(text) from public, anon, authenticated;
revoke all on function public.tf_upsert(text, text, text, jsonb) from public;
revoke all on function public.tf_delete(text, text, text) from public;
grant execute on function public.tf_upsert(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.tf_delete(text, text, text) to anon, authenticated;

-- Starter game cards (skipped if they already exist).
insert into public.records (kind, id, data) values
  ('games', 'top100', '{"name":"Top 100","url":"top100.html","kind":"competitive","builtin":true,"inWheel":true}'),
  ('games', 'closest', '{"name":"Closest Guess","url":"closest.html","kind":"competitive","builtin":true,"inWheel":true}'),
  ('games', 'link', '{"name":"Guess the Link","url":"link.html","kind":"collab","builtin":true,"inWheel":true}'),
  ('games', 'krillion', '{"name":"Krillion","url":"https://krillion.io/","kind":"collab","inWheel":true}'),
  ('games', 'noillurk', '{"name":"Noillurk","url":"","kind":"collab","inWheel":true}'),
  ('games', 'crosstunes', '{"name":"Crosstunes","url":"","kind":"collab","inWheel":true}'),
  ('games', 'spotle', '{"name":"Spotle","url":"https://spotle.io/","kind":"collab","inWheel":true}'),
  ('games', 'connections', '{"name":"NYT Connections","url":"https://www.nytimes.com/games/connections","kind":"collab","inWheel":true}'),
  ('games', 'contexto', '{"name":"Contexto","url":"https://contexto.me/","kind":"collab","inWheel":true}'),
  ('games', 'bonk', '{"name":"Bonk","url":"https://bonk.io/","kind":"competitive","inWheel":true}'),
  ('games', 'geoguessr', '{"name":"GeoGuessr","url":"https://www.geoguessr.com/","kind":"collab","inWheel":true}'),
  ('games', 'garticphone', '{"name":"Gartic Phone","url":"https://garticphone.com/","kind":"collab","inWheel":true}')
on conflict (kind, id) do nothing;
