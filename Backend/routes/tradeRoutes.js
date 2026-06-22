const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Trade = require('../models/trade');

// Tokenni tekshirish uchun ichki middleware
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Ruxsat berilmadi' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Yaroqsiz token' });
    }
};

// SAVDOLAR RO'YXATINI OLISH (GET /api/trades)
router.get('/', verifyToken, async (req, res) => {
    try {
        const trades = await Trade.find({ userId: req.userId }).sort({ createdAt: -1 });
        res.json(trades);
    } catch (err) {
        res.status(500).json({ message: 'Ma\'lumotlarni yuklashda xatolik' });
    }
});

// YANGI SAVDO QO'SHISH (POST /api/trades)
router.post('/', verifyToken, async (req, res) => {
    try {
        const { pair, type, entryPrice, size, notes } = req.body;

        const newTrade = new Trade({
            userId: req.userId,
            pair,
            type,
            entryPrice,
            size,
            notes,
            status: 'OPEN',
            pnl: 0 // Yangi ochilgan savdo pnl blocki 0 bo'ladi
        });

        await newTrade.save();
        res.status(201).json(newTrade);
    } catch (err) {
        res.status(500).json({ message: 'Savdoni saqlashda xatolik yuz berdi' });
    }
});

module.exports = router;