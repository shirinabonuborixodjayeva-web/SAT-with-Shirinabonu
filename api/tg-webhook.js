// Telegram bot: obunani tekshiradi, saytga kirish tugmasini beradi va Premium to'lovlarini qabul qiladi.
const T = require("./_tg");
const K = require("./_kv");

const fmtDate = (ms) => { const d = new Date(ms + 5 * 3600 * 1000); return d.toISOString().slice(0, 10).split("-").reverse().join("."); };
const som = (n) => n.toLocaleString("ru-RU").replace(/[,\u00a0\u202f]/g, " ");
const PLANS = { 1: { days: K.PREMIUM_DAYS, price: K.PRICE_UZS, name: "1 oy" }, 3: { days: 90, price: K.PRICE3_UZS, name: "3 oy" } };
const send = (chat_id, text, extra) => T.tg("sendMessage", { chat_id, text, ...(extra || {}) });

async function replyStart(chatId, userId, firstName) {
  const m = await T.memberStatus(userId);
  const channelUrl = "https://t.me/" + T.CHANNEL.replace(/^@/, "");
  if (m.ok && m.member) {
    await send(chatId, "✅ " + (firstName ? firstName + ", " : "") + "obunangiz tasdiqlandi!\n\nQuyidagi tugma orqali SAT with Shirinabonu saytiga kiring. Kanalda qolsangiz, sayt siz uchun doim ochiq.", {
      reply_markup: { inline_keyboard: [
        [{ text: "🚀 Saytga kirish", web_app: { url: T.SITE + "/" } }],
        [{ text: "🌐 Brauzerda ochish", url: T.SITE + "/?tg=" + T.signLink(userId) }],
        [{ text: "💎 Premium olish", callback_data: "prem" }],
      ] },
    });
  } else {
    await send(chatId, "Saytdan foydalanish uchun avval " + T.CHANNEL + " kanaliga obuna bo'ling, so'ng \"Obuna bo'ldim\" tugmasini bosing." + (m.ok ? "" : "\n\n(Tekshirishda xatolik: bot kanalda admin bo'lishi kerak.)"), {
      reply_markup: { inline_keyboard: [[{ text: "📢 Kanalga obuna bo'lish", url: channelUrl }], [{ text: "✅ Obuna bo'ldim", callback_data: "check" }]] },
    });
  }
}

async function replyPremium(chatId, userId) {
  if (!K.kvOn()) { await send(chatId, "💎 Premium to'lov tizimi tez orada ishga tushadi. Hozircha saytdan bepul foydalaning!"); return; }
  const until = await K.premiumUntil(userId);
  const paid = await K.kv("GET", "paid:" + userId);
  const active = until > Date.now() ? "\n\nHozirgi Premium" + (paid ? "" : " (bepul sinov)") + ": " + fmtDate(until) + " gacha. Yangi to'lov muddatni uzaytiradi." : "";
  await send(chatId,
    "💎 SAT with Shirinabonu — Premium\n\n" +
    "Premium'da: 200 ta mock test va to'liq tahlil, savollar banki, drill, lug'at mashqi va AI repetitor — cheklovsiz.\n\n" +
    "Tarifni tanlang:\n• 1 oy — " + som(K.PRICE_UZS) + " so'm\n• 3 oy — " + som(K.PRICE3_UZS) + " so'm (oyiga ~40 ming, 19% arzon)" + active,
    { reply_markup: { inline_keyboard: [[{ text: "1 oy — " + som(K.PRICE_UZS) + " so'm", callback_data: "plan:1" }], [{ text: "3 oy — " + som(K.PRICE3_UZS) + " so'm 🔥", callback_data: "plan:3" }]] } });
}

async function replyPlan(chatId, userId, planId) {
  const plan = PLANS[planId]; if (!plan) return;
  const card = await K.kv("GET", "cfg:card");
  if (!card) { await send(chatId, "To'lov ma'lumotlari hali kiritilmagan. Iltimos, birozdan keyin qayta urinib ko'ring."); return; }
  await K.kv("SET", "await:" + userId, String(planId), "EX", 60 * 60 * 72);
  await send(chatId,
    "💎 Premium — " + plan.name + " (" + som(plan.price) + " so'm)\n\n" +
    "1) Quyidagi kartaga " + som(plan.price) + " so'm o'tkazing:\n" + card + "\n\n" +
    "2) To'lov chekini (skrinshot) shu chatga rasm qilib yuboring.\n3) Admin tekshirib tasdiqlagach, Premium avtomatik yoqiladi va sizga xabar keladi.");
}

