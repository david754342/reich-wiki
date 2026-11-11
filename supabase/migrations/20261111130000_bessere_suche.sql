-- =====================================================================
-- Reich Wiki – Suche versteht frei formulierte Fragen (11.11.2026)
-- Ziel: „heizung entlüften“, „es riecht nach gas“ oder „Welcher Heizungsdruck ist normal?“
-- finden den passenden Chef-Eintrag, auch wenn die Frage anders formuliert ist als der Titel.
--
-- Neu in search_entries:
--   relevanz (0..1): Anteil der Suchbegriffe, die im Eintrag vorkommen – gewichtet danach, wie
--                    aussagekräftig ein Begriff ist (seltene Wörter wie „Legionellen“ zählen mehr als „Kunde“).
--                    Treffer in Titel/Stichworten zählen mehr als Treffer im Antworttext.
--   gewicht:         Summe der Aussagekraft der Begriffe, die in Titel/Stichworten gefunden wurden.
-- Dabei:
--   - Füllwörter („gerne“, „wissen“, „heute“, „kann“ …) werden ignoriert
--   - Wortanfänge zählen („heizung“ findet „Heizkörper“ über „heiz…“)
--   - zusammengesetzte Wörter werden erkannt („Heizungsdruck“ ↔ „Druck“, „Schuhe“ ↔ „Sicherheitsschuhe“)
-- Die Funktion "frage" entscheidet anhand von relevanz/gewicht, ob die Chef-Antwort passt.
-- Ausführen mit:  supabase db query --linked -f supabase/migrations/20261111130000_bessere_suche.sql
-- =====================================================================

drop function if exists public.search_entries(text, int);

create function public.search_entries(q text, max_results int default 8)
returns table (
  id bigint, title text, answer text, category_id bigint, category text,
  keywords text, attachments jsonb, is_example boolean, updated_at timestamptz,
  score real, title_sim real, relevanz real, gewicht real
)
language sql stable security invoker set search_path = public, extensions as $$
  with fuell as (
    select unnest(tsvector_to_array(to_tsvector('german',
      'gerne wissen bitte mal eigentlich genau frage fragen kurz richtig hilfe helfen jemand irgendwie ' ||
      'bekomme bekommen machen mache macht tun geht gehen läuft laufen heute jetzt gerade immer ' ||
      'kann können muss müssen soll sollte darf'))) as w
  ),
  begriffe as (
    select distinct l as lex, left(l, greatest(4, length(l) - 3)) as pre
    from unnest(tsvector_to_array(to_tsvector('german', coalesce(q, '')))) l
    where l not in (select w from fuell)
  ),
  ein as (
    select e.id as eid, e.title as etitle, e.answer as eanswer, e.category_id as ecat, c.name as cat_name,
           e.keywords as ekeys, e.attachments as eatt, e.is_example as eex, e.updated_at as eupd, e.search as esearch,
           tsvector_to_array(e.search) as alle,
           tsvector_to_array(ts_filter(e.search, '{a}')) as wichtig
    from public.entries e left join public.categories c on c.id = e.category_id
  ),
  treffer as (
    select x.eid, b.lex,
      exists (select 1 from unnest(x.alle) el
              where left(el, length(b.pre)) = b.pre
                 or (length(el) >= 5 and length(b.lex) >= length(el) + 3 and right(b.lex, length(el)) = el)
                 or (length(b.lex) >= 5 and length(el) >= length(b.lex) + 3 and right(el, length(b.lex)) = b.lex)) as h_alle,
      exists (select 1 from unnest(x.wichtig) el
              where left(el, length(b.pre)) = b.pre
                 or (length(el) >= 5 and length(b.lex) >= length(el) + 3 and right(b.lex, length(el)) = el)
                 or (length(b.lex) >= 5 and length(el) >= length(b.lex) + 3 and right(el, length(b.lex)) = b.lex)) as h_wichtig
    from begriffe b cross join ein x
  ),
  gew as (
    select t.lex, ln(((select count(*) from ein) + 1)::numeric / (count(*) filter (where t.h_alle) + 0.5)) as w
    from treffer t group by t.lex
  ),
  rel as (
    select t.eid,
      sum(g.w * (0.6 * t.h_wichtig::int + 0.4 * t.h_alle::int)) / nullif(sum(g.w), 0) as relevanz,
      sum(g.w * t.h_wichtig::int) as gewicht
    from treffer t join gew g on g.lex = t.lex group by t.eid
  ),
  input as (
    select nullif(replace(plainto_tsquery('german', coalesce(q, ''))::text, ' & ', ' | '), '') as tsq_text
  ),
  tsq as (
    select case when tsq_text is null then null else to_tsquery('german', tsq_text) end as query from input
  ),
  erg as (
    select x.eid, x.etitle, x.eanswer, x.ecat, x.cat_name, x.ekeys, x.eatt, x.eex, x.eupd,
           (coalesce(ts_rank_cd(x.esearch, tsq.query, 32), 0) + similarity(x.etitle, coalesce(q, '')))::real as s_alt,
           similarity(lower(x.etitle), lower(coalesce(q, '')))::real as t_sim,
           coalesce(r.relevanz, 0)::real as rel_wert,
           coalesce(r.gewicht, 0)::real as gew_wert,
           (tsq.query is not null and x.esearch @@ tsq.query) as volltext,
           similarity(x.ekeys, coalesce(q, '')) as k_sim
    from ein x left join rel r on r.eid = x.eid cross join tsq
  )
  select eid, etitle, eanswer, ecat, cat_name, ekeys, eatt, eex, eupd, s_alt, t_sim, rel_wert, gew_wert
  from erg
  where rel_wert > 0 or volltext or t_sim > 0.2 or k_sim > 0.3
  order by rel_wert desc, s_alt desc, eupd desc
  limit greatest(1, least(coalesce(max_results, 8), 20));
$$;

grant execute on function public.search_entries(text, int) to authenticated;
