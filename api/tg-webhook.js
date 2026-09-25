// Telegram bot: /start bosilganda obunani tekshiradi va saytga shaxsiy kirish havolasini yuboradi.
const T = require("./_tg");

async function reply(chatId, userId, firstName) {
  const m = await T.memberStatus(userId);
  const channelUrl = "https://t.me/" + T.CHANNEL.replace(/^@/, "");
  if (m.ok && m.member) {
    await T.tg("sendMessage", {
      chat_id: chatId,
      text: "✅ " + (firstName ? firstName + ", " : "") + "obunangiz tasdiqlandi!\n\nQuyidagi tugma orqali SAT with Shirinabonu saytiga kiring. Kanalda qolsangiz, sayt siz uchun doim ochiq.",
      reply_markup: { inline_keyboard: [[{ text: "🚀 Saytga kirish", web_app: { url: T.SITE + "/" } }], [{ text: "🌐 Brauzerda ochish", url: T.SITE + "/?tg=" + T.signLink(userId) }]] },
    });
  } else {
    await T.tg("sendMessage", {
      chat_id: chatId,
      text: "Saytdan foydalanish uchun avval " + T.CHANNEL + " kanaliga obuna bo'ling, so'ng \"Obuna bo'ldim\" tugmasini bosing." + (m.ok ? "" : "\n\n(Tekshirishda xatolik: bot kanalda admin bo'lishi kerak.)"),
      reply_markup: { inline_keyboard: [[{ text: "📢 Kanalga obuna bo'lish", url: channelUrl }], [{ text: "✅ Obuna bo'ldim", callback_data: "check" }]] },
    });
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST" || req.headers["x-telegram-bot-api-secret-token"] !== T.webhookSecret()) { res.status(200).json({ ok: true }); return; }
  let u = req.body;
  if (typeof u === "string") { try { u = JSON.parse(u); } catch (e) { u = {}; } }
  try {
    if (u.message && u.message.chat && u.message.chat.type === "private" && u.message.from) {
      await reply(u.message.chat.id, u.message.from.id, u.message.from.first_name);
    } else if (u.callback_query && u.callback_query.from) {
      await T.tg("answerCallbackQuery", { callback_query_id: u.callback_query.id, text: "Tekshirilmoqda…" });
      await reply(u.callback_query.from.id, u.callback_query.from.id, u.callback_query.from.first_name);
    }
  } catch (e) {}
  res.status(200).json({ ok: true });
};
