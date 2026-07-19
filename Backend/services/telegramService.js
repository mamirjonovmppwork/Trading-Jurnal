const crypto = require('crypto');

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

/**
 * Berilgan chat_id ga Telegram orqali xabar yuboradi.
 * Node 18+ dagi global fetch ishlatiladi — qo'shimcha kutubxona shart emas.
 */
async function sendTelegramMessage(chatId, text, options = {}) {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
        console.error('❌ TELEGRAM_BOT_TOKEN .env faylida topilmadi!');
        return null;
    }
    if (!chatId) return null;

    try {
        const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                ...options,
            }),
        });
        const data = await res.json();
        if (!data.ok) {
            console.error('Telegram xabar yuborishda xatolik:', data.description);
        }
        return data;
    } catch (err) {
        console.error('Telegram API ga ulanishda xatolik:', err.message);
        return null;
    }
}

/** Botga ulanish uchun bir martalik xavfsiz token yaratadi */
function generateConnectToken() {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Serverning joylashuvidan qat'iy nazar, doim Toshkent vaqtini (UTC+5) qaytaradi.
 * Bu scheduler'da eslatma/hisobot vaqtini to'g'ri solishtirish uchun kerak.
 */
function getUzbekistanTime() {
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const tashkent = new Date(utcMs + 5 * 60 * 60000);

    const hh = String(tashkent.getHours()).padStart(2, '0');
    const mm = String(tashkent.getMinutes()).padStart(2, '0');
    const dateStr = `${tashkent.getFullYear()}-${String(tashkent.getMonth() + 1).padStart(2, '0')}-${String(tashkent.getDate()).padStart(2, '0')}`;

    return { hhmm: `${hh}:${mm}`, dateStr };
}

module.exports = { sendTelegramMessage, generateConnectToken, getUzbekistanTime, TELEGRAM_API };