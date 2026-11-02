const {
    verifyTokenWithPurpose,
    PURPOSE_ACCESS,
    PURPOSE_VERIFY,
} = require('../utils/jwt');
const User = require('../models/user');

/** Authorization: Bearer <token> dan tokenni ajratadi */
function extractToken(req) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (!/^Bearer$/i.test(scheme || '') || !token) return null;
    return token.trim();
}

/**
 * 🔒 Token parol o'zgarishidan OLDIN berilganmi?
 *
 * JWT `iat` SEKUNDLARDA va pastga yumaloqlangan, `passwordChangedAt` esa
 * millisekundli Date. Shu sababli to'g'ridan-to'g'ri `iat*1000 < pwdAt`
 * solishtirish yangi tokenni ham rad etib yuborishi mumkin: parol
 * o'zgargandan keyin darhol berilgan token `iat*1000` qiymati `pwdAt` dan
 * 999 ms gacha kichik bo'lishi mumkin.
 *
 * Shuning uchun tokenning butun sekundi tugashini hisobga olamiz:
 * token (iat+1)-sekundgacha "amal qiladi" deb qaraymiz.
 *
 *   eski token (kamida 1 sek oldin):  iat*1000 + 1000 <= pwdAt  → RAD
 *   yangi token (pwdAt'dan keyin):    iat*1000 + 1000 >  pwdAt  → O'TADI
 */
function issuedBeforePasswordChange(decoded, passwordChangedAt) {
    if (!passwordChangedAt || typeof decoded.iat !== 'number') return false;
    return (decoded.iat + 1) * 1000 <= passwordChangedAt.getTime();
}

/** Berilgan maqsad uchun middleware yasaydi */
function requirePurpose(expectedPurpose, purposeErrorMessage) {
    return async (req, res, next) => {
        const token = extractToken(req);
        if (!token) {
            return res.status(401).json({ message: "Avtorizatsiya rad etildi, token yo'q" });
        }

        let decoded;
        try {
            decoded = verifyTokenWithPurpose(token, expectedPurpose);
        } catch (err) {
            // ❗ Maqsadi boshqa token — masalan 'verify' tokeni bilan API ga
            //    kirishga urinish. Buni oddiy "yaroqsiz token" dan ajratamiz.
            if (err.name === 'TokenPurposeError') {
                return res.status(401).json({ message: purposeErrorMessage });
            }
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token muddati tugagan, qaytadan kiring' });
            }
            return res.status(401).json({ message: 'Yaroqsiz token' });
        }

        // 🔒 Imzo to'g'ri, lekin parol almashtirilgan bo'lsa token kuchsiz.
        // Faqat bitta maydon o'qiladi — _id bo'yicha, ya'ni arzon so'rov.
        try {
            const user = await User.findById(decoded.userId).select('passwordChangedAt');
            if (!user) {
                return res.status(401).json({ message: 'Foydalanuvchi topilmadi' });
            }
            if (issuedBeforePasswordChange(decoded, user.passwordChangedAt)) {
                return res.status(401).json({
                    message: "Parol o'zgartirilgan — qaytadan kiring",
                });
            }
        } catch (err) {
            console.error('authMiddleware: foydalanuvchini tekshirishda xatolik:', err.message);
            return res.status(500).json({ message: 'Serverda xatolik yuz berdi' });
        }

        req.userId = decoded.userId;
        req.tokenPurpose = decoded.purpose;
        return next();
    };
}

// 🔒 API uchun — faqat purpose:'access' o'tadi.
// Access token faqat email tasdiqlangandan keyin beriladi, shuning uchun
// "tasdiqlanmaganlar API ga kira olmaydi" sharti shu yerda ta'minlanadi.
const verifyToken = requirePurpose(
    PURPOSE_ACCESS,
    'Bu token API uchun yaroqsiz. Avval emailingizni tasdiqlang.'
);

// 🔑 Tasdiqlash oqimi uchun — faqat purpose:'verify' o'tadi
const verifyPendingToken = requirePurpose(
    PURPOSE_VERIFY,
    'Tasdiqlash tokeni yaroqsiz. Qaytadan kirishga harakat qiling.'
);

// Default eksport — tradeRoutes.js va telegramRoutes.js shu ko'rinishda ishlatadi
module.exports = verifyToken;
module.exports.verifyToken = verifyToken;
module.exports.verifyPendingToken = verifyPendingToken;
module.exports.issuedBeforePasswordChange = issuedBeforePasswordChange;
