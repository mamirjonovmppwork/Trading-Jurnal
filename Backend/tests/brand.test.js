// ==========================================================================
// BREND / LOGO TESTLARI — 5A-bosqich (E18)
//
//   cd Backend && npm test
// ==========================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FRONT = path.join(__dirname, '..', '..', 'Frontend');
const BRAND = path.join(FRONT, 'brand');

const PAGES = [
    'index.html', 'login.html', 'register.html', 'verify.html',
    'reset-password.html', 'profile-setup.html', 'dashboard.html',
    'terms.html', 'privacy.html',
];

const read = p => fs.readFileSync(path.join(FRONT, p), 'utf8');

test('E18: brand paketidagi barcha fayllar mavjud', () => {
    [
        'favicon.ico', 'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png',
        'icon-192.png', 'icon-512.png', 'icon.svg', 'icon-dark.svg',
        'logo-light.svg', 'logo-dark.svg', 'logo-light.png', 'logo-dark.png',
        'og-image.png', 'symbol-blue.svg', 'README.md',
    ].forEach(f => assert.ok(
        fs.existsSync(path.join(BRAND, f)), `brand/${f} topilmadi`
    ));
});

test('E18: eski logo papkasi o\'chirilgan va havolasi qolmagan', () => {
    assert.ok(!fs.existsSync(path.join(FRONT, 'logo')), 'Frontend/logo/ o\'chirilishi kerak');
    assert.ok(!fs.existsSync(path.join(BRAND, 'logo')), 'Frontend/brand/logo/ o\'chirilishi kerak');

    PAGES.forEach(p => {
        const html = read(p);
        assert.doesNotMatch(html, /logo\/logo-/, `${p}: eski logo havolasi qolgan`);
        assert.doesNotMatch(html, /my-logo/, `${p}: eski logo havolasi qolgan`);
    });
});

test('E18: har bir sahifada favicon to\'plami va theme-color bor', () => {
    PAGES.forEach(p => {
        const html = read(p);
        assert.match(html, /<link rel="icon" href="brand\/favicon\.ico"/, `${p}: favicon.ico`);
        assert.match(html, /href="brand\/favicon-32\.png"/, `${p}: favicon-32`);
        assert.match(html, /href="brand\/favicon-16\.png"/, `${p}: favicon-16`);
        assert.match(html, /rel="apple-touch-icon"[^>]*href="brand\/apple-touch-icon\.png"/, `${p}: apple-touch-icon`);
        assert.match(html, /<meta name="theme-color" content="#2563EB">/, `${p}: theme-color`);
    });
});

test('E18: har bir sahifada Open Graph va Twitter meta bor', () => {
    PAGES.forEach(p => {
        const html = read(p);
        assert.match(html, /property="og:type" content="website"/, `${p}: og:type`);
        assert.match(html, /property="og:title"/, `${p}: og:title`);
        assert.match(html, /property="og:description"/, `${p}: og:description`);
        assert.match(html, /property="og:url"/, `${p}: og:url`);
        assert.match(html, /name="description"/, `${p}: meta description`);

        // og:image MUTLAQ manzil bo'lishi shart — kraulerlar nisbiy
        // yo'lni ishonchli yechmaydi
        const m = html.match(/property="og:image" content="([^"]+)"/);
        assert.ok(m, `${p}: og:image yo'q`);
        assert.match(m[1], /^https:\/\//, `${p}: og:image mutlaq manzil bo'lishi kerak`);
        assert.match(m[1], /\/brand\/og-image\.png$/, `${p}: og:image brand/og-image.png ga ishora qilishi kerak`);

        assert.match(html, /name="twitter:card" content="summary_large_image"/, `${p}: twitter:card`);
        assert.match(html, /name="twitter:image"/, `${p}: twitter:image`);
    });
});

test('E18: og:image o\'lchamlari haqiqiy fayl o\'lchamiga mos', () => {
    const buf = fs.readFileSync(path.join(BRAND, 'og-image.png'));
    assert.equal(buf.slice(1, 4).toString(), 'PNG');
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);

    PAGES.forEach(p => {
        const html = read(p);
        assert.match(html, new RegExp(`property="og:image:width" content="${w}"`), `${p}: width ${w} bo'lishi kerak`);
        assert.match(html, new RegExp(`property="og:image:height" content="${h}"`), `${p}: height ${h} bo'lishi kerak`);
    });
});

test('E18: har bir sahifada logo <img> va o\'lcham atributlari bor', () => {
    // width/height berilmasa rasm yuklanganda layout sakraydi (CLS)
    PAGES.forEach(p => {
        const html = read(p);
        const m = html.match(/<img src="brand\/logo-light\.svg"[^>]*>/);
        assert.ok(m, `${p}: logo <img> topilmadi`);
        const tag = m[0];
        assert.match(tag, /width="\d+"/, `${p}: width atributi yo'q`);
        assert.match(tag, /height="\d+"/, `${p}: height atributi yo'q`);
        assert.match(tag, /alt="[^"]+"/, `${p}: alt matni yo'q`);
    });
});

test('E18: logo width/height nisbati SVG viewBox nisbatiga mos', () => {
    const svg = fs.readFileSync(path.join(BRAND, 'logo-light.svg'), 'utf8');
    const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    assert.ok(vb, 'logo-light.svg da viewBox topilmadi');
    const want = Number(vb[1]) / Number(vb[2]);

    PAGES.forEach(p => {
        const tag = read(p).match(/<img src="brand\/logo-light\.svg"[^>]*>/)[0];
        const w = Number(tag.match(/width="(\d+)"/)[1]);
        const h = Number(tag.match(/height="(\d+)"/)[1]);
        // 2% chetlanishga ruxsat (butun pikselga yumaloqlash)
        assert.ok(
            Math.abs(w / h - want) / want < 0.02,
            `${p}: ${w}x${h} nisbati (${(w / h).toFixed(3)}) viewBox nisbatidan (${want.toFixed(3)}) farq qiladi — logo cho'ziladi`
        );
    });
});

test('E18: email shabloni rasm ishlatmaydi (matnli sarlavha qoladi)', () => {
    // Email ichidagi rasm spam filtrlarini qo'zg'atadi va ko'p mijozlarda
    // bloklanadi — shu sababli shablon matnli sarlavhada qoladi.
    const src = fs.readFileSync(
        path.join(__dirname, '..', 'services', 'emailService.js'), 'utf8'
    );
    assert.doesNotMatch(src, /<img/i, 'email shablonida <img> bo\'lmasligi kerak');
    assert.doesNotMatch(src, /cid:/i, 'inline rasm (cid:) bo\'lmasligi kerak');
    assert.match(src, />TradeJournal</, 'matnli sarlavha saqlanishi kerak');
});
