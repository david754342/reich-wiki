-- =====================================================================
-- Reich Wiki – Datenbank, Zugriffsregeln und Speicher für Anhänge
-- Ausführen mit:  supabase db query --linked -f supabase/migrations/20261110000000_reich_wiki.sql
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Profile (ein Datensatz pro Zugang; angelegt über die Funktion "zugaenge")
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  display_name  text not null,
  role          text not null default 'mitarbeiter' check (role in ('chef', 'mitarbeiter')),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

create or replace function public.is_chef()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'chef');
$$;

-- ---------------------------------------------------------------------
-- Kategorien
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id    bigint generated always as identity primary key,
  name  text not null unique,
  sort  int  not null default 100
);

-- ---------------------------------------------------------------------
-- Wiki-Einträge (vom Chef gepflegt)
-- ---------------------------------------------------------------------
create table if not exists public.entries (
  id           bigint generated always as identity primary key,
  title        text not null check (length(title) between 3 and 300),
  answer       text not null check (length(answer) between 1 and 20000),
  category_id  bigint references public.categories (id) on delete set null,
  keywords     text not null default '',
  attachments  jsonb not null default '[]'::jsonb,
  is_example   boolean not null default false,
  created_by   uuid references public.profiles (id) on delete set null,
  updated_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  search       tsvector generated always as (
                 setweight(to_tsvector('german', coalesce(title, '')), 'A') ||
                 setweight(to_tsvector('german', coalesce(keywords, '')), 'A') ||
                 setweight(to_tsvector('german', coalesce(answer, '')), 'B')
               ) stored
);
create index if not exists entries_search_idx on public.entries using gin (search);
create index if not exists entries_title_trgm_idx on public.entries using gin (title extensions.gin_trgm_ops);
create index if not exists entries_category_idx on public.entries (category_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before update on public.entries
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Fragen, die das Wiki noch nicht beantworten konnte (für den Chef)
-- ---------------------------------------------------------------------
create table if not exists public.questions (
  id           bigint generated always as identity primary key,
  question     text not null check (length(question) between 3 and 1000),
  asked_by     uuid references public.profiles (id) on delete set null,
  ai_answer    text,
  status       text not null default 'offen' check (status in ('offen', 'erledigt', 'verworfen')),
  entry_id     bigint references public.entries (id) on delete set null,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles (id) on delete set null
);
create index if not exists questions_status_idx on public.questions (status, created_at desc);
create index if not exists questions_asked_by_idx on public.questions (asked_by, created_at desc);

-- ---------------------------------------------------------------------
-- Suche: Volltext (deutsch, ODER-verknüpft) + Ähnlichkeit des Titels
-- ---------------------------------------------------------------------
create or replace function public.search_entries(q text, max_results int default 8)
returns table (
  id bigint, title text, answer text, category_id bigint, category text,
  keywords text, attachments jsonb, is_example boolean, updated_at timestamptz,
  score real, title_sim real
)
language sql stable security invoker set search_path = public, extensions as $$
  with input as (
    select nullif(replace(plainto_tsquery('german', coalesce(q, ''))::text, ' & ', ' | '), '') as tsq_text
  ), tsq as (
    select case when tsq_text is null then null else to_tsquery('german', tsq_text) end as query from input
  )
  select e.id, e.title, e.answer, e.category_id, c.name, e.keywords, e.attachments, e.is_example, e.updated_at,
         (coalesce(ts_rank_cd(e.search, tsq.query, 32), 0) + similarity(e.title, coalesce(q, '')))::real as score,
         similarity(lower(e.title), lower(coalesce(q, '')))::real as title_sim
  from public.entries e
  left join public.categories c on c.id = e.category_id
  cross join tsq
  where (tsq.query is not null and e.search @@ tsq.query)
     or similarity(e.title, coalesce(q, '')) > 0.2
     or similarity(e.keywords, coalesce(q, '')) > 0.3
  order by score desc, e.updated_at desc
  limit greatest(1, least(coalesce(max_results, 8), 20));
$$;

-- ---------------------------------------------------------------------
-- Zugriffsregeln (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.categories enable row level security;
alter table public.entries    enable row level security;
alter table public.questions  enable row level security;

drop policy if exists "profiles lesen" on public.profiles;
create policy "profiles lesen" on public.profiles for select to authenticated using (public.is_active_user());

drop policy if exists "kategorien lesen" on public.categories;
create policy "kategorien lesen" on public.categories for select to authenticated using (public.is_active_user());
drop policy if exists "kategorien pflegen" on public.categories;
create policy "kategorien pflegen" on public.categories for all to authenticated using (public.is_chef()) with check (public.is_chef());

drop policy if exists "eintraege lesen" on public.entries;
create policy "eintraege lesen" on public.entries for select to authenticated using (public.is_active_user());
drop policy if exists "eintraege pflegen" on public.entries;
create policy "eintraege pflegen" on public.entries for all to authenticated using (public.is_chef()) with check (public.is_chef());

drop policy if exists "fragen lesen" on public.questions;
create policy "fragen lesen" on public.questions for select to authenticated
  using (public.is_chef() or (asked_by = auth.uid() and public.is_active_user()));
drop policy if exists "fragen stellen" on public.questions;
create policy "fragen stellen" on public.questions for insert to authenticated
  with check (asked_by = auth.uid() and public.is_active_user());
drop policy if exists "fragen bearbeiten" on public.questions;
create policy "fragen bearbeiten" on public.questions for update to authenticated using (public.is_chef()) with check (public.is_chef());
drop policy if exists "fragen loeschen" on public.questions;
create policy "fragen loeschen" on public.questions for delete to authenticated using (public.is_chef());

-- Profile werden nur serverseitig (Funktion "zugaenge") geschrieben.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles, public.categories, public.entries, public.questions to authenticated;
grant insert, update, delete on public.categories, public.entries to authenticated;
grant insert, update, delete on public.questions to authenticated;
grant execute on function public.search_entries(text, int) to authenticated;
grant execute on function public.is_chef(), public.is_active_user() to authenticated;
revoke all on public.profiles, public.categories, public.entries, public.questions from anon;

-- ---------------------------------------------------------------------
-- Speicher für Anhänge (Fotos, PDFs) – privat, nur angemeldete Nutzer
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anhaenge', 'anhaenge', false, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anhaenge lesen" on storage.objects;
create policy "anhaenge lesen" on storage.objects for select to authenticated
  using (bucket_id = 'anhaenge' and public.is_active_user());
drop policy if exists "anhaenge hochladen" on storage.objects;
create policy "anhaenge hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'anhaenge' and public.is_chef());
drop policy if exists "anhaenge aendern" on storage.objects;
create policy "anhaenge aendern" on storage.objects for update to authenticated
  using (bucket_id = 'anhaenge' and public.is_chef()) with check (bucket_id = 'anhaenge' and public.is_chef());
drop policy if exists "anhaenge loeschen" on storage.objects;
create policy "anhaenge loeschen" on storage.objects for delete to authenticated
  using (bucket_id = 'anhaenge' and public.is_chef());
