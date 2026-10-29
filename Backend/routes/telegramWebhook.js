const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const User = require('../models/user');
const { sendTelegramMessage, escapeHtml } = require('../services/telegramService');

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

/**
 * Secret'larni uzunlik ma'lumotini oshkor qilmasdan solishtiradi.
 * timingSafeEqual uzunliklar teng bo'lishini talab qiladi, shuning uchun
 * avval uzunlikni tekshiramiz.
 */
function secretMatches(received) {
    if (typeof received !== 'string' || received.length !== WEBHOOK_SECRET.length) return false;
    return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(WEBHOOK_SECRET));
}

// Telegram foydalanuvchi botga /start bosganda yoki xabar yozganda shu yerga POST qiladi.
// 🔒 Bu route verifyToken bilan himoyalanmagan (Telegram serverlaridan keladi, foydalanuvchi
//    tokeni yo'q), shuning uchun setWebhook'da berilgan secret_token tekshiriladi.
//    Aks holda URL ni bilgan har kim fake "update" yuborib, botni ixtiyoriy
//    chat_id ga xabar yuborishga majburlashi mumkin edi.
router.post('/webhook', async (req, res) => {
    // Fail-closed: secret sozlanmagan bo'lsa webhook umuman qabul qilmaydi.
    if (!WEBHOOK_SECRET) {
        console.error(
            "❌ TELEGRAM_WEBHOOK_SECRET .env da topilmadi — webhook yopiq. " +
            "Env o'zgaruvchini qo'shib, scripts/setWebhook.js ni qayta ishga tushiring."
        );
        return res.sendStatus(403);
    }

    if (!secretMatches(req.get('X-Telegram-Bot-Api-Secret-Token'))) {
        console.warn("⚠️ Webhook: secret token mos kelmadi — so'rov rad etildi.");
        return res.sendStatus(403);
    }

    try {
        const update = req.body;
        const message = update?.message;

        if (message && message.text) {
            const chatId = message.chat.id;
            const text = String(message.text).trim();

            if (text.startsWith('/start')) {
                const parts = text.split(' ');
                const token = parts[1];

                if (!token) {
                    await sendTelegramMessage(
                        chatId,
                        "👋 Salom! Hisobingizni ulash uchun TradeJournal saytidagi \"Botga ulanish\" tugmasini bosing."
                    );
                    return res.sendStatus(200);
                }

                const user = await User.findOne({
                    telegramConnectToken: token,
                    telegramConnectTokenExpires: { $gt: new Date() },
                });

                if (!user) {
                    await sendTelegramMessage(
                        chatId,
                        "⚠️ Havola muddati tugagan yoki noto'g'ri. Saytga qaytib, \"Botga ulanish\" tugmasini qaytadan bosing."
                    );
                    return res.sendStatus(200);
                }

                user.telegramChatId = String(chatId);
                user.telegramConnectToken = null;
                user.telegramConnectTokenExpires = null;
                await user.save();

                await sendTelegramMessage(
                    chatId,
                    `✅ Muvaffaqiyatli ulandingiz${user.username ? ', <b>' + escapeHtml(user.username) + '</b>' : ''}!\n\nEndi bildirishnomalar, eslatmalar va kunlik hisobotlar shu yerga keladi.`
                );
            } else {
                await sendTelegramMessage(
                    chatId,
                    "Bu bot faqat TradeJournal'dan bildirishnoma yuborish uchun ishlatiladi. Barcha sozlamalarni saytdan boshqaring."
                );
            }
        }

        // Telegram har doim tezkor 200 javobini kutadi
        return res.sendStatus(200);
    } catch (err) {
        console.error('Telegram webhook xatoligi:', err);
        return res.sendStatus(200);
    }
});

module.exports = router;
