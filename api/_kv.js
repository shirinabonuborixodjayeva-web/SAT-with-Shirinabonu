// Ma'lumotlar bazasi: Upstash Redis (Vercel Storage → Upstash). Sozlanmagan bo'lsa kvOn() = false.
const URL_ = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
const kvOn = () => !!(URL_() && TOKEN());

async function kv(...cmd) {
  const r = await fetch(URL_(), { method: "POST", headers: { Authorization: "Bearer " + TOKEN(), "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const d = await r.json().catch(() => ({}));
  if (d.error) throw new Error(d.error);
  return d.result;
}
async function kvPipe(cmds) {
  const r = await fetch(URL_().replace(/\/$/, "") + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + TOKEN(), "Content-Type": "application/json" }, body: JSON.stringify(cmds) });
  const d = await r.json().catch(() => []);
  return Array.isArray(d) ? d.map((x) => x && x.result) : [];
}
async function getJSON(key, fallback) { try { const v = await kv("GET", key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
async function setJSON(key, value) { return kv("SET", key, JSON.stringify(value)); }

// Tarif va limitlar
const PRICE_UZS = 49000;
const PREMIUM_DAYS = 30;
const FREE_MOCKS = 5;
const FREE_DAILY = { bank: 30, drill: 3, ai: 10, vocab: 40 };
const today = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10); // Toshkent vaqti

async function premiumUntil(uid) { try { return Number(await kv("GET", "prem:" + uid)) || 0; } catch (e) { return 0; } }
async function usageToday(uid) {
  const kinds = Object.keys(FREE_DAILY);
  const vals = await kvPipe(kinds.map((k) => ["GET", "use:" + uid + ":" + today() + ":" + k]));
  const out = {}; kinds.forEach((k, i) => { out[k] = Number(vals[i]) || 0; });
  return out;
}
async function consume(uid, kind, amount) {
  const limit = FREE_DAILY[kind];
  if (limit == null) return { ok: true };
  const until = await premiumUntil(uid);
  if (until > Date.now()) return { ok: true, premium: true };
  const key = "use:" + uid + ":" + today() + ":" + kind;
  const used = Number(await kv("GET", key)) || 0;
  const n = Math.max(1, Number(amount) || 1);
  if (used + n > limit) return { ok: false, used, limit };
  const nv = await kv("INCRBY", key, n);
  await kv("EXPIRE", key, 60 * 60 * 48);
  return { ok: true, used: nv, limit };
}

module.exports = { kv, kvPipe, kvOn, getJSON, setJSON, PRICE_UZS, PREMIUM_DAYS, FREE_MOCKS, FREE_DAILY, today, premiumUntil, usageToday, consume };
