const express = require('express');
const router = express.Router();

// ⚠️ Yo'lni loyihangizdagi haqiqiy joylashuvga moslang
const User = require('../models/User');
const { sendTelegramMessage } = require('../services/telegramService');

// Telegram foydalanuvchi botga /start bosganda yoki xabar yozganda shu yerga POST qiladi.
// ❗ Bu route verifyToken bilan himoyalanmagan — Telegram serverlaridan keladi, foydalanuvchi tokeni yo'q.
router.post('/webhook', async (req, res) => {
    try {
        const update = req.body;
        const message = update.message;

        if (message && message.text) {
            const chatId = message.chat.id;
            const text = message.text.trim();

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
                    `✅ Muvaffaqiyatli ulandingiz${user.username ? ', <b>' + user.username + '</b>' : ''}!\n\nEndi bildirishnomalar, eslatmalar va kunlik hisobotlar shu yerga keladi.`
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