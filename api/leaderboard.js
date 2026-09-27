// Reyting: SAT ball rekordi, XP, streak, bugungi/umumiy o'qish vaqti, lug'at.
const T = require("./_tg");
const K = require("./_kv");
const L = require("./_lb");

function body(req) { let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } } return b || {}; }
const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };
const TOP = 50;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const uid = T.sessionUser(req);
  if (!uid) { res.status(401).json({ error: "no_session" }); return; }
  if (!K.kvOn()) { res.status(200).json({ storage: false, boards: {} }); return; }
  const id = String(uid);
  try {
    if (req.method === "POST") {
      const b = body(req);
      if (b.score && typeof b.score === "object") {
        const total = Number(b.score.total), rw = Number(b.score.rw), math = Number(b.score.math);
        const ok = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi && v % 10 === 0;
        if (ok(total, 400, 1600) && ok(rw, 200, 800) && ok(math, 200, 800) && rw + math === total) {
          const old = Number(await K.kv("ZSCORE", "lb:score", id)) || 0;
          const meta = parse(await K.kv("HGET", "lbmeta", id)) || {};
          if (total > old) { meta.rw = rw; meta.math = math; meta.at = Date.now(); }
          meta.tests = Math.max(meta.tests || 0, L.clamp(b.score.tests, 0, 10000));
          await K.kv("HSET", "lbmeta", id, JSON.stringify(meta));
          await L.update(id, { score: total }, b.name);
        }
      }
      if (typeof b.hidden === "boolean") { if (b.hidden) await K.kv("HSET", "lbhide", id, "1"); else await K.kv("HDEL", "lbhide", id); }
      if (b.stats && typeof b.stats === "object") await L.update(id, L.fromPing(b.stats), b.name);
    }
    const names = Object.keys(L.BOARDS);
    const cmds = [];
    names.forEach((n) => { const k = L.BOARDS[n].key(); cmds.push(["ZREVRANGE", k, "0", String(TOP - 1), "WITHSCORES"], ["ZREVRANK", k, id], ["ZSCORE", k, id], ["ZCARD", k]); });
    const r = await K.kvPipe(cmds);
    const ids = new Set([id]);
    const raw = {};
    names.forEach((n, i) => {
      const arr = r[i * 4] || []; const list = [];
      for (let j = 0; j < arr.length; j += 2) { list.push([String(arr[j]), Number(arr[j + 1])]); ids.add(String(arr[j])); }
      raw[n] = { list, rank: r[i * 4 + 1] == null ? null : Number(r[i * 4 + 1]) + 1, value: r[i * 4 + 2] == null ? null : Number(r[i * 4 + 2]), count: Number(r[i * 4 + 3]) || 0 };
    });
    const idl = [...ids];
    const [nm, mt, hd, ro] = await K.kvPipe([["HMGET", "lbname", ...idl], ["HMGET", "lbmeta", ...idl], ["HMGET", "lbhide", ...idl], ["HMGET", "roster", ...idl]]);
    const info = {};
    idl.forEach((x, i) => {
      const hidden = !!(hd && hd[i]); const ros = parse(ro && ro[i]) || {};
      const nmv = (nm && nm[i]) || ros.name || "O'quvchi";
      info[x] = { name: hidden && x !== id ? "Yashirin o'quvchi" : nmv, meta: parse(mt && mt[i]) || {}, hidden };
    });
    const boards = {};
    names.forEach((n) => {
      boards[n] = { rank: raw[n].rank, value: raw[n].value, count: raw[n].count, list: raw[n].list.map(([x, v]) => ({ me: x === id, name: info[x].name, value: v, tests: info[x].meta.tests || 0, rw: info[x].meta.rw, math: info[x].meta.math })) };
    });
    res.status(200).json({ storage: true, boards, hidden: info[id].hidden });
  } catch (e) {
    res.status(200).json({ storage: false, error: String(e && e.message || e), boards: {} });
  }
};
