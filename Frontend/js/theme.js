// ==========================================================================
// KUN / TUN MAVZUSI (5B-bosqich)
//
// Uch holat bor:
//   "light"  — doim kunduzgi
//   "dark"   — doim tungi
//   "system" — operatsion tizim sozlamasiga ergashadi (STANDART)
//
// Tanlov localStorage['theme'] da saqlanadi. Tizimga kirgan foydalanuvchida
// profilga (backend) ham yoziladi — boshqa qurilmada ham o'sha mavzu
// ochilishi uchun.
//
// ❗ OQ CHAQNASH (FOUC): mavzuni shu modul emas, HAR BIR sahifaning <head>
//    boshidagi inline skript qo'yadi. Modul `type="module"` bo'lgani uchun
//    har doim defer bilan ishlaydi — ya'ni DOM qurilgandan keyin. Agar
//    mavzu shu yerda qo'yilsa, tun rejimida sahifa bir lahza OQ chaqnaydi.
//    Inline skript esa CSS yuklanishidan oldin bajariladi.
// ==========================================================================

export const THEME_CHANGED = 'theme:changed';
export const THEME_PREFS = ['light', 'dark', 'system'];
const STORAGE_KEY = 'theme';

const media = window.matchMedia('(prefers-color-scheme: dark)');

/** localStorage'dagi tanlovni qaytaradi (yaroqsiz bo'lsa 'system') */
export function getThemePref() {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch { /* private rejim */ }
    return THEME_PREFS.includes(raw) ? raw : 'system';
}

/** Tanlov asosida haqiqiy mavzuni ('light' | 'dark') hisoblaydi */
export function resolveTheme(pref = getThemePref()) {
    if (pref === 'light' || pref === 'dark') return pref;
    return media.matches ? 'dark' : 'light';
}

/** Hozir ekranda qaysi mavzu turgani */
export function getActiveTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/**
 * CSS o'zgaruvchisining HOZIRGI qiymatini qaytaradi.
 *
 * ❗ Chart.js canvas ichida chizadi va `var(--...)` ni O'QIY OLMAYDI —
 *    u yerda "var(--border-color)" shunchaki yaroqsiz rang bo'lib,
 *    Chart.js o'zining standart rangiga qaytadi. Shuning uchun grafik
 *    ranglari shu funksiya orqali HAQIQIY hex qiymatga aylantiriladi.
 */
export function cssVar(name, fallback = '') {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
}

/** Grafiklar uchun joriy mavzuning rang to'plami */
export function chartColors() {
    return {
        grid:  cssVar('--chart-grid', '#e2e8f0'),
        tick:  cssVar('--chart-tick', '#5b6775'),
        label: cssVar('--chart-label', '#0f172a'),
        green: cssVar('--chart-green', '#047857'),
        red:   cssVar('--chart-red', '#dc2626'),
        blue:  cssVar('--chart-blue', '#2563eb'),
        gold:  cssVar('--chart-gold', '#b45309'),
    };
}

// ------------------------------------------------------------------ QO'LLASH

/** <html> atributlarini, logoni va Google tugmasini joriy mavzuga moslaydi */
function paint(pref) {
    const theme = resolveTheme(pref);
    const root = document.documentElement;

    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-pref', pref);

    syncLogos(theme);
    syncThemeMeta(theme);
    syncToggleLabel(theme, pref);

    return theme;
}

/** Tunda logo-dark.svg, kunduzi logo-light.svg */
function syncLogos(theme) {
    // brand.test.js HTML ichida `brand/logo-light.svg` borligini talab
    // qiladi (statik faylni o'qiydi) — shuning uchun HTML'da light qoladi,
    // almashtirish faqat ish vaqtida bo'ladi.
    document.querySelectorAll('img[data-logo]').forEach(img => {
        const want = theme === 'dark' ? 'brand/logo-dark.svg' : 'brand/logo-light.svg';
        if (!img.getAttribute('src').endsWith(want)) img.setAttribute('src', want);
    });
}

/** Mobil brauzer manzil paneli rangi */
function syncThemeMeta(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0d1117' : '#2563eb');
}

/** Sidebar tugmasining matni va aria-label'i */
function syncToggleLabel(theme, pref) {
    const label = { light: 'Kunduzgi', dark: 'Tungi', system: 'Tizim' }[pref];
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
        const text = btn.querySelector('[data-theme-label]');
        if (text) text.textContent = label;
        btn.setAttribute('aria-label',
            `Mavzu: ${label}. Almashtirish uchun bosing (hozir ${theme === 'dark' ? 'tungi' : 'kunduzgi'})`);
    });
}

