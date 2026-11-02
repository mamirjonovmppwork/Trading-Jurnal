const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const telegramRoutes = require('./routes/telegramRoutes');       // ulanish/sozlamalar/eslatmalar (login talab qiladi)
const telegramWebhookRoutes = require('./routes/telegramWebhook'); // Telegramdan keladigan xabarlar (login talab qilmaydi)
const { startTelegramScheduler } = require('./scheduler/telegramScheduler'); // kunlik hisobot va eslatmalar
const { trustProxyEnabled } = require('./utils/trustProxy');

const app = express();

// ==========================================================================
// 🔒 TRUST PROXY — faqat haqiqatan proxy ortida bo'lganda
//
// Bu sozlama yoqilgan bo'lsa Express `X-Forwarded-For` header'iga ishonadi
// va `req.ip` ni shundan oladi. Render/Vercel kabi hostinglarda bu to'g'ri:
// proxy header'ni o'zi qayta yozadi, foydalanuvchi unga ta'sir qila olmaydi.
//
// ❗ Lekin backend TO'G'RIDAN-TO'G'RI ochiq bo'lsa (lokal ish, boshqa hosting),
//    har kim soxta `X-Forwarded-For` yuborib har so'rovda yangi "IP" ko'rsatib
//    rate limiter'ni butunlay chetlab o'tishi mumkin edi.
//
// Shuning uchun default — O'CHIQ. Render'da `TRUST_PROXY=1` qo'yiladi.
// NODE_ENV=production ham yoqadi (Render buni o'zi o'rnatadi).
//
// Qaror mantig'i utils/trustProxy.js da — u test bilan qoplangan.
// ==========================================================================
if (trustProxyEnabled()) {
    app.set('trust proxy', 1);
    console.log("🔒 trust proxy YOQILGAN — req.ip X-Forwarded-For dan olinadi");
} else {
    // Express'ning default qiymati ham `false`, lekin buni ataylab, ko'rinadigan
    // qilib yozamiz — kelajakda kimdir "nega yo'q?" deb o'ylab qolmasligi uchun.
    app.set('trust proxy', false);
    console.log("🔒 trust proxy O'CHIQ — req.ip to'g'ridan-to'g'ri ulanishdan olinadi");
}

// 🔒 Xavfsizlik header'lari (helmet).
// API cross-origin ishlatilgani uchun CORP 'cross-origin' ga qo'yildi.
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// 🩺 Health check — mongoose ulanmagan bo'lsa 503 qaytaradi,
// shunda monitoring/balanser serverni "sog'lom" deb o'ylab qolmaydi.
app.get('/health', (req, res) => {
    const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    const state = mongoose.connection.readyState;

    if (state === 1) {
        return res.status(200).json({ status: 'ok', db: 'connected' });
    }
    return res.status(503).json({
        status: 'unavailable',
        db: STATES[state] || String(state),
    });
});

// Middleware sozlamalari (CORS to'liq va mukammal versiyasi)
app.use(cors({
    origin: [
        'https://trading-jurnalv2.netlify.app',
        'https://trading-jurnal-two.vercel.app', // Vercel'dagi frontend
        'http://localhost:5500', // Mahalliy tekshirishlar uchun ham joy qoldiramiz
        'http://127.0.0.1:5500',
        'http://localhost:5501',
        'http://127.0.0.1:5501',
    ],
    credentials: true, // Agar cookie yoki tokenlar ishlatilsa, ruxsat beradi
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 🔒 Payload chegarasi — katta body bilan DoS qilishni oldini oladi
app.use(express.json({ limit: '100kb' }));

// API yo'llarini ulash
app.use('/api/auth', authRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/telegram', telegramWebhookRoutes);  // AVVAL — Telegramdan keladi, token yo'q (POST /api/telegram/webhook)
app.use('/api/telegram', telegramRoutes);         // KEYIN — login qilingan foydalanuvchi so'rovlari (verifyToken talab qiladi)

// Bosh sahifaga so'rov kelsa (Render o'chib qolmasligi uchun "Ping" vazifasini o'taydi)
app.get('/', (req, res) => {
    res.send('Trading Jurnal API muvaffaqiyatli ishlamoqda! 🚀');
});

// 🔒 Umumiy xato ushlagich — JSON parse xatosi va kutilmagan xatolarda
// stack trace foydalanuvchiga chiqib ketmasligi uchun.
app.use((err, req, res, next) => {
    if (err?.type === 'entity.too.large') {
        return res.status(413).json({ message: "So'rov hajmi juda katta (maksimum 100kb)" });
    }
    if (err instanceof SyntaxError && 'body' in err) {
        return res.status(400).json({ message: "So'rov tanasi yaroqsiz JSON formatida" });
    }
    console.error('Kutilmagan server xatosi:', err);
    return res.status(500).json({ message: 'Serverda xatolik yuz berdi' });
});

// ==========================================================================
// DNS — ixtiyoriy, faqat lokal ish uchun
//
// mongodb+srv:// manzili SRV yozuvini yechishni talab qiladi. Ba'zi
// internet provayderlarining DNS serverlari SRV so'rovlariga javob
// bermaydi va natijada "querySrv ENOTFOUND" xatosi chiqadi.
//
// DNS_SERVERS berilgan bo'lsa, Node shu serverlardan foydalanadi.
// Render'da (va umuman production'da) bu o'zgaruvchi yo'q — u yerda
// hech narsa o'zgarmaydi va tizim DNS'i ishlatiladi.
//
// Lokal .env uchun: DNS_SERVERS=8.8.8.8,1.1.1.1
// ==========================================================================
if (process.env.DNS_SERVERS) {
    const dns = require('node:dns');
    const servers = process.env.DNS_SERVERS
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    if (servers.length) {
        try {
            dns.setServers(servers);
            console.log(`🌐 DNS serverlari o'rnatildi: ${servers.join(', ')}`);
        } catch (err) {
            // Yaroqsiz manzil berilsa butun server ishdan chiqmasligi kerak
            console.error("⚠️  DNS_SERVERS yaroqsiz, tizim DNS'i ishlatiladi:", err.message);
        }
    }
}

// MongoDB bazasiga ulanish
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log(`MongoDB bazasiga muvaffaqiyatli ulandi! 🖥️  (baza: ${mongoose.connection.name})`))
    .catch(err => {
        console.error('MongoDB ulanishida xatolik chiqdi:', err.message);
        if (err.code === 'ENOTFOUND' && /querySrv/.test(err.syscall || '')) {
            console.error(
                "💡 SRV yozuvi yechilmadi. Lokal ishda .env ga qo'shib ko'ring:\n" +
                '   DNS_SERVERS=8.8.8.8,1.1.1.1'
            );
        }
    });

// Server portini yoqish
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server ${PORT}-portda muammosiz gupillab ishlamoqda... 🔥`);
    startTelegramScheduler(); // kunlik hisobot va eslatmalarni har daqiqada tekshiradi
});
