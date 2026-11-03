// ==========================================================================
// 5B-BOSQICH TESTLARI
//
//   B4/B5  ko'rinish + til        -> PUT  /api/auth/preferences
//   B6     emailni o'zgartirish   -> POST /api/auth/email/request + /confirm
//   B7     CSV yuklab olish       -> GET  /api/trades/export.csv
//   B8     akkauntni o'chirish    -> DEL  /api/auth/account
//   C      kun/tun mavzusi        -> statik fayllar (CSS/HTML) tekshiruvi
//   D      brend nomi             -> barcha <title>
//
//   cd Backend && npm test
//
// Baza bilan ishlaydigan testlar .env dagi MONGO_URI ni ishlatadi va
// o'zi yaratgan vaqtinchalik foydalanuvchilarni oxirida o'chiradi.
// Baza ulanmasa ular SKIP bo'ladi — CI'da sirsiz holatda ham `npm test`
// yiqilmaydi.
//
// ❗ HTTP testlari o'z express ilovasini TASODIFIY portda ko'taradi
//    (`listen(0)`). Shu sababli ishlab chiqish serveri (5000) bilan
//    to'qnashmaydi va test paytida uni to'xtatish kerak emas.
// ==========================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { generateToken } = require('../utils/jwt');
const csv = require('../utils/csv');

const TAG = `tst5b-${crypto.randomBytes(4).toString('hex')}`;
const email = n => `${TAG}-${n}@test.invalid`;

let User, Trade, app, base;
let dbReady = false;
let server;
const created = [];

// ==========================================================================
// TAYYORGARLIK
// ==========================================================================

test.before(async () => {
    // Statik tekshiruvlar bazaga bog'liq emas — ilovani har holda ko'taramiz
    User = require('../models/user');
    Trade = require('../models/trade');

    app = express();
    app.use(express.json({ limit: '100kb' }));
    app.use('/api/auth', require('../routes/authRoutes'));
    app.use('/api/trades', require('../routes/tradeRoutes'));

    await new Promise(res => { server = app.listen(0, res); });
    base = `http://127.0.0.1:${server.address().port}`;

    if (!process.env.MONGO_URI) {
        console.log("⚠️  MONGO_URI yo'q — bazaga bog'liq testlar skip");
        return;
    }
    try {
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
        dbReady = true;
    } catch (err) {
        console.log(`⚠️  Bazaga ulanmadi (${err.message}) — bazaga bog'liq testlar skip`);
    }
});

test.after(async () => {
    if (server) await new Promise(res => server.close(res));
    if (!dbReady) return;
    for (const id of created) {
        await Trade.deleteMany({ userId: id }).catch(() => {});
        await User.findByIdAndDelete(id).catch(() => {});
    }
    await User.deleteMany({ email: new RegExp(`^${TAG}-`) }).catch(() => {});
    await mongoose.disconnect();
});

/** Test foydalanuvchisi yaratadi va uning access tokenini qaytaradi */
async function makeUser(name, extra = {}) {
    const user = await User.create({
        username: `${TAG}-${name}`,
        email: email(name),
        password: await bcrypt.hash('TestParol123', 10),
        provider: 'local',
        isVerified: true,
        isOnboarded: true,
        ...extra,
    });
    created.push(user._id);
    return { user, token: generateToken(user._id) };
}

/**
 * Yangi express ilovasi — rate limiter buketlari TOZA holatda.
 *
 * ❗ Nega kerak: limiterlar `rateLimit()` chaqirilganda, ya'ni modul
 *    YUKLANGANDA yaratiladi va hisoblagichni modul ichida saqlaydi.
 *    Akkauntni o'chirish limiti — soatda 3 ta urinish, barcha testlar esa
 *    bitta IP (127.0.0.1) dan keladi. Shu sababli to'rtinchi test 429
 *    olardi. require keshini tozalab modulni qaytadan yuklaymiz —
 *    hisoblagich nolga tushadi.
 */
async function freshApp() {
    for (const m of ['../routes/authRoutes', '../routes/tradeRoutes']) {
        delete require.cache[require.resolve(m)];
    }
    const a = express();
    a.use(express.json({ limit: '100kb' }));
    a.use('/api/auth', require('../routes/authRoutes'));
    a.use('/api/trades', require('../routes/tradeRoutes'));

    const srv = await new Promise(res => { const s2 = a.listen(0, () => res(s2)); });
    const url = `http://127.0.0.1:${srv.address().port}`;
    return { url, close: () => new Promise(res => srv.close(res)) };
}