/**
 * Google GSI tugmasini qayta render qiladi — tunda to'q variant.
 *
 * Tugma iframe ichida, shuning uchun CSS bilan bo'yalmaydi: yagona yo'l
 * `data-theme` atributini o'zgartirib GSI'ga qaytadan chizdirish.
 */
function syncGoogleButton(theme) {
    const holder = document.querySelector('.g_id_signin');
    if (!holder) return;

    const want = theme === 'dark' ? 'filled_black' : 'outline';
    if (holder.getAttribute('data-theme') === want) return;
    holder.setAttribute('data-theme', want);

    // GSI yuklanmagan bo'lsa (sekin internet) — o'zi yuklanganda
    // atributni o'qib to'g'ri chizadi, qo'shimcha ish kerak emas.
    if (window.google?.accounts?.id?.renderButton) {
        holder.innerHTML = '';
        window.google.accounts.id.renderButton(holder, {
            theme: want,
            size: holder.dataset.size || 'large',
            shape: holder.dataset.shape || 'pill',
            width: Number(holder.dataset.width) || undefined,
            text: holder.dataset.text || 'signin_with',
            logo_alignment: holder.dataset.logo_alignment || 'left',
        });
    }
}

/**
 * Mavzuni o'rnatadi va saqlaydi.
 * @param {'light'|'dark'|'system'} pref
 * @param {object}  [opts]
 * @param {boolean} [opts.persist=true] localStorage'ga yozilsinmi
 */
export function setTheme(pref, { persist = true } = {}) {
    if (!THEME_PREFS.includes(pref)) pref = 'system';

    if (persist) {
        try { localStorage.setItem(STORAGE_KEY, pref); } catch { /* private rejim */ }
    }

    const theme = paint(pref);
    syncGoogleButton(theme);

    window.dispatchEvent(new CustomEvent(THEME_CHANGED, { detail: { pref, theme } }));
    return theme;
}

/** Tugma bosilganda: kunduzgi -> tungi -> tizim -> kunduzgi */
export function cycleTheme() {
    const next = { light: 'dark', dark: 'system', system: 'light' }[getThemePref()];
    return setTheme(next);
}

// --------------------------------------------------------------- ISHGA TUSHISH

let started = false;

/**
 * Sahifada mavzu mantiqini ishga tushiradi.
 * Har bir sahifa (login, register, dashboard, ...) bir marta chaqiradi.
 */
export function initTheme() {
    if (started) return;
    started = true;

    const pref = getThemePref();
    paint(pref);
    syncGoogleButton(resolveTheme(pref));

    // Tizim sozlamasi o'zgarsa — faqat "system" tanlovida ergashamiz
    const onSystemChange = () => {
        if (getThemePref() !== 'system') return;
        const theme = paint('system');
        syncGoogleButton(theme);
        window.dispatchEvent(new CustomEvent(THEME_CHANGED, { detail: { pref: 'system', theme } }));
    };
    if (media.addEventListener) media.addEventListener('change', onSystemChange);
    else media.addListener(onSystemChange); // eski Safari

    // Boshqa tab'da mavzu almashsa — bu tab ham ergashadi
    window.addEventListener('storage', (e) => {
        if (e.key !== STORAGE_KEY) return;
        const theme = paint(getThemePref());
        syncGoogleButton(theme);
        window.dispatchEvent(new CustomEvent(THEME_CHANGED, { detail: { pref: getThemePref(), theme } }));
    });

    // Sidebar / sahifadagi tez almashtirish tugmalari
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
        btn.addEventListener('click', () => cycleTheme());
    });
}

/**
 * Profilda saqlangan mavzuni qo'llaydi (boshqa qurilmadan kelgan tanlov).
 *
 * ❗ Faqat shu brauzerda hech qachon tanlov qilinmagan bo'lsa qo'llanadi.
 *    Aks holda foydalanuvchi shu qurilmada tanlagan mavzu serverdagi eski
 *    qiymat bilan bosib ketilardi.
 */
export function applyServerTheme(serverPref) {
    if (!THEME_PREFS.includes(serverPref)) return;

    let stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* private rejim */ }
    if (THEME_PREFS.includes(stored)) return; // lokal tanlov ustun

    setTheme(serverPref);
}
