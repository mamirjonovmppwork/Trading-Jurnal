// ==========================================================================
// TO'G'RILIK TESTLARI — 5A-bosqich (C7, C8)
//
//   cd Backend && npm test
// ==========================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildDailyReportText } = require('../scheduler/telegramScheduler');

const DATE = '2026-11-02';
const user = (includes) => ({ telegramSettings: { reportIncludes: includes } });
const trade = (pnl, rr = 1) => ({ date: DATE, pnl, rr });

// ==========================================================================
// C8 — Winrate = yutuq / (yutuq + yutqazish); BE maxrajga kirmaydi
// ==========================================================================

test('C8: 3 WIN / 2 LOSS / 1 BE → 60% (3/5), 50% emas (3/6)', () => {
    const trades = [
        trade(250), trade(480), trade(320),   // 3 WIN
        trade(-100), trade(-120),             // 2 LOSS
        trade(0),                             // 1 BE
    ];
    const text = buildDailyReportText(user(['trades', 'winrate', 'profit']), trades, DATE);

    assert.match(text, /Winrate: <b>60%<\/b>/, `kutilgan 60%, olingan matn:\n${text}`);
    assert.doesNotMatch(text, /Winrate: <b>50%<\/b>/);
});

test('C8: BE soni qavs ichida alohida ko\'rsatiladi', () => {
    const trades = [trade(100), trade(-50), trade(0), trade(0)];
    const text = buildDailyReportText(user(['winrate']), trades, DATE);
    assert.match(text, /\(1W \/ 1L \/ 2BE\)/, text);
});

test('C8: BE bo\'lmasa qavsda BE yozilmaydi', () => {
    const trades = [trade(100), trade(-50)];
    const text = buildDailyReportText(user(['winrate']), trades, DATE);
    assert.match(text, /\(1W \/ 1L\)/);
    assert.doesNotMatch(text, /BE/);
});

test('C8: faqat BE savdolar bo\'lsa 0% va nolga bo\'linish yo\'q', () => {
    const text = buildDailyReportText(user(['winrate']), [trade(0), trade(0)], DATE);
    assert.match(text, /Winrate: <b>0%<\/b>/);
    assert.doesNotMatch(text, /NaN|Infinity/);
});

test('C8: hammasi yutuq → 100%', () => {
    const text = buildDailyReportText(user(['winrate']), [trade(10), trade(20)], DATE);
    assert.match(text, /Winrate: <b>100%<\/b>/);
});

test('C8: savdo bo\'lmasa hisobot yiqilmaydi', () => {
    const text = buildDailyReportText(user(['trades', 'winrate', 'profit', 'rr']), [], DATE);
    assert.match(text, /Bugun hali savdo kiritilmagan/);
    assert.doesNotMatch(text, /NaN|Infinity/);
});

test('C8: boshqa kundagi savdolar bugungi hisobotga kirmaydi', () => {
    const trades = [
        { date: DATE, pnl: 100, rr: 1 },
        { date: '2026-11-01', pnl: -999, rr: 1 },
    ];
    const text = buildDailyReportText(user(['trades', 'profit']), trades, DATE);
    assert.match(text, /Savdolar: <b>1<\/b>/);
    assert.match(text, /Profit: <b>\+\$100\.00<\/b>/);
});

// ==========================================================================
// C7 — Savdolar savdo sanasi+vaqti bo'yicha saralanadi (createdAt emas)
// ==========================================================================

test('C7: GET /trades `date, time` bo\'yicha saralaydi, createdAt bo\'yicha emas', () => {
    const src = fs.readFileSync(
        path.join(__dirname, '..', 'routes', 'tradeRoutes.js'), 'utf8'
    );

    // Eski shakl butunlay olib tashlanganmi
    assert.doesNotMatch(
        src,
        /\.sort\(\{\s*createdAt:\s*-1\s*\}\)/,
        'faqat createdAt bo\'yicha saralash qolmasligi kerak'
    );

    assert.match(
        src,
        /\.sort\(\{\s*date:\s*-1,\s*time:\s*-1,\s*createdAt:\s*-1\s*\}\)/,
        'date → time → createdAt tartibida saralanishi kerak'
    );
});

