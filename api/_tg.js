// Umumiy yordamchi funksiyalar (Vercel "_" bilan boshlangan fayllarni alohida manzil qilmaydi)
const crypto = require("crypto");
const CHANNEL = process.env.TELEGRAM_CHANNEL || "@ShirinabonuBorixodjayeva";
const SITE = process.env.SITE_URL || "https://sat-with-shirinabonu.vercel.app";
const token = () => process.env.TELEGRAM_BOT_TOKEN || "";

async function tg(method, params) {
  const r = await fetch("https://api.telegram.org/bot" + token() + "/" + method, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params || {}),
  });
  return r.json().catch(() => ({ ok: false }));
}
function linkKey() { return crypto.createHash("sha256").update("sws-link:" + token()).digest(); }
function signLink(userId, days) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * (days || 60);
  const payload = userId + "." + exp;
  const sig = crypto.createHmac("sha256", linkKey()).update(payload).digest("hex").slice(0, 32);
  return payload + "." + sig;
}
function verifyLink(link) {
  const parts = String(link || "").split(".");
  if (parts.length !== 3) return null;
  const payload = parts[0] + "." + parts[1];
  const sig = crypto.createHmac("sha256", linkKey()).update(payload).digest("hex").slice(0, 32);
  if (sig.length !== parts[2].length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(parts[2]))) return null;
  if (Number(parts[1]) < Date.now() / 1000) return null;
  return Number(parts[0]);
}
function verifyAuth(auth) {
  if (!auth || typeof auth !== "object" || !auth.hash || !auth.id) return null;
  const { hash, ...rest } = auth;
  const dataCheck = Object.keys(rest).filter((k) => rest[k] !== undefined && rest[k] !== null).sort().map((k) => k + "=" + rest[k]).join("\n");
  const secret = crypto.createHash("sha256").update(token()).digest();
  const calc = crypto.createHmac("sha256", secret).update(dataCheck).digest("hex");
  if (calc.length !== String(hash).length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(String(hash)))) return null;
  if (Date.now() / 1000 - Number(auth.auth_date || 0) > 60 * 60 * 24 * 60) return null;
  return Number(auth.id);
}
// Telegram Mini App initData tekshiruvi — har safar hozir ochgan akkauntni aniq bildiradi
function verifyWebApp(initData) {
  try {
    const params = new URLSearchParams(String(initData || ""));
    const hash = params.get("hash"); if (!hash) return null;
    params.delete("hash");
    const dcs = Array.from(params.keys()).sort().map((k) => k + "=" + params.get(k)).join("\n");
    const secret = crypto.createHmac("sha256", "WebAppData").update(token()).digest();
    const calc = crypto.createHmac("sha256", secret).update(dcs).digest("hex");
    if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
    if (Date.now() / 1000 - Number(params.get("auth_date") || 0) > 60 * 60 * 24 * 7) return null;
    const user = JSON.parse(params.get("user") || "null");
    return user && user.id ? Number(user.id) : null;
  } catch (e) { return null; }
}
async function memberStatus(userId) {
  const m = await tg("getChatMember", { chat_id: CHANNEL, user_id: Number(userId) });
  if (!m.ok) return { ok: false, error: m.description || "unknown" };
  const st = m.result.status;
  return { ok: true, member: st === "creator" || st === "administrator" || st === "member" || (st === "restricted" && m.result.is_member), status: st };
}
// Sayt sessiyasi: Authorization: Bearer <userId.exp.sig>
function sessionUser(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || "";
  const t = String(h).replace(/^Bearer\s+/i, "");
  return t ? verifyLink(t) : null;
}
// Admin: TELEGRAM_ADMIN_ID yoki kanal egasi (creator)
let adminCache = null;
async function adminId() {
  if (process.env.TELEGRAM_ADMIN_ID) return Number(process.env.TELEGRAM_ADMIN_ID);
  if (adminCache) return adminCache;
  const r = await tg("getChatAdministrators", { chat_id: CHANNEL });
  const c = r.ok && (r.result || []).find((m) => m.status === "creator");
  if (c) adminCache = c.user.id;
  return adminCache;
}
function webhookSecret() { return crypto.createHash("sha256").update("sws-hook:" + token()).digest("hex").slice(0, 40); }

module.exports = { CHANNEL, SITE, token, tg, signLink, verifyLink, verifyAuth, verifyWebApp, memberStatus, webhookSecret, sessionUser, adminId };
