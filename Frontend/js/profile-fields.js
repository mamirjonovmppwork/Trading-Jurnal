// ==========================================================================
// PROFIL MAYDONLARI — UMUMIY MANTIQ
//
// Uchta sahifa bir xil maydon to'plamidan foydalanadi:
//   register.html, profile-setup.html, dashboard.html (Sozlamalar/Profil)
// Shuning uchun o'qish/yozish/chip boshqaruvi shu yerda, bitta joyda.
//
// Enum qiymatlari backend'dagi models/user.js dagi ro'yxatlar bilan
// AYNAN bir xil bo'lishi shart — aks holda 400 qaytadi.
// ==========================================================================

export const TRADING_STYLES = ['Scalping', 'Day trading', 'Swing', 'Uzoq muddatli'];
export const STRATEGIES     = ['SMC/ICT', 'Price Action', 'Support/Resistance', 'Supply & Demand', 'Indikatorlar', 'Fibonacci', 'Boshqa'];
export const MARKETS        = ['Forex', 'Kripto', 'Oltin', 'Indekslar'];

export const EXPERIENCE_OPTIONS = [
    { value: '0-1', label: '0–1 yil (boshlovchi)' },
    { value: '1-3', label: '1–3 yil (o\'rta)' },
    { value: '3+',  label: '3+ yil (tajribali)' },
];

// Eng ko'p ishlatiladigan davlat kodlari (default +998)
export const COUNTRY_CODES = [
    { code: '+998', label: '🇺🇿 +998' },
    { code: '+7',   label: '🇷🇺 +7' },
    { code: '+90',  label: '🇹🇷 +90' },
    { code: '+1',   label: '🇺🇸 +1' },
    { code: '+44',  label: '🇬🇧 +44' },
    { code: '+971', label: '🇦🇪 +971' },
    { code: '+49',  label: '🇩🇪 +49' },
    { code: '+996', label: '🇰🇬 +996' },
    { code: '+992', label: '🇹🇯 +992' },
    { code: '+993', label: '🇹🇲 +993' },
    { code: '+77',  label: '🇰🇿 +77' },
];

// --------------------------------------------------------------- HTML QURISH

/** Davlat kodi <option> larini qaytaradi */
export function countryCodeOptions(selected = '+998') {
    return COUNTRY_CODES
        .map(c => `<option value="${c.code}"${c.code === selected ? ' selected' : ''}>${c.label}</option>`)
        .join('');
}

/** Tajriba <option> larini qaytaradi */
export function experienceOptions(selected = '') {
    const empty = `<option value=""${selected ? '' : ' selected'}>Tanlanmagan</option>`;
    return empty + EXPERIENCE_OPTIONS
        .map(o => `<option value="${o.value}"${o.value === selected ? ' selected' : ''}>${o.label}</option>`)
        .join('');
}

/** Chip tugmalarini qaytaradi (multi-select) */
export function chipButtons(values, groupName) {
    return values
        .map(v => `<button type="button" class="chip" data-group="${groupName}" data-value="${v}" aria-pressed="false">${v}</button>`)
        .join('');
}

/**
 * Profil bo'limlarining HTML'ini qaytaradi.
 * startIndex — bo'lim raqamlari nechadan boshlanishi (register'da 1, profile-setup'da 1).
 */
