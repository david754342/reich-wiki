// Reich Wiki – Funktion "frage"
// Grundsatz: Die Antwort vom Chef kommt immer zuerst. Die KI ergänzt nur – oder antwortet, wenn es keine Chef-Antwort gibt.
// 1. sucht passende Einträge im Wiki
// 2. (fast) dieselbe Frage wie ein Eintrag  -> Antwort des Chefs, ohne KI
// 3. sonst prüft Claude die Einträge (und Fotos):
//    - passt ein Eintrag  -> Antwort des Chefs + ggf. kurze Ergänzung der KI darunter
//    - passt keiner       -> KI-Antwort; die Frage landet beim Chef unter "Offene Fragen"
// Ohne KI (Demo, Tageslimit, Störung) entscheidet der Suchwert, ob ein Eintrag passt.
// Jede Frage wird ohne Namen protokolliert (Statistik).
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { findDemoAnswer } from "./demo.ts";

const MODEL = "claude-opus-5-5";
const EFFORT = "low"; // low | medium | high – höher = gründlicher, aber langsamer und teurer
const EXACT_MATCH_SIMILARITY = 0.85; // so gut wie dieselbe Frage wie der Titel -> Chef-Antwort ohne KI
// Ohne KI (Demo, Tageslimit, Störung) gilt der beste Eintrag als passend, wenn die Suche ihn sicher genug findet.
// Werte aus einem Prüfsatz mit 44 Alltagsfragen: 27 von 29 Chef-Antworten gefunden, 0 von 15 falsch angezeigt.
// relevanz = gewichteter Anteil der Suchbegriffe im Eintrag (0..1), gewicht = Aussagekraft der Treffer in Titel/Stichworten
const MATCH_RULES = [
  { relevanz: 0.75, gewicht: 1.5 }, // fast alle Begriffe passen, mindestens ein aussagekräftiger im Titel/Stichwort
  { relevanz: 0.65, gewicht: 2.0 }, // die meisten Begriffe passen, mehrere aussagekräftige im Titel/Stichwort
];
const LIKELY_MATCH_SCORE = 1.0;      // bisherige Volltext-Bewertung als zusätzliche Absicherung
const LIKELY_MATCH_SIMILARITY = 0.6; // oder ab dieser Titel-Ähnlichkeit
const MAX_AI_CALLS_PER_DAY = 40;     // Kostenbremse pro Person (alle KI-Aufrufe, auch Ergänzungen)
const MAX_PHOTOS = 3;
const PHOTO_BUCKET = "fragen-fotos";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const SYSTEM = `Du bist der interne Wissens-Assistent der Reich Haustechnik GmbH in Bad Krozingen, einem Meisterbetrieb für Bad, Sanitär, Heizung, Wärmepumpen und Klimaanlagen. Mitarbeiter und Auszubildende stellen dir Fragen aus ihrem Arbeitsalltag.

Du bekommst Einträge aus dem internen Wiki, die der Chef selbst gepflegt hat, und die Frage eines Mitarbeiters – manchmal mit Fotos von der Baustelle. Die Antwort des Chefs hat immer Vorrang; du ergänzt nur.

So entscheidest du:
1. Beantwortet einer der Wiki-Einträge die Frage im Kern (dieselbe Frage oder dasselbe Problem, auch wenn es anders formuliert ist)? Dann setze "match_id" auf die ID dieses Eintrags. Ein nur entfernt verwandtes Thema reicht nicht.
   - "answer" ist dann eine KURZE Ergänzung zur Antwort des Chefs – nur das, was der Eintrag nicht abdeckt: z. B. was auf den Fotos zu sehen ist und was das für die Antwort bedeutet, oder ein wichtiger Sicherheitshinweis zur konkreten Situation. 1 bis 4 Sätze oder Stichpunkte.
   - Wiederhole nicht, was schon im Eintrag steht, und widersprich dem Eintrag nie.
   - Deckt der Eintrag die Frage vollständig ab, lass "answer" leer.
2. Passt kein Eintrag, setze "match_id" auf 0 und beantworte die Frage selbst in "answer":
   - auf Deutsch, in der Du-Form, praxisnah und verständlich für Monteure und Azubis
   - kurz und strukturiert: ein Satz zur Einordnung, dann Schritte oder Stichpunkte
   - mit Sicherheitshinweisen, wo es darauf ankommt (Gas, Strom, Druck, Abgas, Trinkwasserhygiene, Kältemittel, Absturz, Asbest)
   - Weise darauf hin, wenn eine Arbeit nur Fachkräfte mit Zertifikat oder der Meister machen dürfen.
   - Wiki-Einträge zum Thema haben Vorrang vor allgemeinem Wissen; widersprich ihnen nicht.
3. Für beide Fälle gilt:
   - Firmenspezifisches (Preise, Zuständigkeiten, Kunden, interne Abläufe, Telefonnummern) erfindest du nicht. Sag stattdessen, dass das der Chef beantworten muss.
   - Fotos: Beschreibe kurz, was du erkennst, wenn es für die Antwort wichtig ist. Ist etwas nicht sicher zu erkennen (Typenschild unleserlich, Bauteil verdeckt), sag das offen und nenne, was man prüfen oder fotografieren sollte. Rate keine Gerätetypen oder Messwerte.
   - Wenn du unsicher bist, sag das offen.
   - Formatierung: einfache Absätze, Listen mit "-" oder "1.", **fett** für Wichtiges. Keine Überschriften, keine Tabellen.
4. "related_ids": bis zu 3 weitere IDs von Wiki-Einträgen, die zum Thema hilfreich sind (sonst leer).`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    match_id: { type: "integer", description: "ID des passenden Wiki-Eintrags oder 0" },
    answer: { type: "string", description: "Bei Treffer: kurze Ergänzung zur Chef-Antwort oder leer. Ohne Treffer: eigene Antwort." },
    related_ids: { type: "array", items: { type: "integer" } },
  },
  required: ["match_id", "answer", "related_ids"],
  additionalProperties: false,
};