/** JSON so'rov yuboradi, { status, body } qaytaradi */
async function call(method, pathname, { token, body, host } = {}) {
    const res = await fetch(`${host || base}${pathname}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let parsed = null;
    const text = await res.text();
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: res.status, body: parsed, res };
}

// ==========================================================================
// 1. CSV YORDAMCHISI (bazaga bog'liq emas)
// ==========================================================================

test('B7: CSV UTF-8 BOM bilan boshlanadi', () => {
    const out = csv.tradesToCsv([]);
    assert.equal(out.charCodeAt(0), 0xFEFF, 'BOM yo\'q — Excel o\'zbekcha matnni buzadi');
});

test('B7: CSV sarlavha qatori va ustun tartibi', () => {
    const out = csv.tradesToCsv([]);
    const header = out.slice(1).split('\r\n')[0];
    assert.equal(header, csv.TRADE_COLUMNS.join(','));
    assert.match(header, /^Sana,Vaqt,Juftlik/);
});

test('B7: vergul, qo\'shtirnoq va yangi qator ekranlanadi', () => {
    assert.equal(csv.cell('a,b'), '"a,b"');
    assert.equal(csv.cell('he said "hi"'), '"he said ""hi"""');
    assert.equal(csv.cell('bir\nikki'), '"bir\nikki"');
    assert.equal(csv.cell('oddiy'), 'oddiy');
    assert.equal(csv.cell(null), '');
    assert.equal(csv.cell(undefined), '');
});

test('B7: Excel formula injection to\'siladi', () => {
    // =, +, -, @ bilan boshlangan katak Excel'da FORMULA bo'lib bajariladi.
    // Apostrof qo'yilsa ko'rinishi o'zgarmaydi, lekin formula bo'lmaydi.
    for (const bad of ['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)', '\tx', '\rx']) {
        const out = csv.cell(bad);
        assert.ok(out.startsWith("'") || out.startsWith('"\''),
            `${JSON.stringify(bad)} himoyalanmagan: ${JSON.stringify(out)}`);
    }
});

test('B7: savdo qatori barcha ustunlarni to\'ldiradi', () => {
    const out = csv.tradesToCsv([{
        date: '2026-10-01', time: '09:30', pair: 'EURUSD', trend: 'Long', type: 'BUY',
        session: 'LONDON', strategy: 'SMC/ICT', pnl: 120.5, rr: 2, entryPrice: 1.1,
        size: 0.1, psychology_before: 'Tinch', mistake: '', notes: 'izoh',
    }]);
    const rows = out.slice(1).split('\r\n');
    assert.equal(rows.length, 2);
    assert.equal(rows[1].split(',').length, csv.TRADE_COLUMNS.length);
    assert.match(rows[1], /EURUSD/);
});

test('B7: fayl nomi sanani o\'z ichiga oladi', () => {
    assert.equal(csv.csvFileName(new Date('2026-11-02T10:00:00Z')),
        'trading-jurnal-2026-11-02.csv');
});

// ==========================================================================
// 2. SOZLAMALAR — PUT /api/auth/preferences
// ==========================================================================

test('B4/B5: mavzu va til saqlanadi', async (t) => {
    if (!dbReady) return t.skip('baza yo\'q');
    const { user, token } = await makeUser('pref');

    // Standart qiymatlar
    assert.equal(user.theme, 'system');
    assert.equal(user.language, 'uz');

    const r1 = await call('PUT', '/api/auth/preferences', { token, body: { theme: 'dark' } });
    assert.equal(r1.status, 200);
    assert.equal(r1.body.theme, 'dark');

    const r2 = await call('PUT', '/api/auth/preferences', { token, body: { language: 'ru' } });
    assert.equal(r2.status, 200);
    assert.equal(r2.body.language, 'ru');
    // Til o'zgarishi mavzuni o'chirib tashlamasligi kerak
    assert.equal(r2.body.theme, 'dark');

    const fresh = await User.findById(user._id);
    assert.equal(fresh.theme, 'dark');
    assert.equal(fresh.language, 'ru');
});

test('B4/B5: yaroqsiz qiymat 400 qaytaradi', async (t) => {
    if (!dbReady) return t.skip('baza yo\'q');
    const { token } = await makeUser('pref-bad');

    for (const body of [{ theme: 'neon' }, { language: 'de' }, { theme: 123 }]) {
        const r = await call('PUT', '/api/auth/preferences', { token, body });
        assert.equal(r.status, 400, `${JSON.stringify(body)} uchun 400 kutilgan`);
    }

    // Bo'sh so'rov ham 400 — bazaga behuda tegmaydi
    const empty = await call('PUT', '/api/auth/preferences', { token, body: {} });
    assert.equal(empty.status, 400);
});

test('B4/B5: token bo\'lmasa 401', async () => {
    const r = await call('PUT', '/api/auth/preferences', { body: { theme: 'dark' } });
    assert.equal(r.status, 401);
});

test('C10: profil javobida theme va language bor', async (t) => {
    if (!dbReady) return t.skip('baza yo\'q');
    const { token } = await makeUser('pub', { theme: 'light', language: 'en' });
    const r = await call('GET', '/api/auth/profile', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.theme, 'light');
    assert.equal(r.body.language, 'en');
    // Parol hech qachon javobga tushmaydi
    assert.equal(r.body.password, undefined);
    assert.equal(r.body.hasPassword, true);
});

// ==========================================================================
// 3. EMAILNI O'ZGARTIRISH
// ==========================================================================

test('B6: email ikki qadamda o\'zgaradi (kod tasdiqlangandan keyin)', async (t) => {
    if (!dbReady) return t.skip('baza yo\'q');
    const { user, token } = await makeUser('em');
    const target = email('em-new');

    const req = await call('POST', '/api/auth/email/request', { token, body: { newEmail: target } });
    assert.equal(req.status, 200);
    assert.equal(req.body.email, target);

    // ❗ Email HOZIR almashmagan bo'lishi kerak — aks holda mavjud bo'lmagan
    //    manzil kiritgan foydalanuvchi hisobidan butunlay ayrilib qolardi.
    let mid = await User.findById(user._id);
    assert.equal(mid.email, user.email, 'email kod tasdiqlanmasdan almashdi');
    assert.equal(mid.authCode.pendingEmail, target);

    // Noto'g'ri kod o'tmaydi
    const bad = await call('POST', '/api/auth/email/confirm', { token, body: { code: '000000' } });
    assert.equal(bad.status, 400);
    mid = await User.findById(user._id);
    assert.equal(mid.email, user.email);
    assert.equal(mid.authCode.attempts, 1, 'xato urinish hisoblanmadi');

    // To'g'ri kod bilan almashadi. Kod bazada faqat hash bo'lib turadi,
    // shuning uchun testda yangi kod o'rnatamiz.
    const code = '123456';
    mid.authCode.codeHash = await bcrypt.hash(code, 10);
    mid.authCode.attempts = 0;
    await mid.save();

    const ok = await call('POST', '/api/auth/email/confirm', { token, body: { code } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.email, target);

    const after = await User.findById(user._id);
    assert.equal(after.email, target);
    assert.equal(after.isVerified, true);
    assert.equal(after.authCode.pendingEmail, null, 'kod tozalanmadi');
});

test('B6: Google hisobida email o\'zgartirilmaydi', async (t) => {
    if (!dbReady) return t.skip('baza yo\'q');
    const { token } = await makeUser('em-goog', {
        provider: 'google',
        googleId: `g-${TAG}`,
        password: null,
    });
    const r = await call('POST', '/api/auth/email/request',
        { token, body: { newEmail: email('em-goog-new') } });
    assert.equal(r.status, 400);
    assert.match(r.body.message, /Google/);
});

test('B6: band email va o\'z emaili rad etiladi', async (t) => {
    if (!dbReady) return t.skip('baza yo\'q');
    const { user, token } = await makeUser('em-dup');
    const other = await makeUser('em-other');

    const same = await call('POST', '/api/auth/email/request', { token, body: { newEmail: user.email } });
    assert.equal(same.status, 400);

    const taken = await call('POST', '/api/auth/email/request', { token, body: { newEmail: other.user.email } });
    assert.equal(taken.status, 400);
    assert.match(taken.body.message, /band/i);

    const bad = await call('POST', '/api/auth/email/request', { token, body: { newEmail: 'nomail' } });
    assert.equal(bad.status, 400);
});

test('B6: so\'rov bo\'lmasa confirm 400 qaytaradi', async (t) => {
    if (!dbReady) return t.skip('baza yo\'q');
    const { token } = await makeUser('em-noreq');
    const r = await call('POST', '/api/auth/email/confirm', { token, body: { code: '123456' } });
    assert.equal(r.status, 400);
});

// ==========================================================================
// 4. CSV ENDPOINTI
// ==========================================================================

test('B7: GET /trades/export.csv token talab qiladi', async () => {
    const r = await call('GET', '/api/trades/export.csv');
    assert.equal(r.status, 401);
});

test('B7: CSV faqat o\'z savdolarini qaytaradi', async (t) => {
    if (!dbReady) return t.skip('baza yo\'q');
    const mine = await makeUser('csv-mine');
    const other = await makeUser('csv-other');

    await Trade.create({
        userId: mine.user._id, date: '2026-10-01', time: '09:30',
        pair: 'EURUSD', trend: 'Long', type: 'BUY', pnl: 10, rr: 1,
    });
    await Trade.create({
        userId: other.user._id, date: '2026-10-02', time: '10:30',
        pair: 'GBPUSD', trend: 'Short', type: 'SELL', pnl: -5, rr: 0,
    });

    const res = await fetch(`${base}/api/trades/export.csv`, {
        headers: { Authorization: `Bearer ${mine.token}` },
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/csv/);
    assert.match(res.headers.get('content-type'), /charset=utf-8/);
    assert.match(res.headers.get('content-disposition'), /attachment; filename="trading-jurnal-\d{4}-\d{2}-\d{2}\.csv"/);

    // ❗ `res.text()` UTF-8 dekoderidan o'tadi va boshidagi BOM ni
    //    SPETSIFIKATSIYA BO'YICHA olib tashlaydi. Shu sababli BOM ni
    //    bayt darajasida tekshiramiz — aks holda test "BOM yo'q" deb
    //    yolg'on ogohlantirardi.
    const buf = Buffer.from(await res.arrayBuffer());
    assert.deepEqual([...buf.subarray(0, 3)], [0xEF, 0xBB, 0xBF],
        'javob UTF-8 BOM bilan boshlanmadi');

    const text = buf.toString('utf8');
    assert.match(text, /EURUSD/);
    assert.doesNotMatch(text, /GBPUSD/, 'boshqa foydalanuvchining savdosi chiqdi');
});

// ==========================================================================
// 5. AKKAUNTNI O'CHIRISH
// ==========================================================================

test('B8: token bo\'lmasa o\'chirilmaydi', async () => {
    const r = await call('DELETE', '/api/auth/account', { body: { email: 'a@b.cd' } });
    assert.equal(r.status, 401);
});

test('B8: email mos kelmasa o\'chirilmaydi', async (t) => {
    if (!dbReady) return t.skip('baza yo\'q');
    const { user, token } = await makeUser('del-bad');

    const r = await call('DELETE', '/api/auth/account',
        { token, body: { email: email('butunlay-boshqa') } });
    assert.equal(r.status, 400);
    assert.match(r.body.message, /mos kelmadi/i);

    assert.ok(await User.findById(user._id), 'foydalanuvchi o\'chib ketdi');

    // Email umuman yuborilmasa ham 400
    const empty = await call('DELETE', '/api/auth/account', { token, body: {} });
    assert.equal(empty.status, 400);
    assert.ok(await User.findById(user._id));
});

test('B8: email mos kelsa foydalanuvchi va SAVDOLARI o\'chadi', async (t) => {
    if (!dbReady) return t.skip('baza yo\'q');
    const fresh = await freshApp();
    t.after(() => fresh.close());

    const { user, token } = await makeUser('del-ok', {
        telegramChatId: '123456',
        telegramReminders: [{ time: '22:00', title: 'Test eslatma' }],
    });

    await Trade.insertMany([
        { userId: user._id, date: '2026-10-01', time: '09:30', pair: 'EURUSD', trend: 'Long', type: 'BUY', pnl: 10, rr: 1 },
        { userId: user._id, date: '2026-10-02', time: '11:30', pair: 'XAUUSD', trend: 'Short', type: 'SELL', pnl: -4, rr: 0 },
    ]);
    assert.equal(await Trade.countDocuments({ userId: user._id }), 2);

    const r = await call('DELETE', '/api/auth/account',
        { token, body: { email: user.email }, host: fresh.url });
    assert.equal(r.status, 200);
    assert.equal(r.body.deletedTrades, 2);

    assert.equal(await User.findById(user._id), null, 'foydalanuvchi o\'chmadi');
    assert.equal(await Trade.countDocuments({ userId: user._id }), 0, 'savdolar qoldi');

    // Token endi hech narsaga yaramaydi
    const after = await call('GET', '/api/auth/profile', { token, host: fresh.url });
    assert.equal(after.status, 401);
});

test('B8: email katta/kichik harfdan qat\'i nazar mos keladi', async (t) => {
    if (!dbReady) return t.skip('baza yo\'q');
    const fresh = await freshApp();
    t.after(() => fresh.close());

    const { user, token } = await makeUser('del-case');
    const r = await call('DELETE', '/api/auth/account',
        { token, body: { email: user.email.toUpperCase() }, host: fresh.url });
    assert.equal(r.status, 200);
    assert.equal(await User.findById(user._id), null);
});

test('B8: o\'chirish endpointi rate limitli (soatda 3 ta urinish)', async (t) => {
    if (!dbReady) return t.skip('baza yo\'q');
    const fresh = await freshApp();
    t.after(() => fresh.close());

    const { user, token } = await makeUser('del-rate');

    // Uchta MUVAFFAQIYATSIZ urinish (email mos emas) — hammasi 400
    for (let i = 0; i < 3; i++) {
        const r = await call('DELETE', '/api/auth/account',
            { token, body: { email: email('boshqa') }, host: fresh.url });
        assert.equal(r.status, 400, `${i + 1}-urinish 400 bo'lishi kerak`);
    }

    // To'rtinchisi — TO'G'RI email bilan ham o'tmaydi: limit tugadi.
    // Shu sababli o'g'irlangan token bilan emailni taxmin qilib ketma-ket
    // urinib bo'lmaydi.
    const blocked = await call('DELETE', '/api/auth/account',
        { token, body: { email: user.email }, host: fresh.url });
    assert.equal(blocked.status, 429);
    assert.ok(await User.findById(user._id), 'limitga qaramay o\'chib ketdi');
});

