// ==========================================================================
// BIR MARTALIK SKRIPT — Telegramga "yangilanishlarni shu URL'ga yubor" deb
// aytadi. Serverni deploy qilgandan keyin buni FAQAT BIR MARTA qo'lda
// ishga tushirasiz:
//
//   node setWebhook.js
//
// ❗ Bu server.js ichida ishlamaydi va route emas — mustaqil skript.
// ❗ .env faylida TELEGRAM_BOT_TOKEN bo'lishi shart.
// ==========================================================================

require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ⚠️ O'zingizning backend URL'ingizni yozing (Render'dagi domen)
// Route server.js da: app.use('/api/telegram', telegramWebhookRoutes) → POST /webhook
// Shuning uchun to'liq manzil: https://<domen>/api/telegram/webhook
const WEBHOOK_URL = 'https://trading-jurnal.onrender.com/api/telegram/webhook';

async function setWebhook() {
    if (!BOT_TOKEN) {
        console.error('❌ TELEGRAM_BOT_TOKEN .env faylida topilmadi!');
        process.exit(1);
    }

    try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: WEBHOOK_URL }),
        });
        const data = await res.json();

        if (data.ok) {
            console.log('✅ Webhook muvaffaqiyatli o\'rnatildi:', WEBHOOK_URL);
        } else {
            console.error('❌ Webhook o\'rnatishda xatolik:', data.description);
        }
    } catch (err) {
        console.error('❌ Telegram API ga ulanishda xatolik:', err.message);
    }
}

// Joriy webhook holatini tekshirish uchun yordamchi funksiya (ixtiyoriy)
async function getWebhookInfo() {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const data = await res.json();
    console.log('ℹ️ Joriy webhook holati:', JSON.stringify(data.result, null, 2));
}

(async () => {
    await setWebhook();
    await getWebhookInfo();
})();