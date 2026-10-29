const jwt = require('jsonwebtoken');

// ==========================================================================
// TOKENLAR
// Ikki xil token bor va ularni ARALASHTIRIB YUBORMASLIK kritik:
//
//   purpose: 'access'  — butun API ga ruxsat, 24 soat. Faqat email
//                        tasdiqlangandan keyin beriladi.
//   purpose: 'verify'  — FAQAT verify-code / resend-code / change-email
//                        uchun, 15 daqiqa. API ga ruxsat bermaydi.
//
// authMiddleware purpose ni tekshiradi; busiz 'verify' tokeni butun
// API ni ochib yuborardi.
// ==========================================================================

const ACCESS_TTL = '24h';
const VERIFY_TTL = '15m';

const PURPOSE_ACCESS = 'access';
const PURPOSE_VERIFY = 'verify';

/** Tasdiqlangan foydalanuvchi uchun to'liq huquqli token */
function generateToken(userId) {
    return jwt.sign(
        { userId: String(userId), purpose: PURPOSE_ACCESS },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TTL }
    );
}

/** Tasdiqlash oqimi uchun cheklangan, qisqa muddatli token */
function generateVerifyToken(userId) {
    return jwt.sign(
        { userId: String(userId), purpose: PURPOSE_VERIFY },
        process.env.JWT_SECRET,
        { expiresIn: VERIFY_TTL }
    );
}

/**
 * Tokenni tekshiradi VA maqsadi mos kelishini talab qiladi.
 * Mos kelmasa name='TokenPurposeError' bo'lgan xato tashlaydi.
 */
function verifyTokenWithPurpose(token, expectedPurpose) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.purpose !== expectedPurpose) {
        const err = new Error(
            `Token maqsadi mos kelmadi (kutilgan: ${expectedPurpose}, kelgan: ${decoded.purpose || 'yo\'q'})`
        );
        err.name = 'TokenPurposeError';
        throw err;
    }

    return decoded;
}

module.exports = {
    generateToken,
    generateVerifyToken,
    verifyTokenWithPurpose,
    PURPOSE_ACCESS,
    PURPOSE_VERIFY,
    ACCESS_TTL,
    VERIFY_TTL,
};
