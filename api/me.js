// Foydalanuvchi akkaunti: profil (maqsad), Premium holati, kunlik limitlar, ko'rilgan savollar.
const T = require("./_tg");
const K = require("./_kv");

function body(req) { let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } } return b || {}; }

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const uid = T.sessionUser(req);
  const plans = { price: K.PRICE_UZS, price3: K.PRICE3_UZS, trialDays: K.TRIAL_DAYS, days: K.PREMIUM_DAYS, freeMocks: K.FREE_MOCKS, freeDaily: K.FREE_DAILY };
  if (!uid) { res.status(401).json({ error: "no_session", plans }); return; }
  if (!K.kvOn()) { res.status(200).json({ id: uid, storage: false, plans }); return; }
  try {
    const b = req.method === "POST" ? body(req) : {};
    if (b.use) { const r = await K.consume(uid, String(b.use), b.amount); res.status(200).json(r); return; }
    if (b.profile && typeof b.profile === "object") {
      const cur = await K.getJSON("prof:" + uid, {});
      const next = { ...cur, ...b.profile, updatedAt: Date.now() };
      const s = JSON.stringify(next); if (s.length > 20000) { res.status(413).json({ error: "too_big" }); return; }
      await K.kv("SET", "prof:" + uid, s);
    }
    const clean = (r) => {
      const num = (x) => (Number.isFinite(Number(x)) ? Math.round(Number(x)) : null);
      const pd = {}; Object.entries(r.perDomain || {}).slice(0, 12).forEach(([d, v]) => { if (v && Number(v.t) > 0) pd[String(d).slice(0, 60)] = { c: Math.max(0, num(v.c) || 0), t: Math.max(1, num(v.t) || 1) }; });
      const raw = (x) => (x && Number(x.t) > 0 ? { c: Math.max(0, num(x.c) || 0), t: num(x.t) } : null);
      let resp = null;
      if (r.responses && typeof r.responses === "object") { resp = {}; Object.entries(r.responses).slice(0, 200).forEach(([k, v]) => { if (/^[a-z0-9]{1,6}-\d{1,3}$/.test(k) && (typeof v === "number" || (typeof v === "string" && v.length <= 12))) resp[k] = v; }); }
      const dp = r.diffPath && typeof r.diffPath === "object" ? { rw1: r.diffPath.rw1 === "hard" ? "hard" : r.diffPath.rw1 ? "easy" : undefined, m1: r.diffPath.m1 === "hard" ? "hard" : r.diffPath.m1 ? "easy" : undefined } : null;
      return { at: num(r.at) || Date.now(), testId: num(r.testId), test: String(r.test || "").slice(0, 40), mode: String(r.mode || "full").slice(0, 10), modeArg: r.modeArg ? String(r.modeArg).slice(0, 6) : null, single: !!r.single, total: num(r.total), rw: num(r.rw), math: num(r.math), rwRaw: raw(r.rwRaw), mathRaw: raw(r.mathRaw), perDomain: pd, diffPath: dp, responses: resp, v: num(r.v) || 1 };
    };
    if (Array.isArray(b.deleteResults) && b.deleteResults.length) {
      const del = new Set(b.deleteResults.map(Number).filter(Number.isFinite));
      const existing = ((await K.kv("LRANGE", "res:" + uid, "0", "49")) || []).map((x) => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
      const keep = existing.filter((x) => !del.has(Number(x.at)));
      if (keep.length !== existing.length) await K.kvPipe(keep.length ? [["DEL", "res:" + uid], ["RPUSH", "res:" + uid, ...keep.map((x) => JSON.stringify(x))]] : [["DEL", "res:" + uid]]);
    }
    const incoming = [...(b.result && typeof b.result === "object" ? [b.result] : []), ...(Array.isArray(b.results) ? b.results.slice(0, 50) : [])].map(clean).filter((r) => r.total);
    if (incoming.length) {
      const existing = ((await K.kv("LRANGE", "res:" + uid, "0", "49")) || []).map((x) => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
      const seenAt = new Set(existing.map((x) => x.at));
      const merged = [...existing, ...incoming.filter((x) => !seenAt.has(x.at))].sort((x, y) => y.at - x.at).slice(0, 50);
      await K.kvPipe([["DEL", "res:" + uid], ["RPUSH", "res:" + uid, ...merged.map((x) => JSON.stringify(x))]]);
    }
    if (Array.isArray(b.seen) && b.seen.length) {
      const ids = b.seen.map(String).filter((x) => x.length < 40).slice(0, 500);
      if (ids.length) await K.kv("SADD", "seen:" + uid, ...ids);
    }
    if (b.cursors && typeof b.cursors === "object") {
      const flat = []; Object.entries(b.cursors).forEach(([k, v]) => { if (Number.isFinite(Number(v))) flat.push(String(k).slice(0, 60), String(Number(v))); });
      if (flat.length) await K.kv("HSET", "cur:" + uid, ...flat);
    }
    const q = req.query || {};
    // Yangi o'quvchiga bir martalik 3 kunlik bepul Premium
    const trialSet = await K.kv("SET", "trial:" + uid, String(Date.now()), "NX");
    if (trialSet === "OK") {
      const cur = await K.premiumUntil(uid);
      const tUntil = Date.now() + K.TRIAL_DAYS * 86400000;
      if (cur < tUntil) await K.kv("SET", "prem:" + uid, String(tUntil));
    }
    // Admin paneli uchun: foydalanuvchilar ro'yxati va oxirgi faollik
    await K.kvPipe([["ZADD", "users", "NX", String(Date.now()), String(uid)], ["ZADD", "lastseen", String(Date.now()), String(uid)]]);
    const [profile, until, usage] = await Promise.all([K.getJSON("prof:" + uid, null), K.premiumUntil(uid), K.usageToday(uid)]);
    let prof = profile;
    if (!prof || !prof.tgName) {
      const c = await T.tg("getChat", { chat_id: uid });
      if (c.ok) { prof = { ...(prof || {}), tgName: c.result.first_name || "", username: c.result.username || "" }; await K.setJSON("prof:" + uid, prof); }
    }
    const paid = await K.kv("GET", "paid:" + uid);
    const out = { id: uid, storage: true, profile: prof, premium: until > Date.now(), premiumUntil: until || null, trial: until > Date.now() && !paid, usage, plans };
    const adm = await T.adminId().catch(() => null);
    if (adm && Number(adm) === Number(uid)) out.isAdmin = true;
    if (q.results) out.results = ((await K.kv("LRANGE", "res:" + uid, "0", "49")) || []).map((x) => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
    if (q.seen) out.seen = (await K.kv("SMEMBERS", "seen:" + uid)) || [];
    if (q.cursors) { const h = (await K.kv("HGETALL", "cur:" + uid)) || []; const c = {}; for (let i = 0; i < h.length; i += 2) c[h[i]] = Number(h[i + 1]); out.cursors = c; }
    res.status(200).json(out);
  } catch (e) {
    res.status(200).json({ id: uid, storage: false, error: "storage_error", detail: String(e && e.message || e), plans });
  }
};
