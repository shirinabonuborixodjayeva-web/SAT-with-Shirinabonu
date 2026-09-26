// Umumiy o'sib boruvchi savollar banki (R&W). Foydalanuvchi o'z "kursori"dan boshlab yangi savollarni oladi,
// bank tugasa AI yangi savollar yaratib bankka qo'shadi — shu sababli savollar takrorlanmaydi.
const T = require("./_tg");
const K = require("./_kv");

const SKILLS = {
  "Words in Context": "Blank in a 40-90 word academic passage; prompt 'Which choice completes the text with the most logical and precise word or phrase?'; 4 single-word choices of the same part of speech.",
  "Text Structure and Purpose": "60-130 word passage; prompt asks for the main purpose or overall structure; choices start with 'To ...' or describe structure.",
  "Cross-Text Connections": "Passage has 'Text 1\\n...\\n\\nText 2\\n...' (each 40-70 words); prompt asks how the author of Text 2 would respond to Text 1.",
  "Central Ideas and Details": "60-130 word passage; prompt 'Which choice best states the main idea of the text?' or a detail question.",
  "Command of Evidence (Textual)": "60-110 word passage presenting a hypothesis; prompt 'Which finding, if true, would most directly support the hypothesis?'.",
  "Command of Evidence (Quantitative)": "Passage includes a small plain-text data table (use \\n line breaks) and a claim; prompt 'Which choice most effectively uses data from the table to complete the text?'. Verify numbers.",
  "Inferences": "70-130 word passage ending with an incomplete sentence and ______ ; prompt 'Which choice most logically completes the text?'.",
  "Boundaries": "30-80 word passage with one ______ ; prompt 'Which choice completes the text so that it conforms to the conventions of Standard English?'; 4 choices are the same words with different punctuation.",
  "Form, Structure, and Sense": "30-80 word passage with one ______ ; same Standard English prompt; tests subject-verb agreement, pronouns, verb tense/form, possessives, modifiers.",
  "Transitions": "40-90 word passage with ______ at the start of a sentence; prompt 'Which choice completes the text with the most logical transition?'; choices like 'However,' 'Therefore,' (never two synonyms).",
  "Rhetorical Synthesis": "Passage 'While researching a topic, a student has taken the following notes:\\n\\n  • ...' with 4-5 notes; prompt 'The student wants to ... Which choice most effectively uses relevant information from the notes to accomplish this goal?'.",
};

function body(req) { let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } } return b || {}; }

function valid(q) {
  return q && typeof q.passage === "string" && q.passage.length > 20 && typeof q.prompt === "string" && Array.isArray(q.choices) &&
    q.choices.length === 4 && q.choices.every((c) => typeof c === "string" && c.trim()) && new Set(q.choices).size === 4 &&
    Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4;
}

async function llm(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + (process.env.GEMINI_MODEL || "gemini-flash-latest") + ":generateContent", {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9, responseMimeType: "application/json" } }),
    });
    const d = await r.json().catch(() => ({}));
    return (((d.candidates || [])[0] || {}).content || {}).parts?.map((p) => p.text || "").join("") || "";
  }
  const r = await fetch("https://text.pollinations.ai/openai", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.AI_MODEL || "openai", messages: [{ role: "system", content: "You write accurate Digital SAT questions and output only JSON." }, { role: "user", content: prompt }], response_format: { type: "json_object" }, seed: Math.floor(Math.random() * 1e9) }),
  });
  const d = await r.json().catch(() => ({}));
  return (((d.choices || [])[0] || {}).message || {}).content || "";
}

async function generate(skill, n) {
  const topics = ["astronomy", "marine biology", "ancient history", "economics", "linguistics", "architecture", "psychology", "botany", "music history", "urban planning", "geology", "Central Asian history", "medicine", "literature", "chemistry", "anthropology", "climate science", "art history", "robotics", "sociology"];
  const pick = Array.from({ length: n }, () => topics[Math.floor(Math.random() * topics.length)]).join(", ");
  const prompt = "Write " + n + " ORIGINAL Digital SAT Reading and Writing questions for the skill \"" + skill + "\". Format: " + SKILLS[skill] +
    " Topics (one per question): " + pick + ". Exactly one choice must be clearly correct; distractors plausible. Vary which index is correct. " +
    "Return JSON: {\"questions\":[{\"passage\":\"...\",\"prompt\":\"...\",\"choices\":[\"...\",\"...\",\"...\",\"...\"],\"answer\":0,\"expl\":\"1-2 sentence explanation in Uzbek (Latin script)\",\"difficulty\":\"Easy|Medium|Hard\"}]}";
  const text = await llm(prompt);
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (e) { const m = String(text).match(/\{[\s\S]*\}/); if (m) { try { parsed = JSON.parse(m[0]); } catch (e2) {} } }
  const arr = Array.isArray(parsed) ? parsed : (parsed && parsed.questions) || [];
  return arr.filter(valid).map((q) => ({ passage: q.passage, prompt: q.prompt, choices: q.choices, answer: q.answer, expl: String(q.expl || ""), difficulty: q.difficulty || "Medium", ai: 1 }));
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  if (T.token() && !T.sessionUser(req)) { res.status(401).json({ error: "no_session" }); return; }
  const b = body(req);
  const skill = String(b.skill || "");
  if (!SKILLS[skill]) { res.status(400).json({ error: "bad_skill" }); return; }
  const n = Math.min(8, Math.max(1, Number(b.n) || 4));
  const from = Math.max(0, Number(b.from) || 0);
  try {
    if (!K.kvOn()) { const qs = await generate(skill, n); res.status(200).json({ questions: qs, next: null, shared: false }); return; }
    const key = "qb:" + skill;
    let len = Number(await K.kv("LLEN", key)) || 0;
    if (len < from + n) {
      const fresh = await generate(skill, Math.min(8, from + n - len + 2));
      if (fresh.length) { await K.kv("RPUSH", key, ...fresh.map((q) => JSON.stringify(q))); len += fresh.length; }
    }
    const raw = (await K.kv("LRANGE", key, from, from + n - 1)) || [];
    const qs = raw.map((s) => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
    res.status(200).json({ questions: qs, next: from + qs.length, total: len, shared: true });
  } catch (e) {
    res.status(502).json({ error: "generate_failed", detail: String(e && e.message || e) });
  }
};
