// Reyting (leaderboard) yordamchilari: har bir ko'rsatkich uchun Redis sorted set.
const K = require("./_kv");

const DAY_TTL = 3 * 86400;
const BOARDS = {
  score: { key: () => "lb:score", max: true },
  xp: { key: () => "lb:xp", max: true },
  streak: { key: () => "lb:streak", max: false },
  today: { key: () => "lb:minday:" + K.today(), max: true, day: true },
  total: { key: () => "lb:mintotal", max: true },
  vocab: { key: () => "lb:vocab", max: true },
  vocabToday: { key: () => "lb:vocabday:" + K.today(), max: true, day: true },
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

// vals: { board: number } — "max" bo'lganlarida faqat oshgan qiymat yoziladi
async function update(uid, vals, name) {
  const id = String(uid);
  const names = Object.keys(vals).filter((b) => BOARDS[b] && Number.isFinite(Number(vals[b])));
  if (!names.length && !name) return;
  const cur = names.length ? await K.kvPipe(names.map((b) => ["ZSCORE", BOARDS[b].key(), id])) : [];
  const cmds = [];
  names.forEach((b, i) => {
    const v = Number(vals[b]); const old = cur[i] == null ? null : Number(cur[i]);
    if (v <= 0 && old == null) return;
    if (BOARDS[b].max && old != null && v <= old) return;
    if (!BOARDS[b].max && old === v) return;
    cmds.push(["ZADD", BOARDS[b].key(), String(v), id]);
    if (BOARDS[b].day) cmds.push(["EXPIRE", BOARDS[b].key(), String(DAY_TTL)]);
  });
  if (name) cmds.push(["HSET", "lbname", id, String(name).slice(0, 40)]);
  if (cmds.length) await K.kvPipe(cmds);
}

function fromPing(p) {
  const o = { streak: clamp(p.streak, 0, 3650), today: clamp(p.minutesToday, 0, 1440), total: clamp(p.totalMinutes, 0, 1e6) };
  if (p.xp != null) o.xp = clamp(p.xp, 0, 1e7);
  if (p.vocab != null) o.vocab = clamp(p.vocab, 0, 5000);
  if (p.vocabToday != null) o.vocabToday = clamp(p.vocabToday, 0, 2000);
  return o;
}

module.exports = { BOARDS, update, fromPing, clamp };
