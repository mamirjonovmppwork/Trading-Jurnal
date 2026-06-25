const express = require('express');
const router = express.Router();
const Trade = require('../models/trade'); // ⚠️ Model yo'li to'g'riligini tekshiring

// 1. BARCHA SAVDOLARNI OLISH (GET /api/trades)
router.get('/', async (req, res) => {
    try {
        const trades = await Trade.find().sort({ createdAt: -1 });
        return res.json(trades);
    } catch (err) {
        return res.status(500).json({ message: "Ma'lumotlarni yuklashda server xatoligi!" });
    }
});

// 2. SAVDO QO'SHISH (POST /api/trades)
router.post('/', async (req, res) => {
    try {
        const { date, time, pair, strategy, trend, type, pnl, rr } = req.body;
        
        const newTrade = new Trade({
            userId: req.user ? req.user.id : "6a3c9eabd018e904702ab5c9", // Xatolik bermasligi uchun xavfsiz ID yoki req.user.id
            date,
            time,
            pair,
            strategy,
            trend,
            type,
            pnl: parseFloat(pnl) || 0,
            rr: parseFloat(rr) || 0
        });

        const saved = await newTrade.save();
        return res.status(201).json(saved);
    } catch (err) {
        console.error("POST xatoligi:", err);
        return res.status(500).json({ message: "Savdoni saqlashda server xatoligi!" });
    }
});

// 3. SAVDONI TAHRIRLASH (PUT /api/trades/:id)
router.put('/:id', async (req, res) => {
    try {
        const { date, time, pair, strategy, trend, pnl, rr } = req.body;
        let trade = await Trade.findById(req.params.id);
        
        if (!trade) return res.status(404).json({ message: "Savdo topilmadi" });

        trade.date = date || trade.date;
        trade.time = time || trade.time;
        trade.pair = pair || trade.pair;
        trade.strategy = strategy || trade.strategy;
        trade.trend = trend || trade.trend;
        trade.pnl = pnl !== undefined ? parseFloat(pnl) : trade.pnl;
        trade.rr = rr !== undefined ? parseFloat(rr) : trade.rr;

        const updated = await trade.save();
        return res.json(updated);
    } catch (err) {
        return res.status(500).json({ message: "Yangilashda server xatoligi!" });
    }
});

// 4. SAVDONI O'CHIRISH (DELETE /api/trades/:id)
router.delete('/:id', async (req, res) => {
    try {
        const trade = await Trade.findById(req.params.id);
        if (!trade) return res.status(404).json({ message: "Savdo topilmadi!" });

        await Trade.findByIdAndDelete(req.params.id);
        return res.json({ message: "Savdo muvaffaqiyatli o'chirildi!" });
    } catch (err) {
        return res.status(500).json({ message: "O'chirishda server xatoligi!" });
    }
});

// FAYLNING ENG OXIRGI QATORI BO'LISHI SHART:
module.exports = router;