// ==========================================================================
// 6. PAROLNI UNUTDIM — Google hisobi uchun ham ishlashi kerak
// ==========================================================================

test('B6: Google hisobiga ham tiklash kodi beriladi (parol o\'rnatish uchun)', async (t) => {
    if (!dbReady) return t.skip('baza yo\'q');
    const { user } = await makeUser('fp-goog', {
        provider: 'google',
        googleId: `g2-${TAG}`,
        password: null,
    });

    const r = await call('POST', '/api/auth/forgot-password', { body: { email: user.email } });
    assert.equal(r.status, 200);

    // ❗ Avval Google hisobi o'tkazib yuborilardi va kod YOZILMASDI —
    //    natijada Google foydalanuvchisi hech qachon parol o'rnata olmasdi.
    const fresh = await User.findById(user._id);
    assert.ok(fresh.authCode?.codeHash, 'Google hisobiga kod berilmadi');
    assert.equal(fresh.authCode.purpose, 'reset_password');
});

// ==========================================================================
// 7. STATIK FAYLLAR — MAVZU VA BREND (bazaga bog'liq emas)
// ==========================================================================

const FRONT = path.join(__dirname, '..', '..', 'Frontend');
const PAGES = [
    'index.html', 'login.html', 'register.html', 'verify.html',
    'reset-password.html', 'profile-setup.html', 'dashboard.html',
    'terms.html', 'privacy.html',
];
const readPage = p => fs.readFileSync(path.join(FRONT, p), 'utf8');