async function handleReceipt(msg) {
  const uid = msg.from.id;
  const admin = await T.adminId();
  if (!admin) { await send(msg.chat.id, "Hozir chekni qabul qilib bo'lmadi. Birozdan keyin qayta yuboring."); return; }
  const until = await K.premiumUntil(uid);
  const planId = Number(await K.kv("GET", "await:" + uid)) || 1;
  const who = (msg.from.first_name || "") + (msg.from.last_name ? " " + msg.from.last_name : "") + (msg.from.username ? " (@" + msg.from.username + ")" : "") + "\nID: " + uid;
  await T.tg("copyMessage", {
    chat_id: admin, from_chat_id: msg.chat.id, message_id: msg.message_id,
    caption: "💳 Yangi to'lov cheki\n" + who + "\nTanlagan tarifi: " + PLANS[planId].name + " — " + som(PLANS[planId].price) + " so'm\nPremium: " + (until > Date.now() ? fmtDate(until) + " gacha" : "yo'q") + (msg.caption ? "\nIzoh: " + msg.caption.slice(0, 300) : ""),
    reply_markup: { inline_keyboard: [[{ text: "✅ 1 oy", callback_data: "pa:" + uid + ":1" }, { text: "✅ 3 oy", callback_data: "pa:" + uid + ":3" }], [{ text: "❌ Rad etish", callback_data: "pr:" + uid }]] },
  });
  await K.kv("DEL", "await:" + uid);
  await send(msg.chat.id, "✅ Chekingiz qabul qilindi! Admin tekshirgach, Premium yoqiladi va sizga shu yerda xabar keladi.");
}

async function grant(uid, days) {
  const cur = await K.premiumUntil(uid);
  const until = Math.max(cur, Date.now()) + days * 24 * 3600 * 1000;
  await K.kv("SET", "prem:" + uid, String(until));
  await K.kv("SET", "paid:" + uid, "1");
  await K.kv("LPUSH", "paylog", JSON.stringify({ uid, days, at: Date.now() }));
  return until;
}
// Taklif qilgan do'stga bonus (bir marta)
async function rewardReferrer(uid) {
  const ref = Number(await K.kv("GET", "refby:" + uid));
  if (!ref) return;
  const first = await K.kv("SET", "refpaid:" + uid, "1", "NX");
  if (first !== "OK") return;
  const until = await grant(ref, K.REF_BONUS_DAYS);
  await send(ref, "🎁 Siz taklif qilgan do'stingiz Premium oldi! Sizga " + K.REF_BONUS_DAYS + " kun Premium sovg'a qilindi — " + fmtDate(until) + " gacha.", { reply_markup: { inline_keyboard: [[{ text: "🚀 Saytga kirish", web_app: { url: T.SITE + "/" } }]] } });
}

async function adminCommand(msg, text) {
  const [cmd, ...rest] = text.trim().split(/\s+/);
  const arg = rest.join(" ");
  if (cmd === "/karta") {
    if (!arg) { const c = await K.kv("GET", "cfg:card"); await send(msg.chat.id, "Hozirgi to'lov ma'lumoti:\n" + (c || "(kiritilmagan)") + "\n\nO'zgartirish: /karta 8600 1234 5678 9012 Ism Familiya"); return true; }
    await K.kv("SET", "cfg:card", arg.slice(0, 200));
    await send(msg.chat.id, "✅ To'lov ma'lumoti saqlandi:\n" + arg.slice(0, 200)); return true;
  }
  if (cmd === "/premium_ber") {
    const [id, d] = rest; const days = Number(d) || K.PREMIUM_DAYS;
    if (!Number(id)) { await send(msg.chat.id, "Foydalanish: /premium_ber <ID> [kun]"); return true; }
    const until = await grant(Number(id), days);
    await send(msg.chat.id, "✅ " + id + " uchun Premium " + fmtDate(until) + " gacha yoqildi.");
    await send(Number(id), "🎉 Sizga Premium " + fmtDate(until) + " gacha yoqildi!", { reply_markup: { inline_keyboard: [[{ text: "🚀 Saytga kirish", web_app: { url: T.SITE + "/" } }]] } });
    return true;
  }
  if (cmd === "/premium_ol") {
    const id = Number(rest[0]); if (!id) { await send(msg.chat.id, "Foydalanish: /premium_ol <ID>"); return true; }
    await K.kv("DEL", "prem:" + id); await send(msg.chat.id, "Premium o'chirildi: " + id); return true;
  }
  if (cmd === "/admin") {
    await send(msg.chat.id, "Admin buyruqlari:\n/karta <karta raqami va ism> — to'lov kartasini o'rnatish\n/karta — hozirgi kartani ko'rish\n/premium_ber <ID> [kun] — qo'lda Premium berish\n/premium_ol <ID> — Premium'ni o'chirish\n\nTo'lov cheklari shu chatga keladi: ✅ yoki ❌ tugmasini bosing.");
    return true;
  }
  return false;
}

