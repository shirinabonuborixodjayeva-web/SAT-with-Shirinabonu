// Vercel serverless funksiyasi: AI repetitor uchun Google Gemini'ga so'rov yuboradi.
// Kalit brauzerga chiqmaydi — u Vercel'dagi GEMINI_API_KEY muhit o'zgaruvchisida saqlanadi.
const SYSTEM =
  "You are a friendly, concise SAT tutor for Uzbek students on the site 'SAT with Shirinabonu'. " +
  "Answer in the language the student uses (Uzbek or English). Keep answers under 150 words unless the student asks for full working or a quiz. " +
  "Explain step by step for math. If asked to quiz the student, write 3 short multiple-choice Digital SAT-style questions (A–D) on the topic, " +
  "and give the answers with one-line explanations only after the student replies. Stay on SAT, English, and math topics. " +
  "Write in plain text only: no Markdown symbols such as ** or #, and no LaTeX; write math simply, like 2x + 3 = 11 or x^2. " +
  "Double-check every answer choice and calculation before replying so each quiz question has exactly one correct option.";

const T = require("./_tg");
const K = require("./_kv");
const MODELS = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"].filter(Boolean);

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  const key = process.env.GEMINI_API_KEY;
  // Kalit bo'lmasa: bepul, kalitsiz Pollinations AI xizmati ishlatiladi

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const msgs = Array.isArray(body && body.messages) ? body.messages : [];
  const contents = msgs
    .filter((m) => m && typeof m.text === "string" && m.text.trim())
    .slice(-12)
    .map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text.slice(0, 4000) }] }));
  while (contents.length && contents[0].role !== "user") contents.shift();
  if (!contents.length || contents[contents.length - 1].role !== "user") { res.status(400).json({ error: "bad_request" }); return; }

  // Bepul tarifda kunlik AI limiti (Premium — cheksiz)
  if (K.kvOn() && T.token()) {
    const uid = T.sessionUser(req);
    if (!uid) { res.status(401).json({ error: "no_session" }); return; }
    try { const u = await K.consume(uid, "ai"); if (!u.ok) { res.status(402).json({ error: "limit", used: u.used, limit: u.limit }); return; } } catch (e) {}
  }

  if (!key) {
    try {
      const r = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.AI_MODEL || "openai",
          messages: [{ role: "system", content: SYSTEM }, ...contents.map((c) => ({ role: c.role === "user" ? "user" : "assistant", content: c.parts[0].text }))],
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 429) { res.status(429).json({ error: "rate_limited" }); return; }
      const text = (((data.choices || [])[0] || {}).message || {}).content;
      if (r.ok && text) { res.status(200).json({ text: String(text).trim(), model: "free" }); return; }
      res.status(502).json({ error: "upstream_failed", detail: "http_" + r.status });
    } catch (e) { res.status(502).json({ error: "upstream_failed", detail: String(e && e.message || e) }); }
    return;
  }

  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents,
    generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
  };

  let lastErr = "unknown";
  for (const model of MODELS) {
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 404) { lastErr = "model_not_found:" + model; continue; }
      if (r.status === 429) { res.status(429).json({ error: "rate_limited" }); return; }
      if (!r.ok) { lastErr = (data.error && data.error.message) || "http_" + r.status; continue; }
      const text = (((data.candidates || [])[0] || {}).content || {}).parts?.map((p) => p.text || "").join("").trim();
      if (text) { res.status(200).json({ text, model }); return; }
      lastErr = "empty_response";
    } catch (e) { lastErr = String(e && e.message || e); }
  }
  res.status(502).json({ error: "upstream_failed", detail: lastErr });
};
