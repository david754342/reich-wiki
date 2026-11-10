// Reich Wiki – Funktion "frage"
// 1. sucht passende Einträge im Wiki
// 2. eindeutiger Treffer  -> Antwort des Chefs (ohne KI)
// 3. sonst fragt Claude: passt doch ein Eintrag? Wenn nein, antwortet Claude selbst
//    und die Frage landet beim Chef unter "Offene Fragen".
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { findDemoAnswer } from "./demo.ts";

const MODEL = "claude-opus-5-5";
const EFFORT = "low"; // low | medium | high – höher = gründlicher, aber langsamer und teurer
const DIRECT_MATCH_SIMILARITY = 0.6; // Titel-Ähnlichkeit, ab der ohne KI geantwortet wird
const MAX_AI_QUESTIONS_PER_DAY = 40; // Kostenbremse pro Person

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const SYSTEM = `Du bist der interne Wissens-Assistent der Reich Haustechnik GmbH in Bad Krozingen, einem Meisterbetrieb für Bad, Sanitär, Heizung, Wärmepumpen und Klimaanlagen. Mitarbeiter und Auszubildende stellen dir Fragen aus ihrem Arbeitsalltag.

Du bekommst Einträge aus dem internen Wiki, die der Chef selbst gepflegt hat, und die Frage eines Mitarbeiters.

So entscheidest du:
1. Beantwortet einer der Wiki-Einträge die Frage inhaltlich (dieselbe Frage, auch wenn sie anders formuliert ist)? Dann setze "match_id" auf die ID dieses Eintrags und "answer" auf einen leeren Text. Wähle nur dann einen Eintrag, wenn er die Frage wirklich beantwortet – ein nur verwandtes Thema reicht nicht.
2. Passt kein Eintrag, setze "match_id" auf 0 und beantworte die Frage selbst in "answer":
   - auf Deutsch, in der Du-Form, praxisnah und verständlich für Monteure und Azubis
   - kurz und strukturiert: ein Satz zur Einordnung, dann Schritte oder Stichpunkte
   - mit Sicherheitshinweisen, wo es darauf ankommt (Gas, Strom, Druck, Abgas, Trinkwasserhygiene, Kältemittel, Absturz, Asbest)
   - Weise darauf hin, wenn eine Arbeit nur Fachkräfte mit Zertifikat oder der Meister machen dürfen.
   - Wiki-Einträge zum Thema haben Vorrang vor allgemeinem Wissen; widersprich ihnen nicht.
   - Firmenspezifisches (Preise, Zuständigkeiten, Kunden, interne Abläufe, Telefonnummern) erfindest du nicht. Sag stattdessen, dass das der Chef beantworten muss.
   - Wenn du unsicher bist, sag das offen.
   - Formatierung: einfache Absätze, Listen mit "-" oder "1.", **fett** für Wichtiges. Keine Überschriften, keine Tabellen.
3. "related_ids": bis zu 3 IDs von Wiki-Einträgen, die zum Thema hilfreich sind (sonst leer).`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    match_id: { type: "integer", description: "ID des passenden Wiki-Eintrags oder 0" },
    answer: { type: "string", description: "Eigene Antwort, leer wenn match_id gesetzt ist" },
    related_ids: { type: "array", items: { type: "integer" } },
  },
  required: ["match_id", "answer", "related_ids"],
  additionalProperties: false,
};

type Entry = {
  id: number; title: string; answer: string; category: string | null; keywords: string;
  attachments: unknown; is_example: boolean; updated_at: string; score: number; title_sim: number;
};