export function profileSectionsHtml(startIndex = 1) {
    return `
    <div class="form-section">
      <div class="form-section-head">
        <span class="form-section-num">${startIndex}</span>
        <span class="form-section-title">Shaxsiy ma'lumotlar</span>
        <span class="form-section-hint">ixtiyoriy</span>
      </div>

      <div class="form-row">
        <div class="form-group no-icon">
          <label for="pf-firstName">Ism <span class="optional-tag">(ixtiyoriy)</span></label>
          <input type="text" id="pf-firstName" maxlength="50" placeholder="Muhammadaziz" autocomplete="given-name">
          <span class="field-error" id="err-pf-firstName"></span>
        </div>
        <div class="form-group no-icon">
          <label for="pf-lastName">Familiya <span class="optional-tag">(ixtiyoriy)</span></label>
          <input type="text" id="pf-lastName" maxlength="50" placeholder="Rahimov" autocomplete="family-name">
          <span class="field-error" id="err-pf-lastName"></span>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group no-icon">
          <label for="pf-age">Yosh <span class="optional-tag">(ixtiyoriy, 16–99)</span></label>
          <input type="number" id="pf-age" min="16" max="99" step="1" placeholder="24">
          <span class="field-error" id="err-pf-age"></span>
        </div>
        <div class="form-group no-icon">
          <label for="pf-phone">Telefon <span class="optional-tag">(ixtiyoriy)</span></label>
          <div class="phone-row">
            <select id="pf-phoneCountryCode" aria-label="Davlat kodi">${countryCodeOptions()}</select>
            <input type="tel" id="pf-phone" inputmode="numeric" maxlength="14" placeholder="901234567" autocomplete="tel-national">
          </div>
          <span class="field-error" id="err-pf-phone"></span>
        </div>
      </div>
    </div>

    <div class="form-section">
      <div class="form-section-head">
        <span class="form-section-num">${startIndex + 1}</span>
        <span class="form-section-title">Treyding profili</span>
        <span class="form-section-hint">ixtiyoriy</span>
      </div>

      <div class="form-row">
        <div class="form-group no-icon">
          <label for="pf-initialBalance">Boshlang'ich depozit ($) <span class="optional-tag">(ixtiyoriy)</span></label>
          <input type="number" id="pf-initialBalance" min="0" step="0.01" placeholder="1000">
          <span class="field-error" id="err-pf-initialBalance"></span>
        </div>
        <div class="form-group no-icon">
          <label for="pf-experience">Tajriba <span class="optional-tag">(ixtiyoriy)</span></label>
          <select id="pf-experience">${experienceOptions()}</select>
        </div>
      </div>

      <div class="form-group no-icon">
        <label>Savdo uslubi <span class="optional-tag">(ixtiyoriy, bir nechtasini tanlashingiz mumkin)</span></label>
        <div class="chip-group" id="pf-tradingStyles">${chipButtons(TRADING_STYLES, 'tradingStyles')}</div>
      </div>

      <div class="form-group no-icon">
        <label>Strategiya <span class="optional-tag">(ixtiyoriy, bir nechtasini tanlashingiz mumkin)</span></label>
        <div class="chip-group" id="pf-strategies">${chipButtons(STRATEGIES, 'strategies')}</div>
      </div>

      <div class="form-group no-icon" id="pf-customStrategy-wrap" style="display:none;">
        <label for="pf-customStrategy">Qaysi strategiya? <span class="optional-tag">("Boshqa" tanlandi)</span></label>
        <input type="text" id="pf-customStrategy" maxlength="100" placeholder="Masalan: Wyckoff, Elliott Wave">
        <span class="field-error" id="err-pf-customStrategy"></span>
      </div>

      <div class="form-group no-icon" style="margin-bottom:0;">
        <label>Bozor <span class="optional-tag">(ixtiyoriy, bir nechtasini tanlashingiz mumkin)</span></label>
        <div class="chip-group" id="pf-markets">${chipButtons(MARKETS, 'markets')}</div>
      </div>
    </div>`;
}

// ------------------------------------------------------------ CHIP BOSHQARUVI

/** Chip guruhidagi tanlangan qiymatlarni qaytaradi */
function readChips(groupId) {
    const group = document.getElementById(groupId);
    if (!group) return [];
    return [...group.querySelectorAll('.chip[aria-pressed="true"]')]
        .map(btn => btn.dataset.value);
}

/** Chip guruhiga qiymatlarni o'rnatadi */
function writeChips(groupId, values) {
    const group = document.getElementById(groupId);
    if (!group) return;
    const set = new Set(Array.isArray(values) ? values : []);
    group.querySelectorAll('.chip').forEach(btn => {
        btn.setAttribute('aria-pressed', set.has(btn.dataset.value) ? 'true' : 'false');
    });
}

/** "Boshqa" chip holatiga qarab matn maydonini ko'rsatadi/yashiradi */
function syncCustomStrategyVisibility() {
    const wrap = document.getElementById('pf-customStrategy-wrap');
    if (!wrap) return;
    const selected = readChips('pf-strategies').includes('Boshqa');
    wrap.style.display = selected ? 'block' : 'none';
    if (!selected) {
        const input = document.getElementById('pf-customStrategy');
        if (input) input.value = '';
    }
}

/**
 * Chip tugmalarini ishga tushiradi. Sahifa yuklangandan keyin
 * profileSectionsHtml() DOM ga qo'yilgach bir marta chaqiriladi.
 */
export function initProfileFields() {
    document.querySelectorAll('.chip-group .chip').forEach(btn => {
        btn.addEventListener('click', () => {
            const pressed = btn.getAttribute('aria-pressed') === 'true';
            btn.setAttribute('aria-pressed', pressed ? 'false' : 'true');
            if (btn.dataset.group === 'strategies') syncCustomStrategyVisibility();
        });
    });
    syncCustomStrategyVisibility();
}

// --------------------------------------------------------- O'QISH / YOZISH

