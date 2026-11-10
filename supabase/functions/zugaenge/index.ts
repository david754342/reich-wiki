// Reich Wiki – Funktion "zugaenge": Zugangsverwaltung, nur für den Chef
// Aktionen: list, create, update (Name/Rolle/aktiv), rename (Benutzername), reset_password
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const USERNAME_DOMAIN = "wiki.reich-haustechnik.de"; // nur intern als Login-Kennung, es werden keine Mails verschickt
const LOCK_DURATION = "876000h"; // gesperrt = ca. 100 Jahre

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const cleanName = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
const cleanUser = (s: unknown) => String(s ?? "").trim().toLowerCase();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: me } = await admin.auth.getUser(token);
  if (!me?.user) return json({ error: "nicht_angemeldet" }, 401);
  const { data: myProfile } = await admin.from("profiles").select("id, role, active").eq("id", me.user.id).maybeSingle();
  if (!myProfile?.active || myProfile.role !== "chef") return json({ error: "nur_chef" }, 403);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* leer */ }
  const action = String(body.action ?? "");

  const otherActiveChefs = async (excludeId: string) => {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true })
      .eq("role", "chef").eq("active", true).neq("id", excludeId);
    return count ?? 0;
  };

  try {
    if (action === "list") {
      const { data: profiles, error } = await admin.from("profiles").select("*").order("role").order("username");
      if (error) throw error;
      const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const lastLogin = new Map((authList?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]));
      return json({ users: (profiles ?? []).map((p) => ({ ...p, last_sign_in_at: lastLogin.get(p.id) ?? null })) });
    }

    if (action === "create") {
      const username = cleanUser(body.username);
      const display_name = cleanName(body.display_name) || username;
      const role = body.role === "chef" ? "chef" : "mitarbeiter";
      const password = String(body.password ?? "");
      if (!USERNAME_RE.test(username)) return json({ error: "benutzername_ungueltig" }, 400);
      if (password.length < 10) return json({ error: "passwort_zu_kurz" }, 400);
      const { data: exists } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
      if (exists) return json({ error: "benutzername_vergeben" }, 409);
      const { data: created, error } = await admin.auth.admin.createUser({
        email: `${username}@${USERNAME_DOMAIN}`, password, email_confirm: true,
        user_metadata: { username, display_name },
      });
      if (error || !created?.user) return json({ error: "anlegen_fehlgeschlagen", detail: error?.message }, 400);
      const { error: pErr } = await admin.from("profiles").insert({ id: created.user.id, username, display_name, role });
      if (pErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        throw pErr;
      }
      return json({ ok: true, id: created.user.id });
    }

    const id = String(body.id ?? "");
    const { data: target } = await admin.from("profiles").select("*").eq("id", id).maybeSingle();
    if (!target) return json({ error: "nicht_gefunden" }, 404);

    if (action === "update") {
      const patch: Record<string, unknown> = {};
      if (body.display_name !== undefined) patch.display_name = cleanName(body.display_name) || target.username;
      if (body.role !== undefined) patch.role = body.role === "chef" ? "chef" : "mitarbeiter";
      if (body.active !== undefined) patch.active = !!body.active;
      const losesChef = target.role === "chef" && target.active &&
        ((patch.role && patch.role !== "chef") || patch.active === false);
      if (losesChef && (await otherActiveChefs(target.id)) === 0) return json({ error: "letzter_chef" }, 400);
      if (target.id === myProfile.id && patch.active === false) return json({ error: "nicht_selbst_sperren" }, 400);
      const { error } = await admin.from("profiles").update(patch).eq("id", id);
      if (error) throw error;
      if (patch.active !== undefined) {
        await admin.auth.admin.updateUserById(id, { ban_duration: patch.active ? "none" : LOCK_DURATION });
      }
      return json({ ok: true });
    }

    if (action === "rename") {
      const username = cleanUser(body.username);
      if (!USERNAME_RE.test(username)) return json({ error: "benutzername_ungueltig" }, 400);
      const { data: exists } = await admin.from("profiles").select("id").eq("username", username).neq("id", id).maybeSingle();
      if (exists) return json({ error: "benutzername_vergeben" }, 409);
      const { error: aErr } = await admin.auth.admin.updateUserById(id, {
        email: `${username}@${USERNAME_DOMAIN}`, email_confirm: true, user_metadata: { username },
      });
      if (aErr) return json({ error: "umbenennen_fehlgeschlagen", detail: aErr.message }, 400);
      const { error } = await admin.from("profiles").update({ username }).eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "reset_password") {
      const password = String(body.password ?? "");
      if (password.length < 10) return json({ error: "passwort_zu_kurz" }, 400);
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return json({ error: "passwort_fehlgeschlagen", detail: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "unbekannte_aktion" }, 400);
  } catch (err) {
    console.error("zugaenge", action, err);
    return json({ error: "serverfehler" }, 500);
  }
});
