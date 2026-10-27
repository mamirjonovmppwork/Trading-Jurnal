const mongoose = require('mongoose');

// ======================================================================
// Enum ro'yxatlari — validate.js bularni schema'dan o'qiydi,
// shuning uchun qo'lda dublikat qilinmaydi.
// ======================================================================
const TRADING_STYLES = ['Scalping', 'Day trading', 'Swing', 'Uzoq muddatli'];
const STRATEGIES     = ['SMC/ICT', 'Price Action', 'Support/Resistance', 'Supply & Demand', 'Indikatorlar', 'Fibonacci', 'Boshqa'];
const MARKETS        = ['Forex', 'Kripto', 'Oltin', 'Indekslar'];
const EXPERIENCE     = ['0-1', '1-3', '3+'];
const CODE_PURPOSES  = ['verify_email', 'reset_password'];

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        default: null
    },

    googleId: {
        type: String,
        default: null
    },

    provider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },

    avatar: {
        type: String,
        default: ''
    },

    isVerified: {
        type: Boolean,
        default: false
    },

    // 🟢 "Profil to'ldirilgan" ma'nosida ishlatiladi (onboarding.html o'chirildi).
    // Oddiy register — darhol true; Google'dan kelgan yangi user — false.
    isOnboarded: {
        type: Boolean,
        default: false
    },

    initialBalance: {
        type: Number,
        default: 0,
        min: 0
    },

    // ======================================================================
    // 🟢 SHAXSIY MA'LUMOTLAR (hammasi ixtiyoriy)
    // ======================================================================

    firstName: { type: String, default: '', maxlength: 50, trim: true },
    lastName:  { type: String, default: '', maxlength: 50, trim: true },

    age: {
        type: Number,
        default: null,
        min: 16,
        max: 99
    },

    // Faqat raqamlar saqlanadi (davlat kodisiz)
    phone: { type: String, default: '', trim: true },
    phoneCountryCode: { type: String, default: '+998', trim: true },

    // ======================================================================
    // 🟢 TREYDING PROFILI (hammasi ixtiyoriy)
    // ======================================================================

    // ❗ [{ type: String, enum }] shakli SHART — { type: [String], enum } da
    //    mongoose 9 validator yaratmaydi va enum jimgina e'tiborsiz qoladi.
    tradingStyles: { type: [{ type: String, enum: TRADING_STYLES }], default: [] },
    strategies:    { type: [{ type: String, enum: STRATEGIES     }], default: [] },
    markets:       { type: [{ type: String, enum: MARKETS        }], default: [] },

    // "Boshqa" strategiya tanlanganda to'ldiriladi
    customStrategy: { type: String, default: '', maxlength: 100, trim: true },

    experience: {
        type: String,
        enum: EXPERIENCE,
        default: null
    },

    // ======================================================================
    // 🟢 BIR MARTALIK KOD (email tasdiqlash / parol tiklash)
    // Bir vaqtda faqat BITTA aktiv kod bo'ladi.
    // ======================================================================
    authCode: {
        // Kod ochiq saqlanmaydi — bcrypt hash
        codeHash: { type: String, default: null },

        // Nima uchun berilgan. Bu maydon bo'lmasa email tasdiqlash kodi
        // bilan parolni tiklash mumkin bo'lib qolardi.
        purpose: { type: String, enum: CODE_PURPOSES, default: null },

        expiresAt: { type: Date, default: null },

        // 5 ta noto'g'ri urinishdan keyin kod kuyadi
        attempts: { type: Number, default: 0 },

        // "Emailni o'zgartirish" oqimi: kod tasdiqlangach shu email asosiy bo'ladi
        pendingEmail: { type: String, default: null },

        // Server tomonidagi 60 sekundlik qayta yuborish chegarasi
        lastSentAt: { type: Date, default: null },
    },

    // ======================================================================
    // 🟢 TELEGRAM INTEGRATSIYASI
    // ======================================================================

    // Ulangan Telegram chat ID (foydalanuvchi botga /start bosgach to'ldiriladi)
    telegramChatId: {
        type: String,
        default: null
    },

    // Ulanish jarayonida ishlatiladigan bir martalik token (10 daqiqa amal qiladi)
    telegramConnectToken: {
        type: String,
        default: null
    },
    telegramConnectTokenExpires: {
        type: Date,
        default: null
    },

    // Bildirishnoma va kunlik hisobot sozlamalari
    telegramSettings: {
        notifTradeSaved:      { type: Boolean, default: true },
        notifRiskAlert:       { type: Boolean, default: true },
        notifDailyReport:     { type: Boolean, default: true },
        notifGoalProgress:    { type: Boolean, default: true },
        notifWeeklyReport:    { type: Boolean, default: true },
        notifSessionReminder: { type: Boolean, default: false },

        reportAutoSend: { type: Boolean, default: true },
        reportTime:     { type: String, default: '22:00' }, // "HH:MM", Toshkent vaqti
        reportIncludes: { type: [String], default: ['trades', 'winrate', 'profit'] },

        // Scheduler bir kunda bir marta yuborilishini nazorat qilish uchun
        lastReportSentDate: { type: String, default: null }, // "YYYY-MM-DD"
    },

    // Savdo eslatmalari ("Telegram Assistant" bo'limidagi "Savdo eslatmalari" kartasi uchun)
    telegramReminders: [
        {
            time:  { type: String, required: true },  // "HH:MM"
            title: { type: String, required: true },
            freq:  { type: String, default: 'Har kuni' },
            active: { type: Boolean, default: true },
            lastSentDate: { type: String, default: null }, // "YYYY-MM-DD" — dublikatni oldini olish
        },
    ],

}, {
    timestamps: true
});

const User = mongoose.model('User', UserSchema);

// Enum'larni tashqariga ham beramiz (validate.js va frontend shakllari uchun)
User.ENUMS = { TRADING_STYLES, STRATEGIES, MARKETS, EXPERIENCE, CODE_PURPOSES };

module.exports = User;
