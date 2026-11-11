# Reich Wiki

Internes Wissen für das Team der **Reich Haustechnik GmbH**. Mitarbeiter und Azubis stellen Fragen,
der Chef pflegt die Antworten. Steht etwas noch nicht im Wiki, antwortet die KI (Claude) – deutlich als
„noch nicht vom Chef geprüft“ markiert – und die Frage landet beim Chef unter **Offene Fragen**.
Mit einem Klick wird daraus ein Wiki-Eintrag. So wächst das Wiki mit jeder Frage.

## So funktioniert eine Frage

1. Das Wiki durchsucht alle Einträge (Volltextsuche auf Deutsch + Ähnlichkeit des Titels).
2. Eindeutiger Treffer → sofort die **Antwort vom Chef**, ohne KI.
3. Sonst prüft Claude die gefundenen Einträge: Beantwortet einer die Frage, kommt dieser Eintrag.
4. Passt keiner, antwortet Claude selbst. Die Frage wird beim Chef als „offen“ gespeichert.

## Aufbau

| Teil | Wo | Was |
|---|---|---|
| Webseite | GitHub Pages (`index.html`, `assets/`) | Anmeldung, Fragen, Wissen, Pflege, Zugänge |
| Daten & Anmeldung | Supabase (EU, Frankfurt) | Benutzer, Einträge, Fragen, Anhänge (privat) |
| KI | Supabase-Funktion `frage` → Claude API | Modell `claude-opus-5-5` |
| Zugänge verwalten | Supabase-Funktion `zugaenge` | nur für den Chef |

Rollen: **Chef** (alles pflegen, Offene Fragen, Statistik, Zugänge) und **Mitarbeiter** (fragen und lesen).
Die Zugriffsregeln liegen in der Datenbank (Row Level Security) – die Webseite allein kann nichts freischalten.

## Weitere Funktionen

- **Eigenes Passwort beim ersten Anmelden:** Neue Zugänge und vom Chef zurückgesetzte Passwörter gelten als
  Startpasswort. Bis ein eigenes Passwort (mind. 7 Zeichen, nicht das Startpasswort) gesetzt ist, sieht der Zugang
  nichts außer dem Passwort-Bildschirm – das ist in der Datenbank abgesichert, nicht nur in der Webseite.
- **„War das hilfreich?“** unter jeder Antwort. Bei „Nein“ kann ein Hinweis mitgeschickt werden. Der Chef sieht
  die Rückmeldungen in der Statistik – ohne Namen.
- **Spracheingabe:** Knopf „Sprechen“ im Fragefeld, wenn der Browser das anbietet (Chrome, Edge, Safari).
  Die Erkennung übernimmt der Dienst des Browsers (Google bzw. Apple). Sonst geht das Mikrofon der Handy-Tastatur.
- **Fotos zur Frage:** bis zu 3 Fotos (werden auf max. 1600 px verkleinert). Die KI schaut sie sich mit an.
  Fotos liegen im privaten Speicher `fragen-fotos`; sehen dürfen sie nur der Fragesteller und der Chef.
  Beim Beantworten kann der Chef einzelne Fotos in den Wiki-Eintrag übernehmen.
- **Statistik (nur Chef):** Fragen pro Woche, Anteil direkt aus dem Wiki, meistgenutzte Einträge, Themen,
  Bewertungen. Es wird nur ohne Namen gezählt (Tabelle `ask_log` speichert weder Person noch Fragetext).
- **Team-Fotos:** Foto und Funktion je Benutzername stehen in `assets/team.js` (Fotos in `assets/team/`).

## Einrichtung (einmalig)

1. Supabase-Projekt `reich-wiki` in der Region **Central EU (Frankfurt)** anlegen.
2. Supabase-Tool anmelden und Projekt verknüpfen:
   ```bash
   supabase login
   supabase link --project-ref <projekt-ref>
   ```
3. Datenbank, Regeln und Beispiele anlegen:
   ```bash
   supabase db query --linked -f supabase/migrations/20261110000000_reich_wiki.sql
   supabase db query --linked -f supabase/migrations/20261111000000_verbesserungen.sql
   supabase db query --linked -f supabase/seed_beispiele.sql
   ```
4. Funktionen hochladen:
   ```bash
   supabase functions deploy frage --use-api
   supabase functions deploy zugaenge --use-api
   ```
5. Claude-API-Schlüssel als Geheimnis hinterlegen (Supabase-Dashboard → Edge Functions → Secrets → `ANTHROPIC_API_KEY`).
6. In `assets/config.js` die Projekt-Adresse und den öffentlichen Schlüssel (anon/publishable) eintragen.

## Pflege & Einstellungen

- KI-Gründlichkeit, Treffer-Schwelle und Tageslimit stehen oben in `supabase/functions/frage/index.ts`
  (`EFFORT`, `DIRECT_MATCH_SIMILARITY`, `MAX_AI_QUESTIONS_PER_DAY`).
- Neue Zugänge, Passwörter und Sperren macht der Chef direkt im Wiki unter **Zugänge**.
- Kategorien legt der Chef beim Bearbeiten eines Eintrags an.

## Kosten (Stand Einrichtung)

- Supabase Free: kostenlos (500 MB Datenbank, 1 GB Dateien). Achtung: Kostenlose Projekte pausieren nach
  7 Tagen ohne Nutzung und müssen dann im Dashboard wieder gestartet werden – für den Dauerbetrieb Supabase Pro.
- Claude API: nur für Fragen, die nicht direkt im Wiki stehen, grob 2–4 Cent pro Frage.
- GitHub Pages: kostenlos.

## Sicherheit

- In `assets/config.js` stehen nur öffentliche Werte. Der geheime Supabase-Schlüssel und der
  Claude-API-Schlüssel liegen ausschließlich als Geheimnisse in Supabase.
- Benutzernamen werden intern als `benutzername@wiki.reich-haustechnik.de` gespeichert; es werden keine E-Mails verschickt.
