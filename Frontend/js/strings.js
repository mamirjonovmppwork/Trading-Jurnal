// ==========================================================================
// 5B-BOSQICHDA QO'SHILGAN MATNLAR — BITTA MANBA
//
// Nega shu fayl bor: 5C-bosqichda uch til (uz / ru / en) qo'shiladi.
// Agar matnlar HTML va JS bo'ylab sochilib ketsa, tarjima paytida
// hammasini qidirib yurish kerak bo'ladi va bir qismi albatta qolib
// ketadi. Shu sababli 5B'da QO'SHILGAN barcha yangi matn shu yerda.
//
// ❗ ESKI matnlarga TEGILMAYDI — ular 5C'da bitta o'tishda ko'chiriladi.
//
// 5C rejasi: `S` ni `t('kalit')` funksiyasiga almashtirish va shu
// obyektning ru/en nusxalarini yozish. Shuning uchun kalitlar tekis
// (flat) va mantiqiy prefiksli: `profile.*`, `settings.*`, `theme.*`...
// ==========================================================================

export const S = {
    // ------------------------------------------------------------- UMUMIY
    'common.save': "Saqlash",
    'common.cancel': "Bekor qilish",
    'common.saving': "Saqlanmoqda...",
    'common.edit': "Tahrirlash",
    'common.add': "Qo'shish",
    'common.empty': "To'ldirilmagan",
    'common.loading': "Yuklanmoqda...",
    'common.soon': "Tez orada",
    'common.close': "Yopish",
    'common.confirm': "Tasdiqlash",
    'common.copied': "Nusxalandi",

    // -------------------------------------------------------------- PROFIL
    'profile.nav': "Profil",
    'profile.title': "Profil",
    'profile.subtitle': "Hisobingiz va treyding ma'lumotlaringiz",
    'profile.memberSince': "A'zo bo'lgan",
    'profile.loginMethod': "Kirish usuli",
    'profile.loginGoogle': "Google",
    'profile.loginEmail': "Email va parol",
    'profile.experience': "Tajriba",
    'profile.tradingStyles': "Savdo uslubi",
    'profile.strategies': "Strategiya",
    'profile.markets': "Bozorlar",
    'profile.personal': "Shaxsiy ma'lumotlar",
    'profile.trading': "Treyding profili",
    'profile.fullName': "Ism familiya",
    'profile.age': "Yosh",
    'profile.phone': "Telefon",
    'profile.deposit': "Boshlang'ich depozit",
    'profile.editTitle': "Profilni tahrirlash",
    'profile.saved': "Profil muvaffaqiyatli saqlandi",
    'profile.loadError': "Profilni yuklashda xatolik",
    'profile.noUsername': "Foydalanuvchi nomi yo'q",
    'profile.ageYears': "yosh",

    // Statistika kartalari
    'profile.statTrades': "Jami savdolar",
    'profile.statWinrate': "Winrate",
    'profile.statPnl': "Umumiy P&L",
    'profile.statBestPair': "Eng yaxshi juftlik",
    'profile.statStreak': "Eng uzun yutuq seriyasi",
    'profile.statStreakUnit': "savdo",
    'profile.statsEmpty': "Statistika uchun hali savdo yo'q",
    'profile.statsError': "Statistikani yuklashda xatolik",

    // ----------------------------------------------------------- SOZLAMALAR
    'settings.title': "Sozlamalar",
    'settings.subtitle': "Ko'rinish, til, akkaunt va ma'lumotlar",

    // Ko'rinish
    'theme.section': "Ko'rinish",
    'theme.hint': "Interfeys rangi. \"Tizim bo'yicha\" — qurilmangiz sozlamasiga ergashadi.",
    'theme.light': "Kun",
    'theme.dark': "Tun",
    'theme.system': "Tizim bo'yicha",
    'theme.lightHint': "Doim yorug'",
    'theme.darkHint': "Doim to'q",
    'theme.systemHint': "Qurilmaga qarab",

    // Til
    'lang.section': "Til",
    'lang.hint': "Tanlov saqlanadi. Interfeys tarjimasi keyingi bosqichda qo'shiladi.",
    'lang.uz': "O'zbekcha",
    'lang.ru': "Русский",
    'lang.en': "English",
    'lang.pending': "Interfeys tarjimasi tez orada qo'shiladi",
    'lang.saved': "Til tanlovi saqlandi",

    // Akkaunt
    'account.section': "Akkaunt",
    'account.emailLabel': "Email manzil",
    'account.emailChange': "Emailni o'zgartirish",
    'account.emailNew': "Yangi email",
    'account.emailCodeSent': "Yangi emailga 6 xonali kod yuborildi",
    'account.emailCodeLabel': "Emailga kelgan kod",
    'account.emailChanged': "Email muvaffaqiyatli o'zgartirildi",
    'account.emailGoogleNote':
        "Bu hisob Google orqali ochilgan — email Google hisobiga bog'langan va bu yerdan o'zgartirilmaydi.",
    'account.passwordSection': "Parol",
    'account.passwordChange': "Parolni o'zgartirish",
    'account.passwordSet': "Parol o'rnatish",
    'account.passwordNone':
        "Bu hisobda parol o'rnatilmagan (Google orqali ochilgan). Parol o'rnatsangiz, "
        + "Google'dan tashqari email va parol bilan ham kira olasiz.",
    'account.passwordSetHint':
        "Parol o'rnatish uchun emailingizga kod yuboriladi — \"Parol o'rnatish\" tugmasini bosing.",

    // Ma'lumotlar
    'data.section': "Ma'lumotlar",
    'data.exportTitle': "Savdolarimni yuklab olish (CSV)",
    'data.exportHint':
        "Barcha savdolaringiz CSV faylida. Excel va Google Sheets'da to'g'ri ochilishi uchun UTF-8 BOM bilan.",
    'data.exportBtn': "CSV yuklab olish",
    'data.exportEmpty': "Yuklab olish uchun savdo yo'q",
    'data.exportError': "Faylni tayyorlashda xatolik",

    // Xavfli zona
    'danger.section': "Xavfli zona",
    'danger.deleteTitle': "Akkauntni o'chirish",
    'danger.deleteHint':
        "Hisobingiz, barcha savdolaringiz va Telegram bog'lanishi butunlay o'chadi. "
        + "Bu amalni qaytarib bo'lmaydi.",
    'danger.deleteBtn': "Akkauntni o'chirish",
    'danger.deleteConfirmLabel': "Tasdiqlash uchun emailingizni yozing",
    'danger.deleteConfirmHint': "Aynan shu manzilni yozing:",
    'danger.deleteMismatch': "Kiritilgan email hisobingiz emailiga mos kelmadi",
    'danger.deleting': "O'chirilmoqda...",
    'danger.deleted': "Akkaunt o'chirildi. Xayr!",
};

/**
 * Matnni kalit bo'yicha oladi.
 * 5C'da shu funksiya tilni hisobga oladigan qilib almashtiriladi —
 * chaqiruvchi joylarni o'zgartirish kerak bo'lmaydi.
 */
export function t(key) {
    return S[key] ?? key;
}