/** Bo'sh bo'lmagan matnni qaytaradi, bo'sh bo'lsa undefined */
function text(id) {
    const el = document.getElementById(id);
    if (!el) return undefined;
    const v = el.value.trim();
    return v === '' ? undefined : v;
}

/**
 * Formadan profil ma'lumotlarini o'qiydi.
 * Bo'sh maydonlar YUBORILMAYDI (undefined) — backend ularni
 * "o'zgartirilmadi" deb qabul qiladi.
 */
export function readProfileFields() {
    const data = {};

    const firstName = text('pf-firstName');
    const lastName  = text('pf-lastName');
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName  !== undefined) data.lastName  = lastName;

    const age = text('pf-age');
    if (age !== undefined) data.age = Number(age);

    const phone = text('pf-phone');
    if (phone !== undefined) {
        // Foydalanuvchi bo'sh joy/qavs/chiziqcha qo'yishi mumkin — tozalaymiz
        data.phone = phone.replace(/\D/g, '');
        data.phoneCountryCode = document.getElementById('pf-phoneCountryCode')?.value || '+998';
    }

    const balance = text('pf-initialBalance');
    if (balance !== undefined) data.initialBalance = Number(balance);

    const experience = text('pf-experience');
    if (experience !== undefined) data.experience = experience;

    const styles  = readChips('pf-tradingStyles');
    const strats  = readChips('pf-strategies');
    const markets = readChips('pf-markets');
    if (styles.length)  data.tradingStyles = styles;
    if (strats.length)  data.strategies    = strats;
    if (markets.length) data.markets       = markets;

    const custom = text('pf-customStrategy');
    if (custom !== undefined && strats.includes('Boshqa')) {
        data.customStrategy = custom;
    }

    return data;
}

/** Serverdan kelgan profil bilan formani to'ldiradi */
export function fillProfileFields(user) {
    if (!user) return;

    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val ?? '';
    };

    set('pf-firstName', user.firstName);
    set('pf-lastName', user.lastName);
    set('pf-age', user.age ?? '');
    set('pf-phone', user.phone);
    set('pf-phoneCountryCode', user.phoneCountryCode || '+998');
    set('pf-initialBalance', user.initialBalance ?? '');
    set('pf-experience', user.experience || '');
    set('pf-customStrategy', user.customStrategy);

    writeChips('pf-tradingStyles', user.tradingStyles);
    writeChips('pf-strategies', user.strategies);
    writeChips('pf-markets', user.markets);

    syncCustomStrategyVisibility();
}

// --------------------------------------------------- MIJOZ TOMONI TEKSHIRUVI

/**
 * Profil maydonlarini brauzerda tekshiradi (backend ham tekshiradi —
 * bu faqat tezroq fikr-mulohaza uchun).
 * Xatolar bo'lsa maydon ostida ko'rsatadi va false qaytaradi.
 */
export function validateProfileFields() {
    const errors = {};

    const age = text('pf-age');
    if (age !== undefined) {
        const n = Number(age);
        if (!Number.isFinite(n) || n < 16 || n > 99) {
            errors['pf-age'] = 'Yosh 16 dan 99 gacha bo\'lishi kerak';
        }
    }

    const phone = text('pf-phone');
    if (phone !== undefined) {
        const digits = phone.replace(/\D/g, '');
        if (!/^\d{6,14}$/.test(digits)) {
            errors['pf-phone'] = 'Telefon raqami 6–14 raqamdan iborat bo\'lishi kerak';
        }
    }

    const balance = text('pf-initialBalance');
    if (balance !== undefined) {
        const n = Number(balance);
        if (!Number.isFinite(n) || n < 0) {
            errors['pf-initialBalance'] = 'Depozit 0 dan katta bo\'lishi kerak';
        }
    }

    if (readChips('pf-strategies').includes('Boshqa')) {
        const custom = text('pf-customStrategy');
        if (custom !== undefined && custom.length > 100) {
            errors['pf-customStrategy'] = '100 belgidan oshmasligi kerak';
        }
    }

    // Avvalgi xatolarni tozalaymiz
    ['pf-age', 'pf-phone', 'pf-initialBalance', 'pf-customStrategy'].forEach(id => {
        const el = document.getElementById(id);
        const err = document.getElementById(`err-${id}`);
        el?.closest('.form-group')?.classList.remove('has-error');
        if (err) { err.textContent = ''; err.classList.remove('show'); }
    });

    for (const [id, message] of Object.entries(errors)) {
        const el = document.getElementById(id);
        const err = document.getElementById(`err-${id}`);
        el?.closest('.form-group')?.classList.add('has-error');
        if (err) { err.textContent = message; err.classList.add('show'); }
    }

    return Object.keys(errors).length === 0;
}
