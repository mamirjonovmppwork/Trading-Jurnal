// ==========================================================================
// 🔒 TRUST PROXY QARORI
//
// Alohida modul — chunki bu qaror rate limiter'ning butun ishonchliligini
// belgilaydi va test bilan qoplanishi kerak (tests/auth-security.test.js).
//
// `trust proxy` yoqilgan bo'lsa Express `req.ip` ni `X-Forwarded-For`
// header'idan oladi. Render/Vercel kabi proxy ortida bu to'g'ri — proxy
// header'ni o'zi qayta yozadi. Lekin backend to'g'ridan-to'g'ri ochiq
// bo'lsa, har kim soxta header yuborib har so'rovda yangi "IP" ko'rsatib
// rate limiter'ni chetlab o'tishi mumkin.
//
// Shuning uchun default — O'CHIQ.
// ==========================================================================

/**
 * @returns {boolean} trust proxy yoqilishi kerakmi.
 *
 *   TRUST_PROXY berilgan bo'lsa — faqat shunga qaraydi ('1' yoki 'true').
 *   Berilmagan bo'lsa — NODE_ENV === 'production' bo'lsa yoqiladi
 *   (Render Node servislarida NODE_ENV=production o'rnatiladi).
 *
 * Env har chaqiruvda qayta o'qiladi — modul yuklanish tartibiga bog'liq
 * bo'lmasligi uchun (dotenv qachon chaqirilganidan qat'i nazar).
 */
function trustProxyEnabled() {
    const raw = process.env.TRUST_PROXY;

    if (raw !== undefined && raw !== '') {
        const v = String(raw).trim().toLowerCase();
        return v === '1' || v === 'true';
    }

    return process.env.NODE_ENV === 'production';
}

module.exports = { trustProxyEnabled };
