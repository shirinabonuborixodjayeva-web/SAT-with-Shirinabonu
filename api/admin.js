// Admin paneli: saytdan foydalangan barcha akkauntlar ro'yxati (faqat admin uchun).
const T = require("./_tg");
const K = require("./_kv");

function body(req) { let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } } return b || {}; }
const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };
const fmt = (t) => new Date(t).toLocaleDateString("uz-UZ", { timeZone: "Asia/Tashkent" });

// Eski foydalanuvchilarni ham topish: trial:* va prof:* kalitlarini skanerlash
async function scanIds(pattern) {
  const ids = new Set(); let cursor = "0"; let guard = 0;
  do {
    const r = await K.kv("SCAN", cursor, "MATCH", pattern, "COUNT", "1000");
    cursor = String((r && r[0]) || "0");
    ((r && r[1]) || []).forEach((k) => { const id = String(k).split(":")[1]; if (/^\d+$/.test(id)) ids.add(id); });
  } while (cursor !== "0" && ++guard < 50);
  return ids;
}

async function grant(uid, days) {
  const cur = await K.premiumUntil(uid);
  const until = Math.max(cur, Date.now()) + days * 86400000;
  await K.kvPipe([["SET", "prem:" + uid, String(until)], ["SET", "paid:" + uid, "1"], ["LPUSH", "paylog", JSON.stringify({ uid: Number(uid), days, at: Date.now(), by: "admin" })]]);
  return until;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const uid = T.sessionUser(req);
  if (!uid) { res.status(401).json({ error: "no_session" }); return; }
  const admin = await T.adminId();
  if (!admin || Number(uid) !== Number(admin)) { res.status(403).json({ error: "not_admin" }); return; }
  if (!K.kvOn()) { res.status(200).json({ storage: false, users: [] }); return; }
  try {
    const b = req.method === "POST" ? body(req) : {};
    if (b.grant && Number(b.grant.uid)) {
      const id = Number(b.grant.uid); const days = Math.max(1, Math.min(3650, Number(b.grant.days) || K.PREMIUM_DAYS));
      const until = await grant(id, days);
      await T.tg("sendMessage", { chat_id: id, text: "🎉 Sizga Premium " + fmt(until) + " gacha yoqildi!", reply_markup: { inline_keyboard: [[{ text: "🚀 Saytga kirish", web_app: { url: T.SITE + "/" } }]] } });
    }
    if (b.revoke && Number(b.revoke)) await K.kvPipe([["DEL", "prem:" + Number(b.revoke)], ["DEL", "paid:" + Number(b.revoke)]]);

    const ids = new Set(((await K.kv("ZRANGE", "users", "0", "-1")) || []).map(String));
    const [a, c] = await Promise.all([scanIds("trial:*"), scanIds("prof:*")]);
    a.forEach((x) => ids.add(x)); c.forEach((x) => ids.add(x));
    const list = [...ids];
    const today = K.today(); const now = Date.now();
    const kinds = Object.keys(K.FREE_DAILY);
    const F = 8 + kinds.length;
    const users = [];
    for (let i = 0; i < list.length; i += 80) {
      const chunk = list.slice(i, i + 80);
      const cmds = [];
      chunk.forEach((id) => {
        cmds.push(["GET", "prof:" + id], ["GET", "trial:" + id], ["GET", "prem:" + id], ["GET", "paid:" + id], ["HGET", "roster", id], ["ZSCORE", "lastseen", id], ["SCARD", "seen:" + id], ["GET", "refby:" + id]);
        kinds.forEach((k) => cmds.push(["GET", "use:" + id + ":" + today + ":" + k]));
      });
      const r = await K.kvPipe(cmds);
      chunk.forEach((id, j) => {
        const v = r.slice(j * F, (j + 1) * F);
        const prof = parse(v[0]) || {}; const ros = parse(v[4]) || {};
        const first = Number(v[1]) || null; const until = Number(v[2]) || 0;
        const last = Math.max(Number(v[5]) || 0, Number(ros.at) || 0) || null;
        const usage = {}; kinds.forEach((k, n) => { usage[k] = Number(v[8 + n]) || 0; });
        users.push({
          id: Number(id), name: prof.name || ros.name || "", tgName: prof.tgName || "", username: prof.username || "",
          target: prof.target || null, examDate: prof.examDate || null, goal: prof.goal || null, onboarded: !!prof.onboarded,
          firstSeen: first, lastSeen: last, online: !!last && now - last < 3 * 60000,
          premiumUntil: until || null, premium: until > now, paid: !!v[3], trial: until > now && !v[3],
          minutesToday: ros.day === today ? ros.minutesToday || 0 : 0, streak: ros.streak || 0, totalMinutes: ros.totalMinutes || 0, mocks: ros.mocks || 0,
          questionsSeen: Number(v[6]) || 0, refBy: Number(v[7]) || null, usage,
        });
      });
    }
    users.sort((x, y) => (y.lastSeen || y.firstSeen || 0) - (x.lastSeen || x.firstSeen || 0));
    const day = 86400000;
    const stats = {
      total: users.length,
      activeToday: users.filter((u) => u.lastSeen && now - u.lastSeen < day).length,
      active7: users.filter((u) => u.lastSeen && now - u.lastSeen < 7 * day).length,
      online: users.filter((u) => u.online).length,
      newToday: users.filter((u) => u.firstSeen && now - u.firstSeen < day).length,
      trial: users.filter((u) => u.trial).length,
      paid: users.filter((u) => u.premium && u.paid).length,
    };
    const payments = ((await K.kv("LRANGE", "paylog", "0", "49")) || []).map(parse).filter(Boolean);
    res.status(200).json({ storage: true, stats, users, payments, plans: { price: K.PRICE_UZS, price3: K.PRICE3_UZS } });
  } catch (e) {
    res.status(200).json({ storage: false, error: String(e && e.message || e), users: [] });
  }
};
