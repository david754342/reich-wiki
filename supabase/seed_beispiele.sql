-- =====================================================================
-- Reich Wiki – Kategorien und Beispiel-Einträge (als "Beispiel" markiert)
-- Ausführen mit:  supabase db query --linked -f supabase/seed_beispiele.sql
-- Der Chef kann alle Beispiele im Wiki ändern oder löschen.
-- =====================================================================

insert into public.categories (name, sort) values
  ('Heizung', 10),
  ('Wärmepumpe', 20),
  ('Sanitär & Trinkwasser', 30),
  ('Bad', 40),
  ('Klimaanlage', 50),
  ('Kundendienst & Notdienst', 60),
  ('Arbeitssicherheit', 70),
  ('Werkstatt & Material', 80),
  ('Büro & Abläufe', 90),
  ('Ausbildung', 100)
on conflict (name) do nothing;

insert into public.entries (title, keywords, category_id, is_example, answer)
select v.title, v.keywords, c.id, true, v.answer
from (values
('Wie entlüfte ich einen Heizkörper?', 'entlüften, Luft im Heizkörper, gluckern, Heizkörper wird nicht warm, Entlüftungsschlüssel', 'Heizung',
$$**So gehst du vor:**

1. Thermostatventil am Heizkörper ganz aufdrehen.
2. Umwälzpumpe bzw. Heizung kurz ausschalten und etwa 30 Minuten warten, damit sich die Luft oben sammelt.
3. Tuch und kleines Gefäß unter das Entlüftungsventil halten.
4. Ventil mit dem Entlüftungsschlüssel langsam öffnen (gegen den Uhrzeigersinn), bis nur noch Wasser ohne Zischen kommt – dann wieder schließen.
5. Anlagendruck am Manometer prüfen und bei Bedarf Wasser nachfüllen.
6. Heizung wieder einschalten.

**Wichtig:** Immer beim höchstgelegenen Heizkörper zuletzt entlüften. Wenn öfter Luft drin ist, Ursache suchen (Druck zu niedrig, Ausdehnungsgefäß, undichte Stelle) und dem Meister Bescheid geben.$$),

('Welcher Anlagendruck ist bei einer Heizung normal?', 'Druck, bar, Manometer, Wasser nachfüllen, Druckverlust', 'Heizung',
$$Bei einem Einfamilienhaus liegt der Anlagendruck im **kalten Zustand meist zwischen 1,5 und 2,0 bar**.

- Faustregel: statische Höhe der Anlage in Metern ÷ 10 + 0,2 bis 0,5 bar.
- Im warmen Betrieb steigt der Druck etwas an – das ist normal.
- Maßgeblich sind immer die Herstellerangaben und der Vordruck des Ausdehnungsgefäßes.

**Fällt der Druck immer wieder ab**, nicht einfach nachfüllen, sondern Ursache klären (Undichtigkeit, Sicherheitsventil tropft, Ausdehnungsgefäß defekt).$$),

('Gasgeruch beim Kunden – was tun?', 'Gas riecht, Gasleck, Notfall, Gasgeruch, Gasaustritt', 'Arbeitssicherheit',
$$**Sofort und in dieser Reihenfolge:**

1. **Keine Funken:** keine Lichtschalter, Klingeln, Stecker oder Handys im Gebäude benutzen, nicht rauchen.
2. **Fenster und Türen öffnen.**
3. **Gashahn schließen** (Hauptabsperreinrichtung), wenn das gefahrlos geht.
4. **Alle Personen aus dem Gebäude** bringen, Nachbarn warnen.
5. **Von draußen** den Notruf des Gasversorgers bzw. 112 anrufen.
6. Danach sofort den Chef bzw. Meister informieren.

Erst wieder ins Gebäude, wenn Feuerwehr oder Netzbetreiber es freigeben.$$),

('Was muss ich bei einer Wärmepumpen-Beratung beim Kunden aufnehmen?', 'Wärmepumpe Beratung, Vor-Ort-Termin, Checkliste, Bestandsaufnahme, Heizungstausch', 'Wärmepumpe',
$$**Checkliste für den Vor-Ort-Termin:**

- Baujahr Gebäude und Heizung, Wohnfläche, Anzahl Personen
- Energieverbrauch der letzten 3 Jahre (Öl, Gas, Strom)
- Wärmeverteilung: Heizkörper, Fußbodenheizung oder beides – und die nötige Vorlauftemperatur
- Dämmung: neue Fenster, Fassade, Dach
- Möglicher Aufstellort für das Außengerät (Abstand zum Nachbarn, Schall, Kondensat-Ablauf)
- Zählerschrank: Platz für einen zusätzlichen Zähler bzw. eine Absicherung
- Warmwasserbereitung und vorhandener Speicher
- Fotos: Heizung, Typenschild, Heizkörper, Zählerschrank, Außenbereich

Tipp: Der Kunde kann vorab die **Bestandsaufnahme Heizung** auf unserer Webseite ausfüllen.$$),

('Was tun bei einem Wasserrohrbruch beim Kunden?', 'Rohrbruch, Wasserschaden, Leck, Wasser läuft, Notfall', 'Kundendienst & Notdienst',
$$1. **Hauptabsperrventil schließen** (meist beim Wasserzähler).
2. Wenn Wasser in der Nähe von Elektrik ist: betroffenen Stromkreis abschalten lassen und nichts Nasses anfassen.
3. **Fotos machen** – vor der Reparatur (wichtig für die Versicherung des Kunden).
4. Schaden provisorisch sichern bzw. reparieren.
5. Alles im **Arbeitsbericht** festhalten: Ursache, Material, Zeiten.
6. Kunden auf eine Trocknungsfirma hinweisen, wenn Wände oder Böden nass sind.$$),

('Was ist bei Legionellen und Warmwasser zu beachten?', 'Legionellen, Trinkwasserhygiene, Warmwasser Temperatur, Zirkulation, Trinkwasserverordnung', 'Sanitär & Trinkwasser',
$$- Warmwasser am Speicheraustritt **mindestens 60 °C**, in der Zirkulation darf es um **nicht mehr als 5 K** abkühlen (also mindestens 55 °C).
- **Stagnation vermeiden:** keine toten Leitungen, selten genutzte Zapfstellen regelmäßig spülen.
- Kaltwasser möglichst **unter 25 °C** halten (Leitungen nicht neben warmen Leitungen ohne Dämmung führen).
- Bei **Großanlagen** in vermieteten oder gewerblichen Gebäuden (Speicher über 400 Liter oder mehr als 3 Liter Inhalt in einer Leitung zwischen Speicher und Zapfstelle) ist eine regelmäßige Untersuchung nach Trinkwasserverordnung vorgeschrieben.

Bei Fragen zur Probenahme bitte beim Meister melden.$$),

('Welche Unterlagen brauchen wir für ein Badangebot?', 'Bad Angebot, Badsanierung, Aufmaß, Badplanung, Kunde Bad', 'Bad',
$$- **Aufmaß:** Länge, Breite, Raumhöhe, Lage von Fenster und Tür
- **Fotos** von allen Wänden, Boden und den vorhandenen Anschlüssen
- **Wünsche des Kunden:** bodengleiche Dusche, Wanne, Wand-WC, Doppelwaschtisch, Stil
- **Budget** und Wunschtermin
- Ob das Bad während des Umbaus genutzt werden muss bzw. ob es ein Ausweich-Bad gibt

Am einfachsten: Der Kunde füllt vorab die **Bestandsaufnahme Bad** auf unserer Webseite aus. Für die Auswahl lohnt sich ein Besuch in der Ausstellung unserer Partner.$$),

('Was gehört zur Abdichtung im Duschbereich?', 'Abdichtung, Dusche, Verbundabdichtung, DIN 18534, Dichtband, bodengleich', 'Bad',
$$- Abdichtung im **Verbund** unter den Fliesen nach **DIN 18534**.
- **Dichtband** in alle Ecken und Übergänge Wand/Boden einlegen.
- **Dichtmanschetten** an allen Durchdringungen (Armaturen, Abläufe).
- Abdichtung in der vom Hersteller vorgeschriebenen Schichtstärke, meist in **zwei Lagen**.
- Trocknungszeiten laut Hersteller einhalten, bevor gefliest wird.

Bei bodengleichen Duschen auf ausreichendes Gefälle zum Ablauf achten.$$),

('Wer darf eine Split-Klimaanlage befüllen und in Betrieb nehmen?', 'Kältemittel, F-Gase, Sachkunde, Zertifikat, Klimaanlage befüllen, Inbetriebnahme', 'Klimaanlage',
$$Arbeiten am **Kältemittelkreislauf** (Befüllen, Evakuieren, Dichtheitsprüfung, Inbetriebnahme) dürfen nur Personen mit **Sachkundenachweis nach F-Gase-Verordnung** durchführen.

- Azubis dürfen dabei **nur unter Aufsicht** einer zertifizierten Fachkraft mitarbeiten.
- Montage von Innen- und Außengerät, Kondensatleitung und Halterungen ist ohne Zertifikat möglich – das Verbinden und Befüllen nicht.
- Kältemittelmengen und Prüfungen immer im **Anlagenlogbuch** dokumentieren.$$),

('Wie oft muss eine Klimaanlage gewartet werden?', 'Klima Wartung, Dichtheitsprüfung, Filter reinigen, Intervall, Klimaanlage Service', 'Klimaanlage',
$$- **Empfehlung:** mindestens **einmal im Jahr** warten – Filter reinigen, Wärmetauscher und Kondensatablauf prüfen, desinfizieren.
- **Dichtheitsprüfung** ist bei Anlagen ab **5 t CO₂-Äquivalent** Kältemittel Pflicht (je nach Menge alle 12 Monate oder öfter). Kleine Split-Geräte liegen oft darunter – Typenschild prüfen.
- Wartungen in der Kundenkartei eintragen, damit der Kunde rechtzeitig erinnert wird.$$),

('Wie läuft ein Notdienst-Einsatz ab?', 'Notdienst, Bereitschaft, Wochenende, Notfall Kunde, Einsatz', 'Kundendienst & Notdienst',
$$1. Anruf annehmen und **Name, Adresse, Telefonnummer und Problem** notieren.
2. Einschätzen: Ist es wirklich ein Notfall (Wasser läuft, keine Heizung im Winter, Gasgeruch)? Bei Gasgeruch zuerst den Kunden anweisen (siehe Eintrag „Gasgeruch“).
3. Kunden auf die **Notdienst-Pauschale** hinweisen.
4. Vor Ort: Schaden sichern, Fotos vorher/nachher.
5. **Notdienstbericht** ausfüllen und vom Kunden unterschreiben lassen.
6. Am nächsten Arbeitstag Bericht im Büro abgeben.

*Wer Bereitschaft hat, steht im Wochenplan im Büro.*$$),

('Welche Schutzausrüstung brauche ich auf der Baustelle?', 'PSA, Schutzkleidung, Sicherheitsschuhe, Schutzbrille, Gehörschutz, Atemschutz', 'Arbeitssicherheit',
$$- **Sicherheitsschuhe** (S3) – immer.
- **Schutzbrille** beim Bohren, Flexen, Stemmen und Löten.
- **Gehörschutz** bei lauten Maschinen.
- **Handschuhe** passend zur Arbeit (Schnittschutz, Chemikalien).
- **Atemschutz** (FFP2/FFP3) bei Staub.

**Asbest-Verdacht** (alte Platten, Kleber, Dichtungen): **Arbeit sofort stoppen** und den Chef informieren. Nicht weiterbohren oder -brechen.$$),

('Wie schreibe ich meinen Arbeitsbericht richtig?', 'Arbeitsbericht, Stundenzettel, Rapport, Zeiten, Material, Kundenunterschrift', 'Büro & Abläufe',
$$Auf jeden Bericht gehören:

- Datum, Kunde und Auftragsnummer
- Was gemacht wurde (kurz und verständlich)
- **Verbrauchtes Material** mit Menge
- Arbeitszeit **und** Fahrtzeit
- Namen aller Mitarbeiter vor Ort
- **Unterschrift des Kunden**

Berichte bitte **am selben Tag** abgeben – nur so kann das Büro schnell abrechnen.$$),

('Wie bestelle ich Material?', 'Material bestellen, Großhandel, Bestellung, Lager, Lieferschein', 'Werkstatt & Material',
$$- Material **über das Büro** bzw. die Bestellliste in der Werkstatt bestellen – mit Artikelnummer, Menge und Auftrag.
- Eilige Teile vorher telefonisch mit dem Büro absprechen.
- Bei Abholung beim Großhandel den **Lieferschein** immer mitnehmen und ins Auftragsfach legen.
- Was aus dem Lager genommen wird, auf der Lagerliste austragen.$$),

('Was mache ich, wenn ich krank bin?', 'krank, Krankmeldung, Arbeitsunfähigkeit, AU, Berufsschule, Azubi', 'Ausbildung',
$$1. **Vor Arbeitsbeginn** telefonisch im Büro melden (07633 93 43 40).
2. Ab dem **ersten Krankheitstag** zum Arzt – die Krankmeldung (eAU) kommt elektronisch, sag uns trotzdem Bescheid, wie lange du voraussichtlich fehlst.
3. Bist du an einem **Berufsschultag** krank, zusätzlich die Schule nach deren Regeln informieren.

Dein **Berichtsheft** führst du wöchentlich und legst es einmal im Monat dem Ausbilder vor.$$)
) as v(title, keywords, category, answer)
join public.categories c on c.name = v.category
where not exists (select 1 from public.entries e where e.title = v.title);
