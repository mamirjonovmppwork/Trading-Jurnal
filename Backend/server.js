const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const telegramRoutes = require('./routes/telegramRoutes');
const telegramWebhook = require('./routes/telegramWebhook');
const { startTelegramScheduler } = require('./scheduler/telegramScheduler');

const app = express();

// ==========================================================================
// CORS SOZLAMALARI
// ==========================================================================
const allowedOrigins = [
    'https://trading-jurnalv2.netlify.app',
    'https://trading-jurnal-two.vercel.app',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
];

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`CORS bloklandi: ${origin}`);
            callback(new Error('CORS siyosati tomonidan taqiqlangan'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// ==========================================================================
// ROUTES
// ==========================================================================
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.get('/', (req, res) => {
    res.send('Trading Jurnal API muvaffaqiyatli ishlamoqda! 🚀');
});

app.use('/api/auth', authRoutes);
app.use('/api/trades', tradeRoutes);

// 🟢 TELEGRAM — webhook (tokensiz, Telegram serverlaridan keladi) va
//    foydalanuvchi API'lari (token bilan) bitta prefiksga ulanadi.
app.use('/api/telegram', telegramWebhook);
app.use('/api/telegram', telegramRoutes);

// ==========================================================================
// 404 — noma'lum yo'llar uchun
// ==========================================================================
app.use((req, res) => {
    res.status(404).json({ message: 'So\'ralgan manzil topilmadi' });
});

// ==========================================================================
// XATOLIKLARNI UMUMIY USHLAB OLISH (shu jumladan CORS xatoligi)
// ==========================================================================
app.use((err, req, res, next) => {
    console.error('Server xatosi:', err.message);
    if (err.message === 'CORS siyosati tomonidan taqiqlangan') {
        return res.status(403).json({ message: 'Ushbu manbadan so\'rovga ruxsat yo\'q (CORS)' });
    }
    res.status(500).json({ message: 'Serverda kutilmagan xatolik yuz berdi' });
});

// ==========================================================================
// MONGODB VA SERVERNI ISHGA TUSHIRISH
// ==========================================================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB bazasiga muvaffaqiyatli ulandi! 🖥️');
        startTelegramScheduler(); // 🟢 Kunlik hisobot / eslatmalarni kuzatuvchi scheduler
    })
    .catch(err => console.error('MongoDB ulanishida xatolik chiqdi:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server ${PORT}-portda muammosiz gupillab ishlamoqda... 🔥`);
});