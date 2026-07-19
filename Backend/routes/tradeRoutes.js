const express = require('express');
const router = express.Router();
const Trade = require('../models/trade'); // ⚠️ Model yo'li to'g'riligini tekshiring
const User = require('../models/user');
const verifyToken = require('../middleware/authMiddleware');
const { sendTelegramMessage } = require('../services/telegramService');

// 🔒 Shu fayldagi BARCHA route'lar endi token talab qiladi.
// verifyToken req.userId ni to'ldiradi — pastdagi har bir so'rov shu ID orqali filtrlanadi.
router.use(verifyToken);

// 1. FAQAT O'Z SAVDOLARINI OLISH (GET /api/trades)
router.get('/', async (req, res) => {
    try {
        const trades = await Trade.find({ userId: req.userId }).sort({ createdAt: -1 });
        return res.json(trades);
    } catch (err) {
        return res.status(500).json({ message: "Ma'lumotlarni yuklashda server xatoligi!" });
    }
});

// 2. SAVDO QO'SHISH (POST /api/trades)
router.post('/', async (req, res) => {
    try {
        const { date, time, pair, strategy, trend, type, pnl, rr, psychology_before, notes, session } = req.body;

        const newTrade = new Trade({
            userId: req.userId,
            date,
            time,
            pair,
            strategy,
            trend,
            type,
            pnl: parseFloat(pnl) || 0,
            rr: parseFloat(rr) || 0,
            psychology_before,
            notes,
            session
        });

        const saved = await newTrade.save();

        // 🟢 TELEGRAM BILDIRISHNOMASI — foydalanuvchi ulangan va yoqilgan bo'lsa yuboriladi.
        // Asosiy javobni sekinlashtirmasligi uchun kutilmaydi (fire-and-forget).
        notifyTradeSaved(req.userId, saved).catch(err =>
            console.error("Telegram bildirishnomasini yuborishda xatolik:", err)
        );

        return res.status(201).json(saved);
    } catch (err) {
        console.error("POST xatoligi:", err);
        return res.status(500).json({ message: "Savdoni saqlashda server xatoligi!" });
    }
});

/** Yangi savdo saqlanganda Telegramga qisqa bildirishnoma yuboradi */
async function notifyTradeSaved(userId, trade) {
    const user = await User.findById(userId).select('telegramChatId telegramSettings');
    if (!user?.telegramChatId) return;
    if (user.telegramSettings?.notifTradeSaved === false) return;

    const pnl = parseFloat(trade.pnl) || 0;
    const isWin = pnl >= 0;
    const text =
        `${isWin ? '✅' : '🔴'} <b>Yangi savdo saqlandi</b>\n\n` +
        `Pair: <b>${trade.pair}</b>\n` +
        `Yo'nalish: ${trade.trend}\n` +
        `P&L: <b>${isWin ? '+' : ''}$${pnl.toFixed(2)}</b>`;

    await sendTelegramMessage(user.telegramChatId, text);
}

// 3. SAVDONI TAHRIRLASH (PUT /api/trades/:id) — faqat egasi tahrirlay oladi
router.put('/:id', async (req, res) => {
    try {
        const { date, time, pair, strategy, trend, pnl, rr, psychology_before, notes, session } = req.body;
        let trade = await Trade.findById(req.params.id);

        if (!trade) return res.status(404).json({ message: "Savdo topilmadi" });

        // 🔒 Egalikni tekshirish — boshqa foydalanuvchi trade'ini o'zgartira olmaydi
        if (trade.userId.toString() !== req.userId) {
            return res.status(403).json({ message: "Bu savdoni tahrirlashga ruxsatingiz yo'q" });
        }

        trade.date = date || trade.date;
        trade.time = time || trade.time;
        trade.pair = pair || trade.pair;
        trade.strategy = strategy || trade.strategy;
        trade.trend = trend || trade.trend;
        trade.pnl = pnl !== undefined ? parseFloat(pnl) : trade.pnl;
        trade.rr = rr !== undefined ? parseFloat(rr) : trade.rr;
        trade.psychology_before = psychology_before !== undefined ? psychology_before : trade.psychology_before;
        trade.notes = notes !== undefined ? notes : trade.notes;
        trade.session = session !== undefined ? session : trade.session;

        const updated = await trade.save();
        return res.json(updated);
    } catch (err) {
        console.error("PUT xatoligi:", err);
        return res.status(500).json({ message: "Yangilashda server xatoligi!" });
    }
});

// 4. SAVDONI O'CHIRISH (DELETE /api/trades/:id) — faqat egasi o'chira oladi
router.delete('/:id', async (req, res) => {
    try {
        const trade = await Trade.findById(req.params.id);
        if (!trade) return res.status(404).json({ message: "Savdo topilmadi!" });

        // 🔒 Egalikni tekshirish — boshqa foydalanuvchi trade'ini o'chira olmaydi
        if (trade.userId.toString() !== req.userId) {
            return res.status(403).json({ message: "Bu savdoni o'chirishga ruxsatingiz yo'q" });
        }

        await Trade.findByIdAndDelete(req.params.id);
        return res.json({ message: "Savdo muvaffaqiyatli o'chirildi!" });
    } catch (err) {
        return res.status(500).json({ message: "O'chirishda server xatoligi!" });
    }
});

// FAYLNING ENG OXIRGI QATORI BO'LISHI SHART:
module.exports = router;