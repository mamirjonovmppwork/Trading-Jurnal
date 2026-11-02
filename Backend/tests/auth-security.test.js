// ==========================================================================
// XAVFSIZLIK TESTLARI — 5A-bosqich (A1, A2, A3)
//
// Node'ning o'z test runner'i (node:test) ishlatiladi — qo'shimcha paket
// kerak emas. Ishga tushirish:
//
//   cd Backend && npm test
//
// Testlar HAQIQIY baza bilan ishlaydi (.env dagi MONGO_URI) va o'zi
// yaratgan vaqtinchalik foydalanuvchilarni oxirida o'chiradi.
// Baza ulanmasa testlar o'tkazib yuboriladi (skip), xato bermaydi —
// shunda CI'da sir bo'lmagan holatda ham `npm test` yiqilmaydi.
// ==========================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { generateToken } = require('../utils/jwt');
const { issuedBeforePasswordChange } = require('../middleware/authMiddleware');

// Test foydalanuvchilarini aniq ajratib turadigan prefiks
const TAG = `tst-${crypto.randomBytes(4).toString('hex')}`;
const email = n => `${TAG}-${n}@test.invalid`;

let User;
let dbReady = false;
const created = [];

test.before(async () => {
    if (!process.env.MONGO_URI) {
        console.log('⚠️  MONGO_URI yo\'q — bazaga bog\'liq testlar o\'tkazib yuboriladi');
        return;
    }
    try {
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
        User = require('../models/user');
        dbReady = true;
    } catch (err) {
        console.log(`⚠️  Bazaga ulanmadi (${err.message}) — bazaga bog'liq testlar skip`);
    }
});

test.after(async () => {
    if (!dbReady) return;
    if (created.length) await User.deleteMany({ _id: { $in: created } });
    await mongoose.disconnect();
});

/** Test uchun foydalanuvchi yaratadi va keyin o'chirilishini belgilaydi */
async function makeUser(name, extra = {}) {
    const u = await User.create({
        username: name,
        email: email(name),
        password: await bcrypt.hash('TestParol12345', 10),
        isVerified: true,
        isOnboarded: true,
        ...extra,
    });
    created.push(u._id);
    return u;
}

// ==========================================================================
// A2 — Parol o'zgarganda eski tokenlar bekor bo'ladi
// ==========================================================================

test('A2: issuedBeforePasswordChange — passwordChangedAt null bo\'lsa hech narsa rad etilmaydi', () => {
    const iat = Math.floor(Date.now() / 1000);
    assert.equal(issuedBeforePasswordChange({ iat }, null), false);
    assert.equal(issuedBeforePasswordChange({ iat }, undefined), false);
});

test('A2: parol o\'zgarishidan OLDIN berilgan token rad etiladi', () => {
    const now = Date.now();
    // Token 1 soat oldin berilgan, parol hozir o'zgargan
    const iat = Math.floor((now - 3600_000) / 1000);
    assert.equal(issuedBeforePasswordChange({ iat }, new Date(now)), true);
});

test('A2: parol o\'zgarishidan KEYIN berilgan token o\'tadi', () => {
    const changedAt = Date.now();
    // Token parol o'zgarganidan 2 sekund keyin berilgan
    const iat = Math.floor((changedAt + 2000) / 1000);
    assert.equal(issuedBeforePasswordChange({ iat }, new Date(changedAt)), false);
});

test('A2: aynan bir sekund ichida berilgan YANGI token rad etilmaydi (yumaloqlash tuzog\'i)', () => {
    // Eng xatarli holat: passwordChangedAt = X.999 ms, token esa X.000 sekundda
    // berilgan. iat sekundgacha pastga yumaloqlanadi, ya'ni iat*1000 < pwdAt.
    // Soddaroq `iat*1000 < pwdAt` solishtiruvi shu yerda YANGI tokenni ham
    // rad etib, foydalanuvchini o'z parolini o'zgartirgani uchun chiqarardi.
    const base = 1_700_000_000_000; // butun sekund
    const pwdAt = new Date(base + 999);
    const iat = Math.floor(base / 1000);
    assert.equal(issuedBeforePasswordChange({ iat }, pwdAt), false);
});

test('A2: iat yo\'q bo\'lsa (buzuq token) rad etilmaydi — imzo tekshiruvi allaqachon o\'tgan', () => {
    assert.equal(issuedBeforePasswordChange({}, new Date()), false);
});

test('A2: baza — passwordChangedAt maydoni yoziladi va o\'qiladi', async (t) => {
    if (!dbReady) return t.skip('baza yo\'q');

    const u = await makeUser('pwdchange');
    assert.equal(u.passwordChangedAt, null, 'yangi foydalanuvchida null bo\'lishi kerak');

    // Eski token — hozir beriladi
    const oldToken = generateToken(u._id);
    const oldPayload = JSON.parse(
        Buffer.from(oldToken.split('.')[1], 'base64url').toString()
    );

    // Parol 2 sekund keyin o'zgardi deb hisoblaymiz
    u.password = await bcrypt.hash('YangiParol12345', 10);
    u.passwordChangedAt = new Date(Date.now() + 2000);
    await u.save();

    const fresh = await User.findById(u._id).select('passwordChangedAt');
    assert.ok(fresh.passwordChangedAt instanceof Date);
    assert.equal(
        issuedBeforePasswordChange(oldPayload, fresh.passwordChangedAt),
        true,
        'parol o\'zgarishidan oldingi token rad etilishi kerak'
    );

    // Parol o'zgarganidan keyin berilgan token esa o'tadi
    const newPayload = { iat: Math.floor((Date.now() + 5000) / 1000) };
    assert.equal(
        issuedBeforePasswordChange(newPayload, fresh.passwordChangedAt),
        false
    );
});

