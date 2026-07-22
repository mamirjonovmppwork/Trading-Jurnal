const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const telegramRoutes = require('./routes/telegramRoutes');       // 🟢 QO'SHILDI — ulanish/sozlamalar/eslatmalar (login talab qiladi)
const telegramWebhookRoutes = require('./routes/telegramWebhook'); // 🟢 QO'SHILDI — Telegramdan keladigan xabarlar (login talab qilmaydi)
const { startTelegramScheduler } = require('./schedular/telegramScheduler'); // 🟢 QO'SHILDI — kunlik hisobot va eslatmalar

const app = express();

app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

// Middleware sozlamalari (CORS to'liq va mukammal versiyasi)
app.use(cors({
    // ⚠️ BU YERGA O'ZINGIZNING NETLIFY HAVOLANGIZNI YOZING! (oxiridagi / belgisiz)
    origin: [
        'https://trading-jurnalv2.netlify.app', 
        'http://localhost:5500', // Mahalliy tekshirishlar uchun ham joy qoldiramiz
        'http://127.0.0.1:5500'
    ],
    credentials: true, // Agar cookie yoki tokenlar ishlatilsa, ruxsat beradi
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// API yo'llarini ulash
app.use('/api/auth', authRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/telegram', telegramRoutes);        // 🟢 masalan: POST /api/telegram/connect-token
app.use('/api/telegram', telegramWebhookRoutes);  // 🟢 masalan: POST /api/telegram/webhook (Telegram bu yerga yozadi)

// Bosh sahifaga so'rov kelsa (Render o'chib qolmasligi uchun "Ping" vazifasini o'taydi)
app.get('/', (req, res) => {
    res.send('Trading Jurnal API muvaffaqiyatli ishlamoqda! 🚀');
});

// MongoDB bazasiga ulanish
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB bazasiga muvaffaqiyatli ulandi! 🖥️'))
    .catch(err => console.error('MongoDB ulanishida xatolik chiqdi:', err));

// Server portini yoqish
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server ${PORT}-portda muammosiz gupillab ishlamoqda... 🔥`);
    startTelegramScheduler(); // 🟢 kunlik hisobot va eslatmalarni har daqiqada tekshiradi
});