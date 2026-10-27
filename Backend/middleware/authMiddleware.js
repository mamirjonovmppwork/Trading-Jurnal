const {
    verifyTokenWithPurpose,
    PURPOSE_ACCESS,
    PURPOSE_VERIFY,
} = require('../utils/jwt');

/** Authorization: Bearer <token> dan tokenni ajratadi */
function extractToken(req) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (!/^Bearer$/i.test(scheme || '') || !token) return null;
    return token.trim();
}

/** Berilgan maqsad uchun middleware yasaydi */
function requirePurpose(expectedPurpose, purposeErrorMessage) {
    return (req, res, next) => {
        const token = extractToken(req);
        if (!token) {
            return res.status(401).json({ message: "Avtorizatsiya rad etildi, token yo'q" });
        }

        try {
            const decoded = verifyTokenWithPurpose(token, expectedPurpose);
            req.userId = decoded.userId;
            req.tokenPurpose = decoded.purpose;
            return next();
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
