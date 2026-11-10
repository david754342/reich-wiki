// Demo-KI: vorbereitete Antworten für die Vorführung, solange kein Claude-API-Schlüssel hinterlegt ist.
// Sobald das Geheimnis ANTHROPIC_API_KEY gesetzt ist, wird diese Datei nicht mehr benutzt.

export type DemoAnswer = { keywords: string[]; answer: string };

export const DEMO_ANSWERS: DemoAnswer[] = [
  {
    keywords: ["vorlauf", "fußboden", "fussboden", "niedertemperatur", "wärmepumpe heizkörper", "waermepumpe heizkoerper"],
    answer: `Eine Wärmepumpe arbeitet am effizientesten mit **niedriger Vorlauftemperatur**.

- **Fußbodenheizung:** meist 30–35 °C – ideal für die Wärmepumpe.
- **Heizkörper:** brauchen oft 45–55 °C. Das geht, kostet aber mehr Strom. Prüfe, ob einzelne zu kleine Heizkörper getauscht werden müssen.
- Je niedriger die Vorlauftemperatur, desto besser die Jahresarbeitszahl.

**Praxis:** Erst die Heizlast und den Bedarf pro Raum ermitteln, dann die Heizkurve so niedrig wie möglich einstellen. Zum Abschluss einen **hydraulischen Abgleich** machen.`
  },
  {
    keywords: ["löt", "loet", "lötzinn", "kupferrohr", "hartlöt", "weichlöt"],
    answer: `**Kupferrohr löten – die Kurzfassung:**

1. Rohr rechtwinklig ablängen, **entgraten** und blank machen (Vlies, nicht mit grobem Schleifpapier).
2. **Flussmittel** dünn auftragen – passend zum Lot und zum Einsatz (Trinkwasser nur mit zugelassenem Material).
3. Fitting aufstecken, gleichmäßig erwärmen, **Lot an die Spaltkante** halten, nicht direkt in die Flamme. Das Lot zieht sich selbst in den Spalt.
4. Abkühlen lassen, **Flussmittelreste entfernen**.

**Wichtig:** Im Trinkwasser nur **bleifreie, zugelassene** Lote und Flussmittel nach den Vorgaben des Herstellers verwenden. Für Gas- und Kältemittelleitungen gelten eigene Regeln (meist Hartlot) – dafür immer den Meister fragen. Brandschutz beachten: Feuerlöscher und Hitzeschutz bereithalten.`
  },
  {
    keywords: ["kondensat", "brennwert", "neutralisation"],
    answer: `Bei **Brennwertgeräten** entsteht beim Heizen **Kondensat**. Es ist leicht sauer (ca. pH 3–4).

- Es muss über einen **Siphon** sauber und ohne Rückstau abgeleitet werden.
- Je nach Leistung und örtlicher Abwassersatzung ist eine **Neutralisationsbox** nötig (bei kleinen Anlagen oft nicht).
- Der Siphon muss **gefüllt** sein, sonst können Abgase in den Raum gelangen.
- Kondensatleitung mit Gefälle verlegen, nicht knicken.

Was bei dem Kunden gilt, steht in der Satzung der Gemeinde – im Zweifel beim Meister nachfragen.`
  },
  {
    keywords: ["hydraulisch", "abgleich"],
    answer: `Der **hydraulische Abgleich** sorgt dafür, dass **jeder Heizkörper genau die Wassermenge bekommt, die er braucht**. Ohne ihn werden nahe Heizkörper zu heiß und weit entfernte kaum warm.

**Ablauf in Kürze:**
1. Raumweise **Heizlast** berechnen.
2. Heizkörper und Rohrnetz aufnehmen.
3. Pumpenleistung und **Voreinstellung der Thermostatventile** berechnen und einstellen.
4. Ergebnis **protokollieren** – wichtig für die Förderung.

Spart Energie, verhindert Fließgeräusche und ist bei vielen Förderungen Pflicht.`
  },
  {
    keywords: ["ausdehnungsgef", "vordruck", "ausdehnung"],
    answer: `Das **Ausdehnungsgefäß** fängt das Heizungswasser auf, wenn es sich beim Erwärmen ausdehnt.

**Vordruck prüfen:**
1. Anlage **drucklos** machen und das Gefäß von der Anlage trennen (Kappenventil schließen).
2. Mit einem Manometer den Gasdruck auf der Luftseite am Ventil messen.
3. Vordruck an die statische Höhe anpassen (Richtwert: **Höhe in m ÷ 10 + 0,2 bis 0,5 bar**), nur Stickstoff oder Luft nachfüllen.

**Typische Zeichen für ein defektes Gefäß:** Anlagendruck schwankt stark, Sicherheitsventil tropft, ständig Wasser nachfüllen. Bei der Membran im Zweifel das Gefäß tauschen.`
  },
  {
    keywords: ["sicherheitsventil", "tropft", "überdruck", "ueberdruck"],
    answer: `Ein tropfendes **Sicherheitsventil** an der Heizung heißt: Der Druck wird zu hoch.

**Häufige Ursachen:**
- Ausdehnungsgefäß defekt oder falscher Vordruck
- Anlage wurde zu hoch befüllt
- Ventil ist verschmutzt oder verkalkt (undicht, obwohl der Druck normal ist)

**Vorgehen:** Anlagendruck am Manometer prüfen. Liegt er bei Betriebstemperatur nahe am Ansprechdruck (meist 3 bar), liegt es am Gefäß oder an der Befüllung. Ist der Druck normal, ist das Ventil selbst undicht und wird getauscht. Nicht „zudrehen“ oder blockieren – es ist ein Sicherheitsbauteil.`
  },
  {
    keywords: ["kein warmwasser", "warmwasser kalt", "warmwasser wird nicht", "warmwasser nicht warm"],
    answer: `Kein oder nur lauwarmes Warmwasser – so gehst du vor:

1. **Speichertemperatur** prüfen: Soll mindestens **60 °C** sein.
2. Speicherladepumpe und Umschaltventil: läuft die Pumpe, schaltet das Ventil?
3. **Mischer/Thermostat** an der Zapfstelle oder zentral: verkalkt oder defekt?
4. **Zirkulation:** Pumpe läuft, Rückschlagventile in Ordnung?
5. Bei **Durchlauferhitzer:** Sicherung, Durchfluss und Strahlregler (Kalk) prüfen.

**Sicherheit:** Beim Testen auf Verbrühungsgefahr achten. Arbeiten am Stromanschluss nur durch eine Elektrofachkraft.`
  },
  {
    keywords: ["geräusch", "geraeusch", "klopf", "boller", "gluckert", "rauscht", "pfeift"],
    answer: `Geräusche an der Heizung deuten meist auf eine dieser Ursachen:

- **Gluckern/Rauschen:** Luft im System → entlüften, Druck prüfen.
- **Pfeifen am Thermostat/Heizkörper:** zu hohe Strömungsgeschwindigkeit → Pumpenstufe oder **hydraulischen Abgleich** prüfen.
- **Klopfen/Knacken:** Temperaturdehnung der Rohre (Schellen, Durchführungen) oder Kalk im Wärmetauscher.
- **Bollern am Kessel:** Kalk, zu niedriger Durchfluss oder defekte Pumpe.

Erst die einfachen Dinge prüfen (Druck, Luft), dann Pumpe und Abgleich. Bei Kalk im Wärmetauscher den Meister einbinden.`
  },
  {
    keywords: ["kalk", "härte", "haerte", "enthärt", "enthaert"],
    answer: `**Wasserhärte** bestimmt, wie viel Kalk sich in Leitungen, Speichern und Armaturen absetzt.

- Härte in °dH messen (Teststreifen) oder beim Wasserversorger erfragen.
- Ab etwa **15–20 °dH** lohnt sich eine **Enthärtungsanlage** oder zumindest regelmäßiges Entkalken von Speicher und Durchlauferhitzer.
- Bei Fußbodenheizung und Wärmepumpe: **Heizungswasser** nach Herstellervorgabe aufbereiten (VDI 2035).

Beratung beim Kunden: Härte, Warmwassertemperatur und Verbrauch notieren – das hilft bei der Angebotserstellung.`
  },
  {
    keywords: ["spülkasten", "spuelkasten", "wc läuft", "wc laeuft", "wc spül", "toilette läuft", "toilette laeuft"],
    answer: `Wenn der **Spülkasten ständig nachläuft:**

1. **Füllventil** prüfen: Schwimmer zu hoch eingestellt? Dichtung verschlissen?
2. **Ablaufventil/Dichtung** prüfen: Kalk oder poröse Gummidichtung, dann läuft das Wasser leise ins Becken.
3. Bei Unterputz-Spülkästen: Revisionsöffnung, Ersatzteile gibt es meist als Set (Geberit, Viega …).
4. Nach dem Tausch **Wasserstand** am Markierungsstrich einstellen.

Vor dem Arbeiten Eckventil bzw. Wasserzufuhr schließen.`
  },
  {
    keywords: ["abfluss", "verstopf", "siphon", "rohrreinig"],
    answer: `Abfluss verstopft oder langsam – in dieser Reihenfolge:

1. **Siphon** abschrauben und reinigen (Eimer drunterstellen).
2. Mit der **Saugglocke** oder Spirale nachsetzen.
3. Bei mehreren Abflüssen gleichzeitig: Problem liegt im **Hauptstrang** → Meister/Kanalreinigung.
4. Chemische Rohrreiniger nur sparsam einsetzen (Material der Rohre beachten) und dabei immer **Handschuhe und Schutzbrille** tragen.

Wiederkehrende Probleme: Gefälle prüfen und die Leitung mit Kamera inspizieren lassen.`
  },
  {
    keywords: ["klima tropft", "klimaanlage tropft", "kondenswasser", "wasser tropft"],
    answer: `Wenn eine **Klimaanlage tropft**, liegt es fast immer am **Kondensat**:

- **Ablaufschlauch** verstopft oder abgeknickt → durchspülen, Gefälle prüfen.
- **Innengerät nicht waagerecht** montiert (leicht zur Ablaufseite geneigt muss es sein).
- **Filter verschmutzt** → Vereisung am Wärmetauscher, beim Abtauen läuft Wasser über.
- Bei Vereisung zusätzlich Kältemittelmenge prüfen lassen – das darf nur eine **zertifizierte Fachkraft** (F-Gase).

Erst Filter und Ablauf kontrollieren, das löst die meisten Fälle.`
  },
  {
    keywords: ["evakuier", "vakuum", "dichtheit klima", "kältekreis", "kaeltekreis"],
    answer: `Beim **Evakuieren einer Split-Klimaanlage** entfernst du Luft und Feuchtigkeit aus der Leitung, bevor Kältemittel einströmt:

1. Leitungen verbunden, **Dichtheit** mit Stickstoff prüfen.
2. **Vakuumpumpe** anschließen und auf unter etwa **500 Mikrobar** ziehen.
3. Vakuum **mindestens 15–30 Minuten halten** (Stand-Test): fällt es ab, ist es undicht oder feucht.
4. Dann Ventile öffnen und das Kältemittel freigeben.

Das Arbeiten am Kältemittelkreis darf nur eine **Person mit Sachkundenachweis (F-Gase)** durchführen. Azubis nur unter Aufsicht.`
  },
  {
    keywords: ["förder", "foerder", "geg", "65 prozent", "65%", "heizungsgesetz", "bafa", "beg"],
    answer: `Zur **Förderung beim Heizungstausch:**

- Gefördert werden meist **Wärmepumpen, Biomasseheizungen, Solarthermie** und Zusatzmaßnahmen (z. B. hydraulischer Abgleich).
- Wichtig ist: **Antrag vor Beginn der Maßnahme** (je nach Programm).
- Die **aktuellen Fördersätze und Bedingungen** ändern sich – bitte immer bei der KfW bzw. dem BAFA nachschauen und nicht aus dem Gedächtnis zusagen.
- Für das **GEG** (Gebäudeenergiegesetz) gilt: neue Heizungen sollen künftig überwiegend mit erneuerbaren Energien laufen – was das konkret für den Kunden bedeutet, klärt der Meister.

Dem Kunden niemals Fördersummen versprechen, sondern auf die offizielle Prüfung verweisen.`
  },
  {
    keywords: ["durchlauferhitzer", "elektro", "absicherung", "kw durchlauf"],
    answer: `**Elektrischer Durchlauferhitzer:**

- Die Leistung (z. B. **18–27 kW**) braucht einen **eigenen Stromkreis** mit passender Absicherung und Leitung.
- **Anschluss und Absicherung** macht ausschließlich eine **Elektrofachkraft**.
- Wasserseitig: **Absperrventil, Schmutzfänger, Strahlregler** und passende Armatur (Druckarmatur) einplanen.
- Bei Kalk: regelmäßig entkalken.

Für Warmwasser in Mehrfamilienhäusern lohnt oft ein Gespräch mit dem Chef über zentrale Lösungen.`
  },
  {
    keywords: ["druckprüfung", "druckpruefung", "dichtheitsprüfung", "dichtheitspruefung", "druckprobe"],
    answer: `**Druckprüfung einer neuen Trinkwasserleitung** (Kurzüberblick):

- Prüfen mit **Wasser** (feuchte Prüfung) oder **ölfreier Luft/Inertgas** – je nach Vorgabe des Herstellers und der Norm.
- Prüfdruck und Prüfzeit nach **DIN EN 806-4** bzw. Herstellerangabe einhalten.
- Ergebnis im **Protokoll** festhalten (Druck, Dauer, Datum, Name).
- Nach der Prüfung Leitungen **spülen** und – wenn sie länger leer bleiben – den Betrieb zeitnah aufnehmen, sonst droht Stagnation.

Für exakte Werte immer das aktuelle Prüfprotokoll des Rohrsystem-Herstellers benutzen.`
  }
];

function norm(s: string) {
  return s.toLowerCase()
    .replace(/[^\p{L}\p{N}%]+/gu, " ").trim();
}

export function findDemoAnswer(question: string): string | null {
  const q = " " + norm(question) + " ";
  let best: { score: number; answer: string } | null = null;
  for (const d of DEMO_ANSWERS) {
    let score = 0;
    for (const k of d.keywords) if (q.includes(norm(k))) score += k.length;
    if (score > 0 && (!best || score > best.score)) best = { score, answer: d.answer };
  }
  return best ? best.answer : null;
}