test('C7: leksikografik tartib xronologik tartibga to\'g\'ri keladi', () => {
    // Backend saralashi `date`/`time` SATRLARIGA tayanadi. Shu taxmin
    // buzilsa (masalan sana formati o'zgarsa) tartib ham buziladi —
    // shuning uchun taxminni aniq tekshiramiz.
    const rows = [
        { date: '2026-11-02', time: '10:30' },
        { date: '2026-10-28', time: '13:00' },
        { date: '2026-11-02', time: '09:05' },
        { date: '2026-11-01', time: '23:59' },
    ];

    const satrBoyicha = [...rows].sort((a, b) =>
        (b.date + b.time).localeCompare(a.date + a.time)
    );
    const vaqtBoyicha = [...rows].sort((a, b) =>
        new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`)
    );

    assert.deepEqual(satrBoyicha, vaqtBoyicha);
    // Eng yangisi birinchi
    assert.deepEqual(satrBoyicha[0], { date: '2026-11-02', time: '10:30' });
});

// ==========================================================================
// C9 / C10 / C11 / C12 — frontend tuzatishlarining mavjudligi
// (DOM mantig'i brauzerda qo'lda sinaldi; bu yerda regressiyani ushlaymiz)
// ==========================================================================

const FRONT = path.join(__dirname, '..', '..', 'Frontend');

test('C9: chastota bir vaqtda faqat bitta joyda ko\'rinadi', () => {
    // Markup'da ikki element bor (kompyuter chipi + mobil matni), lekin
    // CSS ularni bir vaqtda ko'rsatmasligi shart — avval ikkisi ham
    // ko'rinib "Har kuni Har kuni" bo'lib chiqardi.
    const desktop = fs.readFileSync(path.join(FRONT, 'css', 'dashboard-advanced.css'), 'utf8');
    const mobile = fs.readFileSync(path.join(FRONT, 'css', 'media.css'), 'utf8');

    assert.match(
        desktop,
        /\.tg-reminder-freq-inline\s*\{\s*display:\s*none;?\s*\}/,
        'kompyuterda ichki matn yashirilishi kerak'
    );
    assert.match(
        mobile,
        /\.tg-reminder-freq\s*\{\s*display:\s*none;?\s*\}/,
        'mobil\'da chip yashirilishi kerak'
    );
    assert.match(
        mobile,
        /\.tg-reminder-freq-inline\s*\{\s*display:\s*block;?\s*\}/,
        'mobil\'da ichki matn ko\'rinishi kerak'
    );

    // Markup'da har bir variant aniq bitta
    const src = fs.readFileSync(path.join(FRONT, 'js', 'telegram-ui.js'), 'utf8');
    const row = src.slice(
        src.indexOf('function buildReminderRow'),
        src.indexOf('attachReminderRowEvents(row)')
    );
    assert.equal((row.match(/class="tg-reminder-freq"/g) || []).length, 1);
    assert.equal((row.match(/class="tg-reminder-freq-inline"/g) || []).length, 1);
});

test('C10: Telegram namunasidagi qattiq yozilgan soxta son olib tashlandi', () => {
    const html = fs.readFileSync(path.join(FRONT, 'dashboard.html'), 'utf8');
    const bubble = html.slice(
        html.indexOf('tg-bubble-stats'),
        html.indexOf('tg-bubble-footer')
    );
    assert.doesNotMatch(bubble, />\s*75%\s*</, 'winrate 75% qattiq yozilmasligi kerak');
    assert.doesNotMatch(bubble, />\s*\+\$124\.00\s*</, 'profit qattiq yozilmasligi kerak');

    const js = fs.readFileSync(path.join(FRONT, 'js', 'telegram-ui.js'), 'utf8');
    assert.match(js, /function renderReportPreview/);
    assert.match(js, /tg-preview-badge/, 'namuna belgisi boshqarilishi kerak');
});

test('C11: "Xato turi" ro\'yxati o\'zbekcha, lekin value lar o\'zgarmagan', () => {
    const html = fs.readFileSync(path.join(FRONT, 'dashboard.html'), 'utf8');
    const select = html.slice(
        html.indexOf('id="trade-mistake"'),
        html.indexOf('</select>', html.indexOf('id="trade-mistake"'))
    );

    // Bazadagi qiymatlar — O'ZGARMASLIGI SHART
    ['Revenge Trading', 'FOMO', 'Late Entry', 'Early Exit', 'Overtrading', 'No Stop Loss']
        .forEach(v => assert.match(select, new RegExp(`value="${v}"`), `value="${v}" saqlanishi kerak`));

    // Ko'rinadigan matn — o'zbekcha
    ['Qasos savdosi', 'Kech kirish', 'Erta chiqish', 'Ortiqcha savdo', "Stop Loss qo'yilmagan"]
        .forEach(t => assert.ok(select.includes(t), `"${t}" matni bo'lishi kerak`));
});

test('C12: menyu va bo\'lim sarlavhasi — ikkisi ham "Telegram Bot"', () => {
    const html = fs.readFileSync(path.join(FRONT, 'dashboard.html'), 'utf8');
    assert.doesNotMatch(html, /Telegram Assistant/, '"Telegram Assistant" qolmasligi kerak');
    assert.match(html, /<span>Telegram Bot<\/span>/, 'menyuda "Telegram Bot"');
    assert.match(html, /<h1>Telegram Bot<\/h1>/, 'sarlavhada "Telegram Bot"');
});

test('C13: chiqishda barcha foydalanuvchi kalitlari tozalanadi', () => {
    const js = fs.readFileSync(path.join(FRONT, 'js', 'dashboard.js'), 'utf8');
    assert.match(js, /function clearSession/);
    assert.match(js, /sessionStorage\.clear\(\)/);
    assert.match(js, /'username'/, 'username ham o\'chirilishi kerak');
});
