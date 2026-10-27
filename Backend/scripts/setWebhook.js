// ==========================================================================
// BIR MARTALIK SKRIPT — Telegramga "yangilanishlarni shu URL'ga yubor" deb
// aytadi. Serverni deploy qilgandan keyin buni qo'lda ishga tushirasiz:
//
//   node scripts/setWebhook.js
//
// ❗ Bu server.js ichida ishlamaydi va route emas — mustaqil skript.
// ❗ .env da quyidagilar bo'lishi shart:
//      TELEGRAM_BOT_TOKEN
//      TELEGRAM_WEBHOOK_SECRET   (webhook'ni himoyalaydi)
//      BACKEND_URL               (masalan: https://trading-jurnal.onrender.com)
//
// ❗ TELEGRAM_WEBHOOK_SECRET o'zgarsa, shu skriptni QAYTA ishga tushirish kerak —
//    aks holda server kelayotgan so'rovlarni 403 bilan rad etadi.
// ==========================================================================

require('dotenv').config();

const BOT_TOKEN      = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const BACKEND_URL    = process.env.BACKEND_URL;

/** Kerakli env o'zgaruvchilar borligini tekshiradi */
function requireEnv() {
    const missing = [];
    if (!BOT_TOKEN)      missing.push('TELEGRAM_BOT_TOKEN');
    if (!WEBHOOK_SECRET) missing.push('TELEGRAM_WEBHOOK_SECRET');
    if (!BACKEND_URL)    missing.push('BACKEND_URL');

    if (missing.length) {
        console.error(`❌ .env faylida quyidagilar topilmadi: ${missing.join(', ')}`);
        process.exit(1);
    }
}

requireEnv();

// Route server.js da: app.use('/api/telegram', telegramWebhookRoutes) -> POST /webhook
const WEBHOOK_URL = `${BACKEND_URL.replace(/\/+$/, '')}/api/telegram/webhook`;

async function setWebhook() {
    try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: WEBHOOK_URL,
                // 🔒 Telegram shundan keyin har bir so'rovda
                //    X-Telegram-Bot-Api-Secret-Token header'ini yuboradi.
                secret_token: WEBHOOK_SECRET,
            }),
        });
        const data = await res.json();

        if (data.ok) {
            console.log("✅ Webhook muvaffaqiyatli o'rnatildi:", WEBHOOK_URL);
            console.log('🔒 secret_token yuborildi (uzunligi:', WEBHOOK_SECRET.length, 'belgi)');
        } else {
            console.error("❌ Webhook o'rnatishda xatolik:", data.description);
            process.exitCode = 1;
        }
    } catch (err) {
        console.error('❌ Telegram API ga ulanishda xatolik:', err.message);
        process.exitCode = 1;
    }
}

// Joriy webhook holatini tekshirish uchun yordamchi funksiya
async function getWebhookInfo() {
    try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
        const data = await res.json();
        console.log('ℹ️ Joriy webhook holati:', JSON.stringify(data.result, null, 2));
    } catch (err) {
        console.error('❌ getWebhookInfo xatoligi:', err.message);
    }
}

(async () => {
    await setWebhook();
    await getWebhookInfo();
})();
