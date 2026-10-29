// ==========================================================================
// SO'ROV VALIDATSIYASI
// Maqsad: noto'g'ri ma'lumot mongoose'ga yetib bormasin va foydalanuvchi
// 500 emas, tushunarli o'zbekcha 400 xabarini olsin.
// ==========================================================================

const Trade = require('../models/trade');
const User = require('../models/user');

// Enum ro'yxatlarini schema'dan o'qiymiz — qo'lda dublikat qilsak,
// keyinchalik schema o'zgarganda ikkisi bir-biridan uzilib ketadi.
const TRENDS     = Trade.schema.path('trend').enumValues;
const TYPES      = Trade.schema.path('type').enumValues;
const SESSIONS   = Trade.schema.path('session').enumValues;
const PSYCHOLOGY = Trade.schema.path('psychology_before').enumValues;

// User massiv maydonlarining enum'i mongoose introspeksiyasida qulay
// ko'rinmaydi, shuning uchun model o'zi eksport qiladi (bir xil konstantalar).
const { TRADING_STYLES, STRATEGIES, MARKETS, EXPERIENCE } = User.ENUMS;

const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE    = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE    = /^([01]\d|2[0-3]):[0-5]\d$/;
const CODE_RE    = /^\d{6}$/;
const PHONE_RE   = /^\d{6,14}$/;
const DIALCODE_RE = /^\+\d{1,4}$/;

/** Bo'sh qiymatmi (undefined / null / bo'sh satr) */
function isEmpty(v) {
    return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

/** Matn uzunligini tekshiradi */
function checkText(errors, value, label, min, max, required = false) {
    if (isEmpty(value)) {
        if (required) errors.push(`${label} kiritilishi shart`);
        return;
    }
    if (typeof value !== 'string') {
        errors.push(`${label} matn ko'rinishida bo'lishi kerak`);
        return;
    }
    const len = value.trim().length;
    if (len < min) errors.push(`${label} kamida ${min} belgidan iborat bo'lishi kerak`);
    if (len > max) errors.push(`${label} ${max} belgidan oshmasligi kerak`);
}

/** Qiymat raqamga aylanishini tekshiradi */
function checkNumber(errors, value, label, required = false) {
    if (isEmpty(value)) {
        if (required) errors.push(`${label} kiritilishi shart`);
        return;
    }
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) errors.push(`${label} raqam bo'lishi kerak`);
}

/** Raqam oraliqda ekanini tekshiradi */
function checkRange(errors, value, label, min, max) {
    if (isEmpty(value)) return;
    const n = Number(value);
    if (!Number.isFinite(n)) {
        errors.push(`${label} raqam bo'lishi kerak`);
        return;
    }
    if (n < min || n > max) errors.push(`${label} ${min} dan ${max} gacha bo'lishi kerak`);
}

/** Qiymat ruxsat etilgan ro'yxatda ekanini tekshiradi */
function checkEnum(errors, value, label, allowed, required = false) {
    if (isEmpty(value)) {
        if (required) errors.push(`${label} tanlanishi shart`);
        return;
    }
    if (!allowed.includes(value)) {
        errors.push(`${label} uchun yaroqsiz qiymat (ruxsat etilgan: ${allowed.join(', ')})`);
    }
}

/** Massiv va uning har bir elementi enum'da ekanini tekshiradi */
function checkEnumArray(errors, value, label, allowed) {
    if (value === undefined || value === null) return;
    if (!Array.isArray(value)) {
        errors.push(`${label} ro'yxat ko'rinishida bo'lishi kerak`);
        return;
    }
    if (value.length > allowed.length) {
        errors.push(`${label} uchun juda ko'p qiymat tanlangan`);
        return;
    }
    for (const item of value) {
        if (!allowed.includes(item)) {
            errors.push(`${label} uchun yaroqsiz qiymat: ${item}`);
            return;
        }
    }
}

/** Regex bo'yicha format tekshiruvi */
function checkPattern(errors, value, label, re, hint, required = false) {
    if (isEmpty(value)) {
        if (required) errors.push(`${label} kiritilishi shart`);
        return;
    }
    if (typeof value !== 'string' || !re.test(value.trim())) {
        errors.push(`${label} formati noto'g'ri (${hint})`);
    }
}

/** Xatolar bo'lsa 400 qaytaradi */
function reject(res, errors) {
    return res.status(400).json({ message: errors[0], errors });
}

/** req.body umuman obyektmi — bo'lmasa qolgan tekshiruvlar ma'nosiz */
function bodyIsObject(req) {
    return req.body && typeof req.body === 'object' && !Array.isArray(req.body);
}

// ------------------------------------------------------- PROFIL MAYDONLARI