async function onCallback(cq) {
  const data = cq.data || ""; const uid = cq.from.id;
  if (data === "check") { await T.tg("answerCallbackQuery", { callback_query_id: cq.id, text: "Tekshirilmoqda…" }); await replyStart(uid, uid, cq.from.first_name); return; }
  if (data === "prem") { await T.tg("answerCallbackQuery", { callback_query_id: cq.id }); await replyPremium(uid, uid); return; }
  const pl = data.match(/^plan:(1|3)$/);
  if (pl) { await T.tg("answerCallbackQuery", { callback_query_id: cq.id }); await replyPlan(uid, uid, Number(pl[1])); return; }
  const m = data.match(/^(pa|pr):(\d+)(?::(1|3))?$/);
  if (m) {
    const admin = await T.adminId();
    if (uid !== admin) { await T.tg("answerCallbackQuery", { callback_query_id: cq.id, text: "Faqat admin uchun" }); return; }
    const target = Number(m[2]);
    const note = cq.message && (cq.message.caption || cq.message.text || "");
    if (m[1] === "pa") {
      const until = await grant(target, PLANS[Number(m[3]) || 1].days);
      try { await rewardReferrer(target); } catch (e) {}
      await send(target, "🎉 To'lovingiz tasdiqlandi! Premium " + fmtDate(until) + " gacha faol.\n\nEndi barcha imkoniyatlar cheklovsiz.", { reply_markup: { inline_keyboard: [[{ text: "🚀 Saytga kirish", web_app: { url: T.SITE + "/" } }]] } });
      await T.tg("editMessageCaption", { chat_id: cq.message.chat.id, message_id: cq.message.message_id, caption: note + "\n\n✅ TASDIQLANDI — " + fmtDate(until) + " gacha" });
      await T.tg("answerCallbackQuery", { callback_query_id: cq.id, text: "Premium yoqildi" });
    } else {
      await send(target, "❌ To'lovingiz tasdiqlanmadi. Chekni tekshirib, qayta yuboring yoki kanal orqali admin bilan bog'laning.");
      await T.tg("editMessageCaption", { chat_id: cq.message.chat.id, message_id: cq.message.message_id, caption: note + "\n\n❌ RAD ETILDI" });
      await T.tg("answerCallbackQuery", { callback_query_id: cq.id, text: "Rad etildi" });
    }
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST" || req.headers["x-telegram-bot-api-secret-token"] !== T.webhookSecret()) { res.status(200).json({ ok: true }); return; }
  let u = req.body;
  if (typeof u === "string") { try { u = JSON.parse(u); } catch (e) { u = {}; } }
  try {
    const msg = u.message;
    if (msg && msg.chat && msg.chat.type === "private" && msg.from) {
      const text = msg.text || "";
      const isAdmin = K.kvOn() && text.startsWith("/") && msg.from.id === (await T.adminId());
      if (isAdmin && (await adminCommand(msg, text))) { /* done */ }
      else if (/^\/start\s+premium/.test(text) || text === "/premium") await replyPremium(msg.chat.id, msg.from.id);
      else if (/^\/start\s+ref_\d+/.test(text)) {
        const ref = Number(text.match(/ref_(\d+)/)[1]);
        if (K.kvOn() && ref && ref !== msg.from.id && !(await K.kv("EXISTS", "trial:" + msg.from.id))) await K.kv("SET", "refby:" + msg.from.id, String(ref), "NX");
        await replyStart(msg.chat.id, msg.from.id, msg.from.first_name);
      }
      else if ((msg.photo || msg.document) && K.kvOn()) await handleReceipt(msg);
      else await replyStart(msg.chat.id, msg.from.id, msg.from.first_name);
    } else if (u.callback_query && u.callback_query.from) {
      await onCallback(u.callback_query);
    }
  } catch (e) {}
  res.status(200).json({ ok: true });
};