test('C9: theme.css barcha 9 sahifada va BOSHQA CSS fayllardan OLDIN', () => {
    PAGES.forEach(p => {
        const html = readPage(p);
        const theme = html.indexOf('css/theme.css');
        assert.ok(theme > -1, `${p}: theme.css ulanmagan`);

        // Boshqa css fayllar keyin kelishi shart — ular theme.css
        // tokenlariga tayanadi
        for (const other of ['css/main.css', 'css/forms.css', 'css/media.css',
                             'css/dashboard-advanced.css', 'css/profile-settings.css']) {
            const i = html.indexOf(other);
            if (i > -1) assert.ok(theme < i, `${p}: theme.css ${other} dan keyin turibdi`);
        }
    });
});

test('C11: oq chaqnashga qarshi inline skript <head> da, CSS\'dan oldin', () => {
    PAGES.forEach(p => {
        const html = readPage(p);
        const script = html.indexOf("r.setAttribute('data-theme'");
        assert.ok(script > -1, `${p}: inline mavzu skripti yo'q`);

        const headEnd = html.indexOf('</head>');
        assert.ok(script < headEnd, `${p}: skript <head> dan tashqarida`);

        const firstCss = html.indexOf('<link rel="stylesheet"');
        assert.ok(script < firstCss,
            `${p}: skript CSS'dan KEYIN — tun rejimida sahifa oq chaqnaydi`);

        // localStorage o'qilmasa (private rejim) ham sahifa ishlashi kerak
        assert.match(html, /catch \(e\)/, `${p}: try/catch yo'q`);
    });
});