type Entry = {
  id: number; title: string; answer: string; category_id: number | null; category: string | null; keywords: string;
  attachments: unknown; is_example: boolean; updated_at: string; score: number; title_sim: number;
  relevanz: number; gewicht: number;
};

function norm(s: string) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Wer fragt?
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (!user) return json({ error: "nicht_angemeldet" }, 401);
  const { data: profile } = await admin.from("profiles").select("id, active, role, must_change_password").eq("id", user.id).maybeSingle();
  if (!profile?.active) return json({ error: "zugang_gesperrt" }, 403);
  if (profile.must_change_password) return json({ error: "passwort_aendern" }, 403);

  let question = "";
  let photoPaths: string[] = [];
  try {
    const body = await req.json();
    question = String(body?.question ?? "").trim().replace(/\s+/g, " ");
    if (Array.isArray(body?.photos)) photoPaths = body.photos.map((p: unknown) => String(p ?? ""));
  } catch { /* leer */ }
  if (question.length < 3) return json({ error: "frage_zu_kurz" }, 400);
  if (question.length > 1000) question = question.slice(0, 1000);
  // Fotos nur aus dem eigenen Ordner, höchstens 3
  photoPaths = [...new Set(photoPaths)].filter((p) => p.startsWith(`${user.id}/`) && !p.includes("..")).slice(0, MAX_PHOTOS);
  const hasPhotos = photoPaths.length > 0;

  const log = async (result: "wiki" | "ki" | "keine", entry?: Entry | null, questionId?: number | null) => {
    const { error } = await admin.from("ask_log").insert({
      result, entry_id: entry?.id ?? null, category_id: entry?.category_id ?? null, question_id: questionId ?? null, has_photos: hasPhotos,
    });
    if (error) console.error("ask_log", error);
  };
  const storeQuestion = async (aiAnswer: string | null) => {
    const { data, error } = await admin.from("questions")
      .insert({ question, asked_by: user.id, ai_answer: aiAnswer, photos: photoPaths }).select("id").single();
    if (error) console.error("questions insert", error);
    return data?.id ?? null;
  };

  // 1) Suche im Wiki
  const { data: found, error: searchError } = await admin.rpc("search_entries", { q: question, max_results: 8 });
  if (searchError) console.error("search_entries", searchError);
  const candidates: Entry[] = (found as Entry[]) ?? [];
  const byId = new Map(candidates.map((e) => [e.id, e]));
  const top = candidates[0];
  const sameTitle = !!top && norm(top.title) === norm(question);
  const exact = top && !hasPhotos && (sameTitle || top.title_sim >= EXACT_MATCH_SIMILARITY) ? top : null;
  const likely = top && (sameTitle || top.score >= LIKELY_MATCH_SCORE || top.title_sim >= LIKELY_MATCH_SIMILARITY ||
    MATCH_RULES.some((r) => (top.relevanz ?? 0) >= r.relevanz && (top.gewicht ?? 0) >= r.gewicht)) ? top : null;
  const others = (e: Entry) => candidates.filter((c) => c.id !== e.id).slice(0, 3);

  // Antwort des Chefs (+ ggf. Ergänzung der KI). Die Frage ist damit beantwortet – Fotos werden nicht mehr gebraucht.
  const chefAnswer = async (entry: Entry, related: Entry[], via: string, supplement: string | null,
                            opts: { demo?: boolean; note?: string } = {}) => {
    await log("wiki", entry);
    if (hasPhotos) await admin.storage.from(PHOTO_BUCKET).remove(photoPaths);
    return json({ type: "entry", entry, related, via, supplement: supplement || null, supplement_demo: !!opts.demo, note: opts.note ?? null });
  };

  // 2) (Fast) dieselbe Frage -> direkt die Antwort des Chefs
  if (exact) return chefAnswer(exact, others(exact), "suche", null);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

  // Demo-Modus (ohne Claude-Schlüssel): Chef-Antwort nach Suchwert, vorbereitete Demo-KI als Ergänzung bzw. Antwort
  if (!apiKey) {
    const demo = findDemoAnswer(question);
    if (likely) {
      return chefAnswer(likely, others(likely), "suche", demo, { demo: !!demo, note: hasPhotos ? "fotos_demo" : demo ? undefined : "ki_demo" });
    }
    if (demo) {
      const id = await storeQuestion(demo);
      await log("ki", null, id);
      return json({ type: "ai", demo: true, answer: demo, related: candidates.slice(0, 3), question_id: id });
    }
    const id = await storeQuestion(null);
    await log("keine", null, id);
    return json({ type: "none", question_id: id, related: candidates.slice(0, 3), reason: "ki_demo" });
  }

  // Kostenbremse: zählt alle KI-Aufrufe der letzten 24 Stunden
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count: used } = await admin.from("ki_nutzung").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).gte("created_at", since);
  if ((used ?? 0) >= MAX_AI_CALLS_PER_DAY) {
    if (likely) return chefAnswer(likely, others(likely), "suche", null, { note: "tageslimit" });
    const id = await storeQuestion(null);
    await log("keine", null, id);
    return json({ type: "none", question_id: id, related: candidates.slice(0, 3), reason: "tageslimit" });
  }
  await admin.from("ki_nutzung").insert({ user_id: user.id });
  await admin.from("ki_nutzung").delete().lt("created_at", new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString());

  // Fotos laden (aus dem privaten Speicher)
  const images: { type: "image"; source: { type: "base64"; media_type: string; data: string } }[] = [];
  for (const p of photoPaths) {
    const { data: blob, error } = await admin.storage.from(PHOTO_BUCKET).download(p);
    if (error || !blob) { console.error("foto laden", p, error); continue; }
    const type = /^image\/(jpeg|png|webp)$/.test(blob.type) ? blob.type : "image/jpeg";
    images.push({ type: "image", source: { type: "base64", media_type: type, data: toBase64(new Uint8Array(await blob.arrayBuffer())) } });
  }

  // 3) Claude fragen
  const wiki = candidates.length
    ? candidates.map((e) => `<eintrag id="${e.id}" kategorie="${e.category ?? ""}">\n<titel>${e.title}</titel>\n<stichworte>${e.keywords}</stichworte>\n<antwort>\n${e.answer.slice(0, 4000)}\n</antwort>\n</eintrag>`).join("\n")
    : "(keine passenden Einträge gefunden)";
  const text = `<wiki_eintraege>\n${wiki}\n</wiki_eintraege>\n\n` +
    (images.length ? `<fotos>${images.length} Foto(s) vom Mitarbeiter – siehe oben</fotos>\n\n` : "") +
    `<frage>\n${question}\n</frage>`;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: EFFORT, format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: [...images, { type: "text", text }] }],
      // deno-lint-ignore no-explicit-any
    } as any);

    if (msg.stop_reason === "refusal") {
      if (likely) return chefAnswer(likely, others(likely), "suche", null);
      const id = await storeQuestion(null);
      await log("keine", null, id);
      return json({ type: "none", question_id: id, related: candidates.slice(0, 3), reason: "ki_abgelehnt" });
    }
    const out = JSON.parse(msg.content.filter((b: { type: string }) => b.type === "text")
      .map((b: { type: string; text?: string }) => b.text ?? "").join("")) as { match_id: number; answer: string; related_ids: number[] };

    const match = out.match_id ? byId.get(out.match_id) : undefined;
    const related = (out.related_ids || []).map((id) => byId.get(id)).filter((e): e is Entry => !!e && e.id !== match?.id).slice(0, 3);
    const answer = (out.answer || "").trim();
    if (match) return chefAnswer(match, related, "ki", answer || null);

    const id = await storeQuestion(answer || null);
    await log(answer ? "ki" : "keine", null, id);
    if (!answer) return json({ type: "none", question_id: id, related, reason: "keine_antwort" });
    return json({ type: "ai", answer, related, question_id: id });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) console.error("Claude: rate limit");
    else if (err instanceof Anthropic.AuthenticationError) console.error("Claude: API-Schlüssel ungültig");
    else if (err instanceof Anthropic.APIError) console.error("Claude API", err.status, err.message);
    else console.error("frage", err);
    // Ohne KI trotzdem die Chef-Antwort zeigen, wenn die Suche eine gute gefunden hat
    if (likely) return chefAnswer(likely, others(likely), "suche", null, { note: "ki_fehler" });
    const id = await storeQuestion(null);
    await log("keine", null, id);
    return json({ type: "none", question_id: id, related: candidates.slice(0, 3), reason: "ki_fehler" });
  }
});
