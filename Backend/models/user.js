const mongoose = require('mongoose');

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

    isOnboarded: {
        type: Boolean,
        default: false
    },

    initialBalance: {
        type: Number,
        default: 0
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

module.exports = mongoose.model('User', UserSchema);