test('C12: logolar data-logo bilan belgilangan (tunda logo-dark.svg)', () => {
    PAGES.forEach(p => {
        const html = readPage(p);
        assert.match(html, /<img src="brand\/logo-light\.svg" data-logo/,
            `${p}: logo data-logo bilan belgilanmagan`);
    });
    assert.ok(fs.existsSync(path.join(FRONT, 'brand', 'logo-dark.svg')),
        'brand/logo-dark.svg topilmadi');
});

test('C9: theme.css da light va dark to\'plamlari to\'liq', () => {
    const css = fs.readFileSync(path.join(FRONT, 'css', 'theme.css'), 'utf8');

    const block = (sel) => {
        const i = css.indexOf(sel);
        assert.ok(i > -1, `${sel} topilmadi`);
        return css.slice(i, css.indexOf('}', i));
    };
    const light = block(':root {');
    const dark = block('html[data-theme="dark"] {');

    const names = s => new Set((s.match(/--[a-z0-9-]+(?=\s*:)/g) || []));
    const lightNames = names(light);
    const darkNames = names(dark);

    // Tunda qayta aniqlanmagan RANG tokeni qolib ketmasin — aks holda
    // to'q fonda och rang (yoki teskarisi) chiqadi.
    const SHARED = new Set([
        '--sidebar-width', '--radius-sm', '--radius-md', '--radius-lg',
        '--transition', '--on-brand', '--brand-btn-bg', '--brand-btn-hover',
        '--btn-green-bg', '--btn-green-hover', '--btn-purple-bg',
        '--btn-purple-hover', '--btn-danger-bg', '--btn-danger-hover',
    ]);
    const missing = [...lightNames].filter(n => !darkNames.has(n) && !SHARED.has(n));
    assert.deepEqual(missing, [], `tun rejimida aniqlanmagan tokenlar: ${missing}`);

    // Teskarisi ham: tunda bor, kunda yo'q token bo'lmasin
    const extra = [...darkNames].filter(n => !lightNames.has(n));
    assert.deepEqual(extra, [], `kun rejimida aniqlanmagan tokenlar: ${extra}`);
});

