const express = require('express');
const router = express.Router();

// ⚠️ Yo'llarni loyihangizdagi haqiqiy joylashuvga moslang
const User = require('../models/user');
const Trade = require('../models/trade');
const verifyToken = require('../middleware/authMiddleware');
const { sendTelegramMessage, generateConnectToken } = require('../services/telegramService');

// 🟢 Boshidagi "@" belgisini avtomatik olib tashlaydi — .env da "@Bot" yoki "Bot"
// qanday kiritilishidan qat'iy nazar, t.me havolasi har doim to'g'ri hosil bo'ladi.
const BOT_USERNAME = (process.env.TELEGRAM_BOT_USERNAME || 'TradingJournalV2Bot').replace(/^@/, '');

// 🔒 Shu fayldagi barcha route'lar login qilingan foydalanuvchini talab qiladi
router.use(verifyToken);

// 1. ULANISH UCHUN BIR MARTALIK TOKEN YARATISH
// Frontend: "Botga ulanish" bosilganda shu chaqiriladi
router.post('/connect-token', async (req, res) => {
    try {
        const token = generateConnectToken();
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 daqiqa amal qiladi

        await User.findByIdAndUpdate(req.userId, {
            telegramConnectToken: token,
            telegramConnectTokenExpires: expires,
        });

        return res.json({
            token,
            deepLink: `https://t.me/${BOT_USERNAME}?start=${token}`,
            botUsername: BOT_USERNAME,
        });
    } catch (err) {
        console.error('connect-token xatoligi:', err);
        return res.status(500).json({ message: 'Ulanish tokenini yaratishda xatolik' });
    }
});

// 2. ULANISH HOLATINI TEKSHIRISH (frontend har 3s da polling qiladi)
router.get('/status', async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('telegramChatId');
        return res.json({
            connected: !!user?.telegramChatId,
            botUsername: BOT_USERNAME,
        });
    } catch (err) {
        return res.status(500).json({ message: 'Holatni tekshirishda xatolik' });
    }
});

// 3. BOTNI UZISH
router.post('/disconnect', async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.userId, {
            telegramChatId: null,
            telegramConnectToken: null,
            telegramConnectTokenExpires: null,
        });
        return res.json({ message: "Telegram ulanishi uzildi" });
    } catch (err) {
        return res.status(500).json({ message: 'Uzishda xatolik' });
    }
});

// 4. TEST XABAR YUBORISH
router.post('/send-test', async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user || !user.telegramChatId) {
            return res.status(400).json({ message: 'Avval Telegram botiga ulaning' });
        }
        await sendTelegramMessage(
            user.telegramChatId,
            `✅ <b>Test xabar</b>\n\nTradeJournal boti muvaffaqiyatli ulandi${user.username ? ', ' + user.username : ''}! Bildirishnomalar shu chatga keladi.`
        );
        return res.json({ message: 'Test xabar yuborildi' });
    } catch (err) {
        console.error('send-test xatoligi:', err);
        return res.status(500).json({ message: 'Xabar yuborishda xatolik' });
    }
});

// 5. ESLATMALAR RO'YXATI
router.get('/reminders', async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('telegramReminders');
        return res.json(user?.telegramReminders || []);
    } catch (err) {
        return res.status(500).json({ message: "Eslatmalarni yuklashda xatolik" });
    }
});

// 6. ESLATMA QO'SHISH
router.post('/reminders', async (req, res) => {
    try {
        const { time, title, freq } = req.body;
        if (!time || !title) {
            return res.status(400).json({ message: "Vaqt va eslatma nomini kiriting" });
        }

        const user = await User.findById(req.userId);
        user.telegramReminders.push({ time, title, freq: freq || 'Har kuni', active: true });
        await user.save();

        return res.status(201).json(user.telegramReminders[user.telegramReminders.length - 1]);
    } catch (err) {
        console.error('reminder POST xatoligi:', err);
        return res.status(500).json({ message: "Eslatma qo'shishda xatolik" });
    }
});

// 7. ESLATMANI YANGILASH (masalan yoqish/o'chirish toggle)
router.put('/reminders/:id', async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const reminder = user.telegramReminders.id(req.params.id);
        if (!reminder) return res.status(404).json({ message: 'Eslatma topilmadi' });

        const { time, title, freq, active } = req.body;
        if (time !== undefined) reminder.time = time;
        if (title !== undefined) reminder.title = title;
        if (freq !== undefined) reminder.freq = freq;
        if (active !== undefined) reminder.active = active;

        await user.save();
        return res.json(reminder);
    } catch (err) {
        return res.status(500).json({ message: 'Eslatmani yangilashda xatolik' });
    }
});

// 8. ESLATMANI O'CHIRISH
router.delete('/reminders/:id', async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const reminder = user.telegramReminders.id(req.params.id);
        if (reminder) reminder.deleteOne();
        await user.save();
        return res.json({ message: "Eslatma o'chirildi" });
    } catch (err) {
        return res.status(500).json({ message: "O'chirishda xatolik" });
    }
});

// 9. BILDIRISHNOMA / HISOBOT SOZLAMALARINI SAQLASH
router.put('/report-settings', async (req, res) => {
    try {
        const allowedKeys = [
            'notifTradeSaved', 'notifRiskAlert', 'notifDailyReport',
            'notifGoalProgress', 'notifWeeklyReport', 'notifSessionReminder',
            'reportAutoSend', 'reportTime', 'reportIncludes',
        ];
        const update = {};
        for (const key of allowedKeys) {
            if (req.body[key] !== undefined) update[`telegramSettings.${key}`] = req.body[key];
        }

        const user = await User.findByIdAndUpdate(req.userId, { $set: update }, { new: true });
        return res.json(user.telegramSettings);
    } catch (err) {
        console.error('report-settings xatoligi:', err);
        return res.status(500).json({ message: 'Sozlamalarni saqlashda xatolik' });
    }
});

// 10. SAHIFA YUKLANGANDA — joriy holat + sozlamalar + eslatmalarni bir yo'la olish
router.get('/settings', async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('telegramSettings telegramReminders telegramChatId');
        return res.json({
            connected: !!user.telegramChatId,
            settings: user.telegramSettings,
            reminders: user.telegramReminders,
        });
    } catch (err) {
        return res.status(500).json({ message: 'Sozlamalarni yuklashda xatolik' });
    }
});

module.exports = router;