const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const tradeRoutes = require('./routes/tradeRoutes');

const app = express();

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
});