test('C9: CSS fayllarda qattiq yozilgan rang qolmagan', () => {
    // theme.css — yagona manba. Qolgan fayllarda hex rang faqat
    // var() fallback'i (`var(--x, #fff)`) yoki hover soyasi bo'lishi mumkin.
    const ALLOWED = /var\([^)]*#|calc-btn-(green|purple):hover|#2aabee|#229ed9|#7c3aed/;
    for (const f of ['main.css', 'forms.css', 'profile-settings.css']) {
        const raw = fs.readFileSync(path.join(FRONT, 'css', f), 'utf8');
        // Izohlar ichidagi ranglar (masalan "och mavzu, #2563eb") hisobga
        // olinmasin — qator boshiga qarash yetarli emas, blok izoh bir
        // necha qatorga cho'ziladi. Qator raqamlari saqlanishi uchun
        // izohlar bo'sh joyga almashtiriladi.
        const css = raw.replace(/\/\*[\s\S]*?\*\//g,
            m => m.replace(/[^\n]/g, ' '));
        css.split('\n').forEach((line, i) => {
            const m = line.match(/#[0-9a-fA-F]{3,8}\b/);
            if (m && !ALLOWED.test(line)) {
                assert.fail(`${f}:${i + 1} qattiq yozilgan rang ${m[0]} — var(--...) ishlatilsin\n  ${line.trim()}`);
            }
        });
    }
});

test('C14: dashboard sidebar\'da mavzu almashtirish tugmasi bor', () => {
    const html = readPage('dashboard.html');
    assert.match(html, /class="theme-toggle" data-theme-toggle/, 'tugma yo\'q');
    assert.match(html, /data-lucide="sun" class="icon-light"/, 'quyosh ikonkasi yo\'q');
    assert.match(html, /data-lucide="moon" class="icon-dark"/, 'oy ikonkasi yo\'q');
    assert.match(html, /\[data-theme-label\]|data-theme-label/, 'matn joyi yo\'q');
});

test('A1: sidebar va mobil menyu Profil bo\'limiga olib boradi', () => {
    const html = readPage('dashboard.html');
    assert.match(html, /data-target="sec-profil"/, 'sidebar menyusida Profil yo\'q');
    assert.match(html, /id="sec-profil"/, 'sec-profil bo\'limi yo\'q');
    assert.match(html, /data-account-action="profil"/, 'mobil menyuda Profil yo\'q');

    const js = fs.readFileSync(path.join(FRONT, 'js', 'dashboard.js'), 'utf8');
    assert.match(js, /openSection\('sec-profil'\)/, 'user-info tugmasi Profilga ulanmagan');
    assert.match(js, /action === 'profil' \? 'sec-profil'/, 'mobil "Men" menyusi ulanmagan');
});

test('B: Sozlamalar beshta bo\'limga ajratilgan', () => {
    const html = readPage('dashboard.html');
    const sec = html.slice(html.indexOf('id="sec-sozlamalar"'), html.indexOf('</main>'));

    assert.match(sec, /data-theme-choice="light"/);
    assert.match(sec, /data-theme-choice="dark"/);
    assert.match(sec, /data-theme-choice="system"/);
    ['uz', 'ru', 'en'].forEach(l =>
        assert.match(sec, new RegExp(`data-lang-choice="${l}"`), `til ${l} yo'q`));

    assert.match(sec, /id="em-open-btn"/, 'emailni o\'zgartirish tugmasi yo\'q');
    assert.match(sec, /id="csv-btn"/, 'CSV tugmasi yo\'q');
    assert.match(sec, /id="del-open-btn"/, 'o\'chirish tugmasi yo\'q');
    assert.match(sec, /danger-zone/, 'xavfli zona yo\'q');

    // Profil formasi Sozlamalardan KETDI — endi Profil bo'limida
    assert.doesNotMatch(sec, /id="profile-sections"/,
        'profil formasi hali Sozlamalarda');
    assert.match(html.slice(html.indexOf('id="sec-profil"'), html.indexOf('id="sec-sozlamalar"')),
        /id="profile-sections"/, 'profil formasi Profil bo\'limida yo\'q');
});

test('D15: barcha tab sarlavhalarida brend nomi bir xil', () => {
    PAGES.forEach(p => {
        const m = readPage(p).match(/<title>([^<]*)<\/title>/);
        assert.ok(m, `${p}: <title> yo'q`);
        const title = m[1];
        assert.match(title, /^Trading Jurnal —/, `${p}: sarlavha "${title}"`);
        // Eski nomlar qolmasin
        assert.doesNotMatch(title, /TradeJournal/, `${p}: "TradeJournal" qolgan`);
        assert.doesNotMatch(title, /Trading Jurnali/, `${p}: "Trading Jurnali" qolgan`);
    });
});

test('5C tayyorgarligi: yangi matnlar strings.js da to\'plangan', () => {
    const src = fs.readFileSync(path.join(FRONT, 'js', 'strings.js'), 'utf8');
    // Har bir yangi modul matnni shu yerdan oladi
    ['profile-view.js', 'settings.js'].forEach(f => {
        const js = fs.readFileSync(path.join(FRONT, 'js', f), 'utf8');
        assert.match(js, /from '\.\/strings\.js'/, `${f}: strings.js import qilinmagan`);
    });
    // Asosiy kalitlar mavjud
    ['profile.statWinrate', 'theme.system', 'lang.pending',
     'data.exportTitle', 'danger.deleteTitle', 'account.emailChange']
        .forEach(k => assert.ok(src.includes(`'${k}'`), `kalit yo'q: ${k}`));
});
