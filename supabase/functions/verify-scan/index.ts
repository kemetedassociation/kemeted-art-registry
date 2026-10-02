// Vérifie un scan de fiche : NFC (p + m signés par la puce) ou QR code (sans signature).
// Public (pas de JWT). Appelé par la page /a/ à chaque ouverture.
//
// Secrets : SUN_META_KEY, SUN_FILE_KEY (32 hex chacun) — les clés programmées dans les puces.
import { createClient } from "npm:@supabase/supabase-js@2";
import { ecb } from "npm:@noble/ciphers@1.3.0/aes";
import { createSun } from "../_shared/sun.js";

const sun = createSun(ecb);
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const { id, p, m } = req.method === "POST"
    ? await req.json().catch(() => ({}))
    : Object.fromEntries(new URL(req.url).searchParams);
  if (typeof id !== "string" || !/^KEM-[A-Z]+-\d{4,}$/.test(id)) return json({ error: "identifiant invalide" }, 400);

  const userAgent = req.headers.get("user-agent")?.slice(0, 200) ?? null;
  const log = (result: string, extra: { tag_uid?: string; counter?: number } = {}) =>
    db.from("scans").insert({ artwork_id: id, result, user_agent: userAgent, ...extra });

  // Ouverture par QR code ou lien : la fiche est officielle, mais rien ne prouve que l'œuvre est là
  if (!p || !m) {
    await log("qr");
    return json({ status: "qr" });
  }

  const r = sun.verify({ p, m, metaKey: Deno.env.get("SUN_META_KEY")!, fileKey: Deno.env.get("SUN_FILE_KEY")! });
  if (!r.valid) {
    await log("invalide", { tag_uid: r.uid, counter: r.counter });
    return json({ status: "invalide" });
  }

  const { data: tag } = await db.from("nfc_tags").select("artwork_id, revoked").eq("uid", r.uid).maybeSingle();
  if (!tag) {
    await log("puce_inconnue", { tag_uid: r.uid, counter: r.counter });
    return json({ status: "puce_inconnue" });
  }
  if (tag.artwork_id !== id) {
    // Puce KEMETED authentique, mais posée sur (ou copiée vers) une autre fiche
    await log("autre_oeuvre", { tag_uid: r.uid, counter: r.counter });
    return json({ status: "autre_oeuvre", registered_artwork_id: tag.artwork_id });
  }
  if (tag.revoked) {
    await log("revoquee", { tag_uid: r.uid, counter: r.counter });
    return json({ status: "revoquee" });
  }

  const { data: fresh } = await db.rpc("consume_tag_counter", { p_uid: r.uid, p_counter: r.counter });
  if (!fresh) {
    await log("rejoue", { tag_uid: r.uid, counter: r.counter });
    return json({ status: "rejoue" });
  }
  await log("authentique", { tag_uid: r.uid, counter: r.counter });
  return json({ status: "authentique", counter: r.counter });
});