/**
 * Shaxsiy + treyding profili maydonlari. Hammasi IXTIYORIY.
 * register, PUT /profile va profile-setup bir xil ro'yxatdan foydalanadi —
 * shuning uchun qoidalar bitta joyda.
 */
function checkProfileFields(errors, b) {
    checkText(errors, b.firstName, 'Ism', 0, 50);
    checkText(errors, b.lastName, 'Familiya', 0, 50);
    checkRange(errors, b.age, 'Yosh', 16, 99);

    checkPattern(errors, b.phone, 'Telefon raqami', PHONE_RE, 'faqat raqamlar, 6-14 ta');
    checkPattern(errors, b.phoneCountryCode, 'Davlat kodi', DIALCODE_RE, "masalan: +998");

    checkNumber(errors, b.initialBalance, "Boshlang'ich depozit");
    if (!isEmpty(b.initialBalance) && Number(b.initialBalance) < 0) {
        errors.push("Boshlang'ich depozit manfiy bo'lishi mumkin emas");
    }

    checkEnumArray(errors, b.tradingStyles, 'Savdo uslubi', TRADING_STYLES);
    checkEnumArray(errors, b.strategies, 'Strategiya', STRATEGIES);
    checkEnumArray(errors, b.markets, 'Bozor', MARKETS);
    checkEnum(errors, b.experience, 'Tajriba', EXPERIENCE);
    checkText(errors, b.customStrategy, 'Boshqa strategiya', 0, 100);
}

// ---------------------------------------------------------------- AUTH

function validateRegister(req, res, next) {
    if (!bodyIsObject(req)) return reject(res, ["So'rov tanasi yaroqsiz"]);
    const errors = [];
    const b = req.body;

    // Majburiy: email, parol, shartlarga rozilik
    checkPattern(errors, b.email, 'Email', EMAIL_RE, 'masalan: ism@example.com', true);
    checkText(errors, b.password, 'Parol', 8, 128, true);

    if (b.acceptedTerms !== true) {
        errors.push("Foydalanish shartlari va maxfiylik siyosatiga rozilik bildirilishi shart");
    }

    // username ixtiyoriy — berilmasa route ism/email'dan yasaydi
    checkText(errors, b.username, 'Foydalanuvchi nomi', 2, 30);

    checkProfileFields(errors, b);

    if (errors.length) return reject(res, errors);
    next();
}

function validateLogin(req, res, next) {
    if (!bodyIsObject(req)) return reject(res, ["So'rov tanasi yaroqsiz"]);
    const errors = [];
    const { email, password } = req.body;

    checkPattern(errors, email, 'Email', EMAIL_RE, 'masalan: ism@example.com', true);
    // Login'da parol qoidalarini oshkor qilmaymiz — faqat bo'sh emasligini tekshiramiz
    if (isEmpty(password)) errors.push('Parol kiritilishi shart');

    if (errors.length) return reject(res, errors);
    next();
}

function validateVerifyCode(req, res, next) {
    if (!bodyIsObject(req)) return reject(res, ["So'rov tanasi yaroqsiz"]);
    const errors = [];
    checkPattern(errors, req.body.code, 'Tasdiqlash kodi', CODE_RE, '6 xonali raqam', true);
    if (errors.length) return reject(res, errors);
    next();
}

function validateChangeEmail(req, res, next) {
    if (!bodyIsObject(req)) return reject(res, ["So'rov tanasi yaroqsiz"]);
    const errors = [];
    checkPattern(errors, req.body.newEmail, 'Yangi email', EMAIL_RE, 'masalan: ism@example.com', true);
    if (errors.length) return reject(res, errors);
    next();
}

function validateForgotPassword(req, res, next) {
    if (!bodyIsObject(req)) return reject(res, ["So'rov tanasi yaroqsiz"]);
    const errors = [];
    checkPattern(errors, req.body.email, 'Email', EMAIL_RE, 'masalan: ism@example.com', true);
    if (errors.length) return reject(res, errors);
    next();
}

function validateResetPassword(req, res, next) {
    if (!bodyIsObject(req)) return reject(res, ["So'rov tanasi yaroqsiz"]);
    const errors = [];
    const b = req.body;

    checkPattern(errors, b.email, 'Email', EMAIL_RE, 'masalan: ism@example.com', true);
    checkPattern(errors, b.code, 'Tasdiqlash kodi', CODE_RE, '6 xonali raqam', true);
    checkText(errors, b.newPassword, 'Yangi parol', 8, 128, true);

    if (errors.length) return reject(res, errors);
    next();
}