// ==========================================================================
// A1 / A3 — Server sozlamalari: trust proxy va limiterlar
// ==========================================================================

test('A1: TRUST_PROXY bo\'sh va NODE_ENV production emas — trust proxy O\'CHIQ', async () => {
    const prev = { tp: process.env.TRUST_PROXY, env: process.env.NODE_ENV };
    delete process.env.TRUST_PROXY;
    process.env.NODE_ENV = 'development';

    const { trustProxyEnabled } = require('../utils/trustProxy');
    assert.equal(trustProxyEnabled(), false);

    if (prev.tp !== undefined) process.env.TRUST_PROXY = prev.tp;
    if (prev.env !== undefined) process.env.NODE_ENV = prev.env; else delete process.env.NODE_ENV;
});

test('A1: TRUST_PROXY=1 — trust proxy YOQILGAN', async () => {
    const prev = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = '1';

    const { trustProxyEnabled } = require('../utils/trustProxy');
    assert.equal(trustProxyEnabled(), true);

    if (prev !== undefined) process.env.TRUST_PROXY = prev; else delete process.env.TRUST_PROXY;
});

test('A1: NODE_ENV=production — TRUST_PROXY berilmasa ham yoqiladi', async () => {
    const prev = { tp: process.env.TRUST_PROXY, env: process.env.NODE_ENV };
    delete process.env.TRUST_PROXY;
    process.env.NODE_ENV = 'production';

    const { trustProxyEnabled } = require('../utils/trustProxy');
    assert.equal(trustProxyEnabled(), true);

    if (prev.tp !== undefined) process.env.TRUST_PROXY = prev.tp;
    if (prev.env !== undefined) process.env.NODE_ENV = prev.env; else delete process.env.NODE_ENV;
});

test('A1: TRUST_PROXY=0 production\'da ham o\'chiradi (aniq ko\'rsatma ustun)', async () => {
    const prev = { tp: process.env.TRUST_PROXY, env: process.env.NODE_ENV };
    process.env.TRUST_PROXY = '0';
    process.env.NODE_ENV = 'production';

    const { trustProxyEnabled } = require('../utils/trustProxy');
    assert.equal(trustProxyEnabled(), false);

    if (prev.tp !== undefined) process.env.TRUST_PROXY = prev.tp; else delete process.env.TRUST_PROXY;
    if (prev.env !== undefined) process.env.NODE_ENV = prev.env; else delete process.env.NODE_ENV;
});

test('A3: PUT /password va PUT /profile limiter bilan ro\'yxatga olingan', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(
        path.join(__dirname, '..', 'routes', 'authRoutes.js'), 'utf8'
    );

    assert.match(
        src,
        /router\.put\('\/password',\s*passwordLimiter/,
        "PUT /password passwordLimiter bilan boshlanishi kerak"
    );
    assert.match(
        src,
        /router\.put\('\/profile',\s*profileLimiter/,
        "PUT /profile profileLimiter bilan boshlanishi kerak"
    );
});

test('A1: barcha limiterlar header\'ga ishonmaydigan keyGenerator ishlatadi', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(
        path.join(__dirname, '..', 'routes', 'authRoutes.js'), 'utf8'
    );

    const limiterCount = (src.match(/rateLimit\(\{/g) || []).length;
    const keyGenCount = (src.match(/keyGenerator:\s*ipKey/g) || []).length;

    assert.ok(limiterCount >= 5, `kamida 5 limiter kutilgan, topildi: ${limiterCount}`);
    assert.equal(
        keyGenCount, limiterCount,
        `har bir limiterda keyGenerator bo'lishi kerak (${limiterCount} limiter, ${keyGenCount} keyGenerator)`
    );

    // req.ip dan foydalanadi, header'dan EMAS
    assert.match(src, /ipKeyGenerator\(req\.ip/);
    assert.doesNotMatch(
        src,
        /req\.(headers\[['"]x-forwarded-for|get\(['"]x-forwarded-for)/i,
        "limiter X-Forwarded-For header'ini o'qimasligi kerak"
    );
});

// ==========================================================================
// A4 — Login xabari oshkor qilmaydi
// ==========================================================================

test('A4: login\'dagi uch xato holati bir xil xabar qaytaradi', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(
        path.join(__dirname, '..', 'routes', 'authRoutes.js'), 'utf8'
    );

    assert.doesNotMatch(
        src,
        /Ushbu hisob Google orqali yaratilgan\. Google orqali kiring/,
        'Google hisobini oshkor qiluvchi eski xabar olib tashlanishi kerak'
    );
    assert.match(src, /const INVALID_CREDENTIALS\s*=/);

    // login route ichida uchta joyda ham aynan shu konstanta ishlatiladi
    const loginBlock = src.slice(
        src.indexOf("router.post('/login'"),
        src.indexOf("router.post('/google'")
    );
    const uses = (loginBlock.match(/INVALID_CREDENTIALS/g) || []).length;
    assert.equal(uses, 3, `login ichida 3 marta kutilgan, topildi: ${uses}`);
});
