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

Rollen: **Chef** (alles pflegen, Offene Fragen, Zugänge) und **Mitarbeiter** (fragen und lesen).
Die Zugriffsregeln liegen in der Datenbank (Row Level Security) – die Webseite allein kann nichts freischalten.

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
