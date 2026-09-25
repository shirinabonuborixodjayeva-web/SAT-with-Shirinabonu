// Telegram kanalga obuna tekshiruvi (sayt uchun).
// Vercel'da TELEGRAM_BOT_TOKEN bo'lishi kerak; bo'lmasa sayt ochiq ishlayveradi (configured: false).
const T = require("./_tg");
let botCache = null;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!T.token()) { res.status(200).json({ configured: false }); return; }
  if (!botCache) { const me = await T.tg("getMe"); if (me.ok) botCache = { username: me.result.username, id: me.result.id }; }
  const channelUrl = "https://t.me/" + T.CHANNEL.replace(/^@/, "");
  const base = { configured: !!botCache, bot: botCache && botCache.username, channel: T.CHANNEL, channelUrl };

  if (req.method === "GET") {
    const q = req.query || {};
    if (q.diag && botCache) { const st = await T.memberStatus(botCache.id); const wh = await T.tg("getWebhookInfo"); res.status(200).json({ ...base, botInChannel: st, webhook: wh.ok ? { url: wh.result.url, pending: wh.result.pending_update_count, lastError: wh.result.last_error_message || null } : null }); return; }
    if (q.setup && botCache) {
      const r = await T.tg("setWebhook", { url: T.SITE + "/api/tg-webhook", secret_token: T.webhookSecret(), allowed_updates: ["message", "callback_query"] });
      await T.tg("setChatMenuButton", { menu_button: { type: "web_app", text: "Sayt", web_app: { url: T.SITE + "/" } } });
      await T.tg("setMyCommands", { commands: [{ command: "start", description: "Saytga kirish havolasini olish" }] });
      res.status(200).json({ ...base, webhookSet: r.ok, description: r.description }); return;
    }
    res.status(200).json(base); return;
  }
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const userId = (body && body.webapp) ? T.verifyWebApp(body.webapp) : (body && body.link && T.verifyLink(body.link)) || (body && body.auth && T.verifyAuth(body.auth));
  if (!userId) { res.status(200).json({ ...base, ok: false, reason: "bad_auth" }); return; }
  const m = await T.memberStatus(userId);
  if (!m.ok) { res.status(200).json({ ...base, ok: false, reason: "check_failed", detail: m.error }); return; }
  res.status(200).json({ ...base, ok: m.member, reason: m.member ? "member" : "not_member" });
};
