// Jamiyat: kim onlayn, bugungi o'qish vaqti reytingi va umumiy chat.
const T = require("./_tg");
const K = require("./_kv");

function body(req) { let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } } return b || {}; }
const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const uid = T.sessionUser(req);
  if (!uid) { res.status(401).json({ error: "no_session" }); return; }
  if (!K.kvOn()) { res.status(200).json({ storage: false, members: [], messages: [] }); return; }
  try {
    const now = Date.now();
    const b = req.method === "POST" ? body(req) : {};
    if (b.ping && typeof b.ping === "object") {
      const p = b.ping;
      const rec = { id: uid, name: clean(p.name, 40) || "O'quvchi", minutesToday: Math.max(0, Math.min(1440, Number(p.minutesToday) || 0)), streak: Math.max(0, Math.min(3650, Number(p.streak) || 0)), studying: !!p.studying, day: K.today(), at: now };
      await K.kvPipe([["ZADD", "online", String(now), String(uid)], ["HSET", "roster", String(uid), JSON.stringify(rec)]]);
    }
    if (b.msg) {
      const text = clean(b.msg, 400);
      if (text) {
        const ok = await K.kv("SET", "chatrl:" + uid, "1", "NX", "EX", 4);
        if (ok !== "OK") { res.status(429).json({ error: "slow_down" }); return; }
        const prof = await K.getJSON("prof:" + uid, {});
        const name = clean(b.name || prof.name || prof.tgName, 40) || "O'quvchi";
        await K.kvPipe([["LPUSH", "chat", JSON.stringify({ uid, name, text, at: now })], ["LTRIM", "chat", "0", "199"]]);
      }
    }
    // Oxirgi 14 kunda faol bo'lganlar
    const ids = (await K.kv("ZREVRANGEBYSCORE", "online", "+inf", String(now - 14 * 86400000), "LIMIT", "0", "100")) || [];
    const recs = ids.length ? (await K.kv("HMGET", "roster", ...ids)) || [] : [];
    const today = K.today();
    const members = recs.map((s) => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean)
      .map((r) => ({ id: r.id, name: r.name, streak: r.streak || 0, minutesToday: r.day === today ? r.minutesToday || 0 : 0, studying: !!r.studying && now - r.at < 3 * 60000, online: now - r.at < 3 * 60000, lastSeen: r.at }));
    const raw = (await K.kv("LRANGE", "chat", "0", "59")) || [];
    const messages = raw.map((s) => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean).reverse();
    res.status(200).json({ storage: true, me: uid, members, messages });
  } catch (e) {
    res.status(200).json({ storage: false, error: String(e && e.message || e), members: [], messages: [] });
  }
};
