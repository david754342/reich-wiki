-- =====================================================================
-- Reich Wiki – Erweiterungen (11.11.2026)
--   1. Passwort muss beim ersten Anmelden geändert werden
--   2. Fragen-Protokoll für die Statistik (ohne Namen)
--   3. Bewertungen „War das hilfreich?“
--   4. Fotos bei Fragen
--   5. Statistik für den Chef (nur Gesamtzahlen)
-- Ausführen mit:  supabase db query --linked -f supabase/migrations/20261111000000_verbesserungen.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Passwort-Pflicht beim ersten Anmelden
--    Solange das Startpasswort gilt, sieht der Zugang nur sein eigenes Profil.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists must_change_password boolean not null default true;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and not must_change_password);
$$;

create or replace function public.is_chef()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'chef' and not must_change_password);
$$;

drop policy if exists "eigenes profil lesen" on public.profiles;
create policy "eigenes profil lesen" on public.profiles for select to authenticated using (id = auth.uid());

-- ---------------------------------------------------------------------
-- 2) Fragen-Protokoll: jede gestellte Frage, ohne Namen und ohne Fragetext
--    Wird nur von der Funktion "frage" geschrieben; gelesen nur über wiki_statistik().
-- ---------------------------------------------------------------------
create table if not exists public.ask_log (
  id           bigint generated always as identity primary key,
  result       text not null check (result in ('wiki', 'ki', 'keine')),
  entry_id     bigint references public.entries (id) on delete set null,
  category_id  bigint references public.categories (id) on delete set null,
  question_id  bigint references public.questions (id) on delete set null,
  has_photos   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists ask_log_created_idx on public.ask_log (created_at desc);
alter table public.ask_log enable row level security;
revoke all on public.ask_log from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) Bewertungen „War das hilfreich?“ (pro Person eine Stimme je Eintrag bzw. KI-Antwort)
-- ---------------------------------------------------------------------
create table if not exists public.feedback (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  entry_id     bigint references public.entries (id) on delete cascade,
  question_id  bigint references public.questions (id) on delete cascade,
  helpful      boolean not null,
  comment      text check (comment is null or length(comment) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check ((entry_id is null) <> (question_id is null))
);
create unique index if not exists feedback_user_entry_idx on public.feedback (user_id, entry_id) where entry_id is not null;
create unique index if not exists feedback_user_question_idx on public.feedback (user_id, question_id) where question_id is not null;
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

create or replace function public.bewerten(p_entry bigint default null, p_question bigint default null,
                                           p_helpful boolean default true, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  c text := nullif(left(btrim(coalesce(p_comment, '')), 500), '');
begin
  if not public.is_active_user() then raise exception 'nicht_erlaubt' using errcode = '42501'; end if;
  if (p_entry is null) = (p_question is null) then raise exception 'ungueltig' using errcode = '22023'; end if;
  if p_entry is not null and not exists (select 1 from public.entries where id = p_entry) then
    raise exception 'nicht_gefunden' using errcode = '22023';
  end if;
  if p_question is not null and not exists (select 1 from public.questions where id = p_question and asked_by = auth.uid()) then
    raise exception 'nicht_erlaubt' using errcode = '42501';
  end if;
  update public.feedback set helpful = coalesce(p_helpful, true), comment = c, updated_at = now()
   where user_id = auth.uid() and entry_id is not distinct from p_entry and question_id is not distinct from p_question;
  if not found then
    insert into public.feedback (user_id, entry_id, question_id, helpful, comment)
    values (auth.uid(), p_entry, p_question, coalesce(p_helpful, true), c);
  end if;
end;
$$;
revoke all on function public.bewerten(bigint, bigint, boolean, text) from public, anon;
grant execute on function public.bewerten(bigint, bigint, boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4) Fotos bei Fragen: eigener, privater Speicher
--    Ordner = Benutzer-ID. Hochladen nur in den eigenen Ordner; sehen dürfen nur Fragesteller und Chef.
-- ---------------------------------------------------------------------
alter table public.questions add column if not exists photos jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fragen-fotos', 'fragen-fotos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fragenfotos hochladen" on storage.objects;
create policy "fragenfotos hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'fragen-fotos' and public.is_active_user() and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "fragenfotos lesen" on storage.objects;
create policy "fragenfotos lesen" on storage.objects for select to authenticated
  using (bucket_id = 'fragen-fotos' and (public.is_chef() or ((storage.foldername(name))[1] = auth.uid()::text and public.is_active_user())));
drop policy if exists "fragenfotos loeschen" on storage.objects;
create policy "fragenfotos loeschen" on storage.objects for delete to authenticated
  using (bucket_id = 'fragen-fotos' and (public.is_chef() or ((storage.foldername(name))[1] = auth.uid()::text and public.is_active_user())));

-- ---------------------------------------------------------------------
-- 5) Statistik für den Chef – nur Gesamtzahlen, keine Auswertung pro Person
-- ---------------------------------------------------------------------
create or replace function public.wiki_statistik(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  d     int := greatest(1, least(coalesce(p_days, 30), 365));
  since timestamptz := now() - make_interval(days => d);
  r     jsonb;
begin
  if not public.is_chef() then raise exception 'nur_chef' using errcode = '42501'; end if;
  select jsonb_build_object(
    'tage', d,
    'fragen',      (select count(*) from public.ask_log where created_at >= since),
    'wiki',        (select count(*) from public.ask_log where created_at >= since and result = 'wiki'),
    'ki',          (select count(*) from public.ask_log where created_at >= since and result = 'ki'),
    'keine',       (select count(*) from public.ask_log where created_at >= since and result = 'keine'),
    'mit_fotos',   (select count(*) from public.ask_log where created_at >= since and has_photos),
    'offen',       (select count(*) from public.questions where status = 'offen'),
    'eintraege',   (select count(*) from public.entries),
    'neue_eintraege', (select count(*) from public.entries where created_at >= since),
    'aktive_nutzer', (select count(*) from auth.users u join public.profiles p on p.id = u.id
                       where p.active and u.last_sign_in_at >= since),
    'zugaenge',    (select count(*) from public.profiles where active),
    'pro_woche', coalesce((
      select jsonb_agg(jsonb_build_object('woche', to_char(w.wk, 'YYYY-MM-DD'), 'wiki', coalesce(x.wiki, 0), 'andere', coalesce(x.andere, 0)) order by w.wk)
      from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') as w(wk)
      left join (
        select date_trunc('week', created_at) as wk,
               count(*) filter (where result = 'wiki') as wiki,
               count(*) filter (where result <> 'wiki') as andere
        from public.ask_log where created_at >= date_trunc('week', now()) - interval '7 weeks'
        group by 1
      ) x on x.wk = w.wk), '[]'::jsonb),
    'top_eintraege', coalesce((
      select jsonb_agg(t) from (
        select e.id, e.title, count(*) as n
        from public.ask_log l join public.entries e on e.id = l.entry_id
        where l.created_at >= since group by e.id, e.title order by n desc, e.title limit 5) t), '[]'::jsonb),
    'kategorien', coalesce((
      select jsonb_agg(t) from (
        select c.name, count(*) as n
        from public.ask_log l join public.categories c on c.id = l.category_id
        where l.created_at >= since group by c.name order by n desc, c.name limit 6) t), '[]'::jsonb),
    'hilfreich',       (select count(*) from public.feedback where updated_at >= since and helpful),
    'nicht_hilfreich', (select count(*) from public.feedback where updated_at >= since and not helpful),
    'verbessern', coalesce((
      select jsonb_agg(t) from (
        select e.id, e.title,
               count(*) filter (where not f.helpful) as nein,
               count(*) filter (where f.helpful) as ja
        from public.feedback f join public.entries e on e.id = f.entry_id
        group by e.id, e.title
        having count(*) filter (where not f.helpful) > 0
        order by nein desc, ja asc limit 5) t), '[]'::jsonb),
    'hinweise', coalesce((
      select jsonb_agg(t) from (
        select coalesce(e.title, q.question) as titel, f.entry_id, f.comment, f.updated_at
        from public.feedback f
        left join public.entries e on e.id = f.entry_id
        left join public.questions q on q.id = f.question_id
        where not f.helpful and f.comment is not null
        order by f.updated_at desc limit 6) t), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;
revoke all on function public.wiki_statistik(int) from public, anon;
grant execute on function public.wiki_statistik(int) to authenticated;
