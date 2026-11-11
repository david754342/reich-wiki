-- =====================================================================
-- Reich Wiki – Kostenbremse für die KI (11.11.2026)
-- Die KI ergänzt jetzt auch Chef-Antworten. Damit die Kostenbremse alle KI-Aufrufe zählt
-- (nicht nur offene Fragen), merkt sich diese Tabelle nur: wer, wann. Kein Fragetext.
-- Einträge älter als 2 Tage löscht die Funktion "frage" selbst wieder.
-- Ausführen mit:  supabase db query --linked -f supabase/migrations/20261111120000_ki_nutzung.sql
-- =====================================================================
create table if not exists public.ki_nutzung (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists ki_nutzung_user_idx on public.ki_nutzung (user_id, created_at desc);
alter table public.ki_nutzung enable row level security;
revoke all on public.ki_nutzung from anon, authenticated;
