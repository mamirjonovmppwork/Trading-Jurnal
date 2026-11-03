// ==========================================================================
// CSV YASASH
//
// Sozlamalar -> Ma'lumotlar -> "Savdolarimni yuklab olish" shu yerdan
// foydalanadi.
//
// Ikkita tuzoq hisobga olingan:
//
//  1. UTF-8 BOM. Excel (Windows) BOM'siz CSV'ni ANSI deb o'qiydi va
//     o'zbekcha matn ("Xato turi", "Shoshilgan") krakozyabra bo'lib
//     chiqadi. BOM qo'shilsa Excel ham, Google Sheets ham to'g'ri ochadi.
//
//  2. CSV injection (Excel formula injection). Katak `=`, `+`, `-`, `@`,
//     TAB yoki CR bilan boshlansa, Excel uni FORMULA deb biladi.
//     Foydalanuvchi izohga `=HYPERLINK(...)` yozsa, faylni ochgan odamda
//     u bajariladi. Shuning uchun bunday kataklar oldiga apostrof
//     qo'yiladi — ko'rinishi o'zgarmaydi, lekin formula bo'lmaydi.
// ==========================================================================

/** Excel formula sifatida o'qilishi mumkin bo'lgan boshlanishlar */
const RISKY_START = /^[=+\-@\t\r]/;

/**
 * Bitta katakni CSV qoidalariga keltiradi.
 * Qo'shtirnoq ikkilantiriladi; vergul/qo'shtirnoq/yangi qator bo'lsa
 * katak qo'shtirnoq ichiga olinadi.
 */
function cell(value) {
    if (value === undefined || value === null) return '';

    let s = String(value);

    // CSV injection himoyasi
    if (RISKY_START.test(s)) s = `'${s}`;

    if (/[",\r\n]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

/**
 * Satrlar massividan CSV matnini yasaydi (BOM'siz).
 * @param {Array<Array<*>>} rows birinchi satr — sarlavhalar
 */
function buildCsv(rows) {
    // CRLF — Excel uchun eng xavfsiz qator ajratgich
    return rows.map(r => r.map(cell).join(',')).join('\r\n');
}

/** Savdolar CSV'sining ustunlari (tartibi o'zgarmasin — foydalanuvchi ko'nikadi) */
const TRADE_COLUMNS = [
    'Sana', 'Vaqt', 'Juftlik', "Yo'nalish", 'Turi', 'Sessiya',
    'Strategiya', 'P&L', 'R:R', 'Kirish narxi', 'Lot',
    'Kayfiyat', 'Xato turi', 'Izoh',
];

/** Bitta savdoni CSV satriga aylantiradi */
function tradeRow(t) {
    return [
        t.date, t.time, t.pair, t.trend, t.type, t.session,
        t.strategy, t.pnl, t.rr, t.entryPrice, t.size,
        t.psychology_before, t.mistake, t.notes,
    ];
}

/**
 * Savdolar ro'yxatidan to'liq CSV faylini qaytaradi — BOM BILAN.
 * @param {Array<object>} trades
 * @returns {string} brauzerga/faylga to'g'ridan-to'g'ri berishga tayyor matn
 */
function tradesToCsv(trades) {
    const rows = [TRADE_COLUMNS, ...(trades || []).map(tradeRow)];
    return '﻿' + buildCsv(rows);
}

/** Yuklanadigan fayl nomi: trading-jurnal-2026-11-02.csv */
function csvFileName(date = new Date()) {
    const iso = date.toISOString().slice(0, 10);
    return `trading-jurnal-${iso}.csv`;
}

module.exports = { cell, buildCsv, tradesToCsv, csvFileName, TRADE_COLUMNS };
