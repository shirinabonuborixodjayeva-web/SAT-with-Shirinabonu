// Telegram kanalga obuna tekshiruvi.
// Vercel'da TELEGRAM_BOT_TOKEN muhit o'zgaruvchisi bo'lishi kerak (bot kanalga admin qilingan bo'lishi shart).
// Token bo'lmasa, sayt ochiq ishlayveradi (configured: false).
const crypto = require("crypto");
const CHANNEL = process.env.TELEGRAM_CHANNEL || "@ShirinabonuBorixodjayeva";
let botCache = null;

async function tg(method, params) {
  const r = await fetch("https://api.telegram.org/bot" + process.env.TELEGRAM_BOT_TOKEN + "/" + method, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params || {}),
  });
  return r.json().catch(() => ({ ok: false }));
}

function verifyAuth(auth, token) {
  if (!auth || typeof auth !== "object" || !auth.hash || !auth.id) return false;
  const { hash, ...rest } = auth;
  const dataCheck = Object.keys(rest).filter((k) => rest[k] !== undefined && rest[k] !== null).sort().map((k) => k + "=" + rest[k]).join("\n");
  const secret = crypto.createHash("sha256").update(token).digest();
  const calc = crypto.createHmac("sha256", secret).update(dataCheck).digest("hex");
  if (calc.length !== String(hash).length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(String(hash)))) return false;
  const age = Date.now() / 1000 - Number(auth.auth_date || 0);
  return age < 60 * 60 * 24 * 30; // 30 kun ichida kirgan bo'lishi kerak
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { res.status(200).json({ configured: false }); return; }
  if (!botCache) { const me = await tg("getMe"); if (me.ok) botCache = me.result.username; }
  const channelUrl = "https://t.me/" + CHANNEL.replace(/^@/, "");
  if (req.method === "GET") { res.status(200).json({ configured: !!botCache, bot: botCache, channel: CHANNEL, channelUrl }); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const auth = body && body.auth;
  if (!verifyAuth(auth, token)) { res.status(200).json({ configured: true, ok: false, reason: "bad_auth", bot: botCache, channelUrl }); return; }
  const m = await tg("getChatMember", { chat_id: CHANNEL, user_id: Number(auth.id) });
  if (!m.ok) { res.status(200).json({ configured: true, ok: false, reason: "check_failed", detail: m.description || "", bot: botCache, channelUrl }); return; }
  const st = m.result.status;
  const member = st === "creator" || st === "administrator" || st === "member" || (st === "restricted" && m.result.is_member);
  res.status(200).json({ configured: true, ok: member, reason: member ? "member" : "not_member", bot: botCache, channelUrl });
};