function validateProfileUpdate(req, res, next) {
    if (!bodyIsObject(req)) return reject(res, ["So'rov tanasi yaroqsiz"]);
    const errors = [];

    // Email bu endpoint orqali o'zgarmaydi — jimgina e'tiborsiz
    // qoldirmasdan, aniq xato beramiz
    if (req.body.email !== undefined) {
        errors.push("Email bu yerdan o'zgartirilmaydi");
    }

    checkText(errors, req.body.username, 'Foydalanuvchi nomi', 2, 30);
    checkProfileFields(errors, req.body);

    if (errors.length) return reject(res, errors);
    next();
}

function validatePasswordChange(req, res, next) {
    if (!bodyIsObject(req)) return reject(res, ["So'rov tanasi yaroqsiz"]);
    const errors = [];
    const { currentPassword, newPassword } = req.body;

    if (isEmpty(currentPassword)) errors.push('Joriy parol kiritilishi shart');
    checkText(errors, newPassword, 'Yangi parol', 8, 128, true);

    if (!errors.length && currentPassword === newPassword) {
        errors.push("Yangi parol joriy paroldan farq qilishi kerak");
    }

    if (errors.length) return reject(res, errors);
    next();
}

// --------------------------------------------------------------- TRADE

/**
 * Savdo maydonlarini tekshiradi.
 * isCreate=true  -> date/time/pair/trend majburiy (POST)
 * isCreate=false -> hamma maydon ixtiyoriy, faqat kelgani tekshiriladi (PUT)
 */
function validateTradeBody(req, res, next, isCreate) {
    if (!bodyIsObject(req)) return reject(res, ["So'rov tanasi yaroqsiz"]);
    const errors = [];
    const b = req.body;

    checkPattern(errors, b.date, 'Sana', DATE_RE, 'YYYY-MM-DD', isCreate);
    checkPattern(errors, b.time, 'Vaqt', TIME_RE, 'HH:MM', isCreate);
    checkText(errors, b.pair, 'Valyuta juftligi', 1, 20, isCreate);
    checkEnum(errors, b.trend, "Yo'nalish", TRENDS, isCreate);

    checkText(errors, b.strategy, 'Strategiya', 0, 50);
    checkText(errors, b.notes, 'Izoh', 0, 500);
    checkText(errors, b.mistake, 'Xato turi', 0, 50);

    checkNumber(errors, b.pnl, 'P&L');
    checkNumber(errors, b.rr, 'R:R');
    checkNumber(errors, b.entryPrice, 'Kirish narxi');
    checkNumber(errors, b.size, 'Lot hajmi');

    checkEnum(errors, b.type, 'Savdo turi', TYPES);
    checkEnum(errors, b.session, 'Sessiya', SESSIONS);
    checkEnum(errors, b.psychology_before, 'Kayfiyat', PSYCHOLOGY);

    if (errors.length) return reject(res, errors);
    next();
}

const validateTradeCreate = (req, res, next) => validateTradeBody(req, res, next, true);
const validateTradeUpdate = (req, res, next) => validateTradeBody(req, res, next, false);

// ------------------------------------------------------------ TELEGRAM

function validateReminder(req, res, next) {
    if (!bodyIsObject(req)) return reject(res, ["So'rov tanasi yaroqsiz"]);
    const errors = [];
    const { time, title, freq } = req.body;

    checkPattern(errors, time, 'Vaqt', TIME_RE, 'HH:MM', true);
    checkText(errors, title, 'Eslatma nomi', 1, 100, true);
    checkText(errors, freq, 'Takrorlanish', 0, 30);

    if (errors.length) return reject(res, errors);
    next();
}

/**
 * Mongoose ValidationError / CastError ni 400 ga aylantiradi.
 * Route'lardagi catch bloklarida ishlatiladi — shunda schema xatosi
 * foydalanuvchiga 500 bo'lib ko'rinmaydi.
 */
function handleDbValidationError(err, res, fallbackMessage) {
    if (err?.name === 'ValidationError') {
        const messages = Object.values(err.errors || {}).map(e => e.message);
        return res.status(400).json({
            message: messages[0] || "Yuborilgan ma'lumot yaroqsiz",
            errors: messages,
        });
    }
    if (err?.name === 'CastError') {
        return res.status(400).json({ message: `Yaroqsiz qiymat: ${err.path}` });
    }
    console.error(fallbackMessage, err);
    return res.status(500).json({ message: fallbackMessage });
}

module.exports = {
    validateRegister,
    validateLogin,
    validateVerifyCode,
    validateChangeEmail,
    validateForgotPassword,
    validateResetPassword,
    validateProfileUpdate,
    validatePasswordChange,
    validateTradeCreate,
    validateTradeUpdate,
    validateReminder,
    handleDbValidationError,
};