function norm(s: string) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
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
  const { data: profile } = await admin.from("profiles").select("id, active, role").eq("id", user.id).maybeSingle();
  if (!profile?.active) return json({ error: "zugang_gesperrt" }, 403);

  let question = "";
  try {
    const body = await req.json();
    question = String(body?.question ?? "").trim().replace(/\s+/g, " ");
  } catch { /* leer */ }
  if (question.length < 3) return json({ error: "frage_zu_kurz" }, 400);
  if (question.length > 1000) question = question.slice(0, 1000);

  // 1) Suche im Wiki
  const { data: found, error: searchError } = await admin.rpc("search_entries", { q: question, max_results: 8 });
  if (searchError) console.error("search_entries", searchError);
  const candidates: Entry[] = (found as Entry[]) ?? [];
  const byId = new Map(candidates.map((e) => [e.id, e]));

  // 2) Eindeutiger Treffer -> direkt die Antwort des Chefs
  const top = candidates[0];
  if (top && (top.title_sim >= DIRECT_MATCH_SIMILARITY || norm(top.title) === norm(question))) {
    return json({ type: "entry", entry: top, related: candidates.slice(1, 4), via: "suche" });
  }

  const storeQuestion = async (aiAnswer: string | null) => {
    const { data, error } = await admin.from("questions")
      .insert({ question, asked_by: user.id, ai_answer: aiAnswer }).select("id").single();
    if (error) console.error("questions insert", error);
    return data?.id ?? null;
  };

  // Kostenbremse
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("questions").select("id", { count: "exact", head: true })
    .eq("asked_by", user.id).gte("created_at", since);
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

  // Demo-Modus: ohne Claude-Schlüssel antwortet eine vorbereitete Demo-KI auf ausgewählte Fragen
  if (!apiKey) {
    const demo = findDemoAnswer(question);
    if (demo) {
      const id = await storeQuestion(demo);
      return json({ type: "ai", demo: true, answer: demo, related: candidates.slice(0, 3), question_id: id });
    }
    const id = await storeQuestion(null);
    return json({ type: "none", question_id: id, related: candidates.slice(0, 3), reason: "ki_demo" });
  }

  if ((count ?? 0) >= MAX_AI_QUESTIONS_PER_DAY) {
    const id = await storeQuestion(null);
    return json({
      type: "none", question_id: id, related: candidates.slice(0, 3),
      reason: !apiKey ? "ki_nicht_eingerichtet" : "tageslimit",
    });
  }

  // 3) Claude fragen
  const wiki = candidates.length
    ? candidates.map((e) => `<eintrag id="${e.id}" kategorie="${e.category ?? ""}">\n<titel>${e.title}</titel>\n<stichworte>${e.keywords}</stichworte>\n<antwort>\n${e.answer.slice(0, 4000)}\n</antwort>\n</eintrag>`).join("\n")
    : "(keine passenden Einträge gefunden)";

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: EFFORT, format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      system: SYSTEM,
      messages: [{
        role: "user",
        content: `<wiki_eintraege>\n${wiki}\n</wiki_eintraege>\n\n<frage>\n${question}\n</frage>`,
      }],
      // deno-lint-ignore no-explicit-any
    } as any);

    if (msg.stop_reason === "refusal") {
      const id = await storeQuestion(null);
      return json({ type: "none", question_id: id, related: candidates.slice(0, 3), reason: "ki_abgelehnt" });
    }
    const text = msg.content.filter((b: { type: string }) => b.type === "text")
      .map((b: { type: string; text?: string }) => b.text ?? "").join("");
    const out = JSON.parse(text) as { match_id: number; answer: string; related_ids: number[] };

    const match = out.match_id ? byId.get(out.match_id) : undefined;
    const related = (out.related_ids || []).map((id) => byId.get(id)).filter((e): e is Entry => !!e && e.id !== match?.id).slice(0, 3);
    if (match) {
      return json({ type: "entry", entry: match, related, via: "ki" });
    }
    const answer = (out.answer || "").trim();
    const id = await storeQuestion(answer || null);
    if (!answer) return json({ type: "none", question_id: id, related, reason: "keine_antwort" });
    return json({ type: "ai", answer, related, question_id: id });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) console.error("Claude: rate limit");
    else if (err instanceof Anthropic.AuthenticationError) console.error("Claude: API-Schlüssel ungültig");
    else if (err instanceof Anthropic.APIError) console.error("Claude API", err.status, err.message);
    else console.error("frage", err);
    const id = await storeQuestion(null);
    return json({ type: "none", question_id: id, related: candidates.slice(0, 3), reason: "ki_fehler" });
  }
});
