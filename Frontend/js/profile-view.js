// ==========================================================================
// PROFIL BO'LIMI (dashboard.html -> sec-profil)
//
// Ikki holat bitta bo'limda:
//   #pv-view — ko'rish (avatar, meta, statistika, ma'lumot bloklari)
//   #pv-edit — tahrirlash (5A gacha Sozlamalar ichida turgan forma)
//
// Statistika SERVERGA QO'SHIMCHA SO'ROV YUBORMAYDI: savdolar
// js/trades-store.js keshidan olinadi — dashboard.js allaqachon
// so'ragan ro'yxatning aynan o'zi.
// ==========================================================================

import api from './api.js';
import { getProfile, setProfile } from './profile-store.js';
import { getTrades, TRADES_UPDATED } from './trades-store.js';
import { escapeHtml } from './utils.js';
import { S } from './strings.js';
import { applyServerTheme } from './theme.js';
import {
    profileSectionsHtml,
    initProfileFields,
    readProfileFields,
    fillProfileFields,
    validateProfileFields,
    EXPERIENCE_OPTIONS,
} from './profile-fields.js';
import {
    setButtonLoading,
    showAlert,
    hideAlert,
    setFieldError,
    clearFieldErrors,
} from './auth-flow.js';

/** Profil yoki email o'zgarganda sahifadagi barcha bloklar yangilanadi */
export const PROFILE_UPDATED = 'profile:updated';

// ======================================================================
// YORDAMCHILAR
// ======================================================================

/** "2026-11-02" -> "2-noyabr, 2026" */
const MONTHS_UZ = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
                   'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.getDate()}-${MONTHS_UZ[d.getMonth()]}, ${d.getFullYear()}`;
}

/** Ism familiyadan bosh harflar: "Muhammadaziz Rahimov" -> "MR" */
function initials(user) {
    const parts = [user.firstName, user.lastName].filter(Boolean);
    const source = parts.length ? parts : String(user.username || user.email || '?').split(/[\s._-]+/);
    return source
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w.trim()[0] || '')
        .join('')
        .toUpperCase() || '?';
}

/**
 * Ismdan barqaror rang tanlaydi (har safar bir xil).
 *
 * ❗ Ranglar OQ matn bilan WCAG AA ni o'tadigan darajada to'q tanlangan —
 *    och pastel fon ustida oq harflar o'qilmaydi.
 */
const AVATAR_COLORS = [
    '#2563eb', // ko'k    — oq matn bilan 5.17:1
    '#6d28d9', // binafsha— 7.10:1
    '#047857', // yashil  — 5.48:1
    '#b45309', // kehribor— 5.02:1
    '#be123c', // qizg'ish— 5.93:1
    '#0f766e', // moviy   — 5.47:1
];

function avatarColor(seed) {
    let hash = 0;
    for (const ch of String(seed || '?')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Pul qiymatini "+$124.50" / "-$30.00" ko'rinishida */
function money(n) {
    const v = Number(n) || 0;
    return `${v >= 0 ? '+' : '-'}$${Math.abs(v).toFixed(2)}`;
}

/** Tajriba kodidan o'qiladigan nom ("1-3" -> "1–3 yil (o'rta)") */
function experienceLabel(code) {
    return EXPERIENCE_OPTIONS.find(o => o.value === code)?.label || '';
}

// ======================================================================
// STATISTIKA
// ======================================================================

/**
 * Savdolardan profil statistikasini hisoblaydi.
 *
 * ❗ Winrate dashboard.js bilan BIR XIL qoida bo'yicha: maxrajda faqat
 *    hal bo'lgan savdolar (wins + losses). pnl === 0 — break-even, ya'ni
 *    na yutuq na yutqazish, shuning uchun maxrajga kirmaydi. Aks holda
 *    "3 Win / 2 Loss" bo'lib turib winrate 50% dan past chiqardi.
 */
export function computeProfileStats(trades) {
    const list = Array.isArray(trades) ? trades : [];

    let wins = 0, losses = 0, breakeven = 0, totalPnl = 0;
    const byPair = new Map();

    for (const t of list) {
        const pnl = Number(t.pnl) || 0;
        totalPnl += pnl;
        if (pnl > 0) wins++;
        else if (pnl < 0) losses++;
        else breakeven++;

        const pair = (t.pair || '—').toUpperCase();
        byPair.set(pair, (byPair.get(pair) || 0) + pnl);
    }

    const decided = wins + losses;

    // Eng foydali juftlik (faqat musbat natija hisobga olinadi)
    let bestPair = null, bestProfit = 0;
    for (const [pair, profit] of byPair) {
        if (profit > bestProfit) { bestPair = pair; bestProfit = profit; }
    }

    return {
        total: list.length,
        wins,
        losses,
        breakeven,
        winrate: decided > 0 ? Math.round((wins / decided) * 100) : 0,
        totalPnl,
        bestPair,
        bestProfit,
        longestWinStreak: longestWinStreak(list),
    };
}

/**
 * Eng uzun ketma-ket yutuq seriyasi.
 *
 * ❗ Savdolar XRONOLOGIK tartibda ko'rilishi shart. GET /trades ro'yxatni
 *    teskari (yangi -> eski) qaytaradi, shuning uchun bu yerda sana+vaqt
 *    bo'yicha qayta saralanadi. Saralamasak, seriya kiritish tartibiga
 *    qarab hisoblanib, noto'g'ri raqam chiqardi.
 *
 *    Break-even (pnl === 0) seriyani UZMAYDI, lekin uni ham oshirmaydi —
 *    winrate'dagi mantiqning aynan o'zi.
 */
function longestWinStreak(trades) {
    const sorted = [...trades].sort((a, b) =>
        `${a.date || ''}${a.time || ''}`.localeCompare(`${b.date || ''}${b.time || ''}`));

    let best = 0, run = 0;
    for (const t of sorted) {
        const pnl = Number(t.pnl) || 0;
        if (pnl > 0) { run++; best = Math.max(best, run); }
        else if (pnl < 0) { run = 0; }
        // pnl === 0 -> seriya saqlanadi
    }
    return best;
}

// ======================================================================
// CHIZISH
// ======================================================================

function statCard({ label, icon, value, sub = '', tone = '' }) {
    return `
    <div class="pstat">
      <div class="pstat-label"><i data-lucide="${icon}"></i> ${escapeHtml(label)}</div>
      <div class="pstat-value ${tone}">${escapeHtml(value)}</div>
      ${sub ? `<span class="pstat-sub">${escapeHtml(sub)}</span>` : ''}
    </div>`;
}

function renderStats(trades) {
    const box = document.getElementById('pv-stats');
    const empty = document.getElementById('pv-stats-empty');
    if (!box || !empty) return;

    const st = computeProfileStats(trades);

    if (st.total === 0) {
        box.hidden = true;
        empty.hidden = false;
        empty.textContent = S['profile.statsEmpty'];
        return;
    }

    empty.hidden = true;
    box.hidden = false;

    box.innerHTML = [
        statCard({
            label: S['profile.statTrades'], icon: 'layers-3',
            value: String(st.total),
            sub: st.breakeven ? `${st.breakeven} ta break-even` : '',
        }),
        statCard({
            label: S['profile.statWinrate'], icon: 'trending-up',
            value: `${st.winrate}%`,
            sub: `${st.wins} yutuq / ${st.losses} yutqazish`,
        }),
        statCard({
            label: S['profile.statPnl'], icon: 'banknote',
            value: money(st.totalPnl),
            tone: st.totalPnl >= 0 ? 'is-pos' : 'is-neg',
        }),
        statCard({
            label: S['profile.statBestPair'], icon: 'award',
            value: st.bestPair || '—',
            sub: st.bestPair ? money(st.bestProfit) : 'Foydali juftlik yo\'q',
        }),
        statCard({
            label: S['profile.statStreak'], icon: 'flame',
            value: String(st.longestWinStreak),
            sub: S['profile.statStreakUnit'],
        }),
    ].join('');

    if (window.lucide) lucide.createIcons();
}

/** Qiymat bor bo'lsa ko'rsatadi, bo'lmasa "To'ldirilmagan" + "Qo'shish" */
function infoRow(key, value) {
    const filled = value !== undefined && value !== null && String(value).trim() !== '';
    const right = filled
        ? `<span class="pinfo-val">${escapeHtml(value)}</span>`
        : `<span class="pinfo-val pinfo-empty">
             <span>${escapeHtml(S['common.empty'])}</span>
             <button type="button" class="pinfo-add" data-pv-add>${escapeHtml(S['common.add'])}</button>
           </span>`;
    return `<li><span class="pinfo-key">${escapeHtml(key)}</span>${right}</li>`;
}

/** Chip ro'yxati (bosilmaydigan, faqat ko'rish) */
function chipBlock(key, values) {
    const list = Array.isArray(values) ? values.filter(Boolean) : [];
    if (!list.length) {
        return `<div class="pinfo-block">
          <span class="pinfo-block-key">${escapeHtml(key)}</span>
          <div class="chip-view-group">
            <span class="pinfo-empty">
              <span>${escapeHtml(S['common.empty'])}</span>
              <button type="button" class="pinfo-add" data-pv-add>${escapeHtml(S['common.add'])}</button>
            </span>
          </div>
        </div>`;
    }
    return `<div class="pinfo-block">
      <span class="pinfo-block-key">${escapeHtml(key)}</span>
      <div class="chip-view-group">
        ${list.map(v => `<span class="chip-view">${escapeHtml(v)}</span>`).join('')}
      </div>
    </div>`;
}

function renderProfile(user) {
    // ---- Avatar ----
    const avatar = document.getElementById('pv-avatar');
    if (avatar) {
        // Fon doim rangli: Google rasmi yuklanmasa ostida bosh harflar
        // ko'rinib turadi, bo'sh kulrang doira qolmaydi.
        avatar.style.background = avatarColor(user.email || user.username);
        avatar.textContent = initials(user);

        if (user.avatar) {
            const img = document.createElement('img');
            img.className = 'profile-avatar-img';
            img.alt = '';
            img.referrerPolicy = 'no-referrer';
            // Havola buzilgan bo'lsa rasmni olib tashlaymiz — ostidagi
            // bosh harflar o'z-o'zidan ko'rinadi.
            img.addEventListener('error', () => img.remove());
            img.addEventListener('load', () => { avatar.textContent = ''; avatar.appendChild(img); });
            img.src = user.avatar;
        }
    }

    // ---- Sarlavha ----
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    const nameEl = document.getElementById('pv-name');
    if (nameEl) nameEl.textContent = fullName || user.username || '—';

    const unameEl = document.getElementById('pv-username');
    if (unameEl) unameEl.textContent = user.username ? `@${user.username}` : '';

    const emailEl = document.getElementById('pv-email');
    if (emailEl) emailEl.textContent = user.email || '—';

    const createdEl = document.getElementById('pv-created');
    if (createdEl) createdEl.textContent = formatDate(user.createdAt);

    const providerEl = document.getElementById('pv-provider');
    if (providerEl) {
        providerEl.textContent = user.provider === 'google'
            ? S['profile.loginGoogle']
            : S['profile.loginEmail'];
    }

    // ---- Shaxsiy ma'lumotlar ----
    const personal = document.getElementById('pv-personal');
    if (personal) {
        const phone = user.phone
            ? `${user.phoneCountryCode || '+998'} ${user.phone}`
            : '';
        personal.innerHTML = [
            infoRow(S['profile.fullName'], fullName),
            infoRow(S['profile.age'], user.age ? `${user.age} ${S['profile.ageYears']}` : ''),
            infoRow(S['profile.phone'], phone),
        ].join('');
    }

    // ---- Treyding profili ----
    const trading = document.getElementById('pv-trading');
    if (trading) {
        const deposit = Number(user.initialBalance) > 0
            ? `$${Number(user.initialBalance).toFixed(2)}`
            : '';
        trading.innerHTML = [
            infoRow(S['profile.experience'], experienceLabel(user.experience)),
            infoRow(S['profile.deposit'], deposit),
        ].join('');
    }

    const chips = document.getElementById('pv-chips');
    if (chips) {
        // "Boshqa" strategiya tanlangan bo'lsa, foydalanuvchi yozgan nomni
        // ro'yxatga qo'shib ko'rsatamiz — aks holda u hech qayerda ko'rinmaydi
        const strategies = [...(user.strategies || [])];
        if (user.customStrategy && strategies.includes('Boshqa')) {
            strategies[strategies.indexOf('Boshqa')] = user.customStrategy;
        }
        chips.innerHTML = [
            chipBlock(S['profile.tradingStyles'], user.tradingStyles),
            chipBlock(S['profile.strategies'], strategies),
            chipBlock(S['profile.markets'], user.markets),
        ].join('');
    }

    renderSidebarAvatar(user);

    if (window.lucide) lucide.createIcons();
}

/**
 * Sidebar'dagi kichik avatar — Profil bo'limi bilan bir xil ko'rinsin.
 * Standart holatda u yerda shunchaki kulrang odam ikonkasi turadi.
 */
function renderSidebarAvatar(user) {
    const box = document.getElementById('sidebar-avatar');
    if (!box) return;

    box.style.background = avatarColor(user.email || user.username);
    box.style.border = 'none';
    box.style.color = 'var(--on-brand)';
    box.style.fontWeight = '700';
    box.style.fontSize = '0.82rem';
    box.style.overflow = 'hidden';
    box.textContent = initials(user);

    if (user.avatar) {
        const img = document.createElement('img');
        img.className = 'profile-avatar-img';
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('load', () => { box.textContent = ''; box.appendChild(img); });
        img.src = user.avatar;
    }
}

// ======================================================================
// ISHGA TUSHISH
// ======================================================================

document.addEventListener('DOMContentLoaded', async () => {
    const section = document.getElementById('sec-profil');
    if (!section) return;
    if (!localStorage.getItem('token')) return; // dashboard.js login'ga yo'naltiradi

    const viewBox = document.getElementById('pv-view');
    const editBox = document.getElementById('pv-edit');
    const editBtn = document.getElementById('pv-edit-btn');
    const cancelBtn = document.getElementById('pv-cancel-btn');
    const form = document.getElementById('profile-edit-form');
    const saveBtn = document.getElementById('st-save');

    // Profil maydonlari — register/profile-setup bilan bitta manbadan
    const holder = document.getElementById('profile-sections');
    if (holder) holder.innerHTML = profileSectionsHtml(1);
    initProfileFields();
    if (window.lucide) lucide.createIcons();

    let currentUser = null;

    // --------------------------------------------------------- KO'RINISH

    function setEditMode(on) {
        if (viewBox) viewBox.hidden = on;
        if (editBox) editBox.hidden = !on;
        if (editBtn) editBtn.hidden = on;
        hideAlert('pv-alert');
        if (on) {
            // Formani har ochilganda serverdagi oxirgi holat bilan to'ldiramiz
            fillProfileFields(currentUser);
            const u = document.getElementById('st-username');
            const e = document.getElementById('st-email');
            if (u) u.value = currentUser?.username || '';
            if (e) e.value = currentUser?.email || '';
        }
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ------------------------------------------------------------ YUKLASH

    async function loadProfile({ force = false } = {}) {
        try {
            currentUser = await getProfile({ force });
            renderProfile(currentUser);
            // Boshqa qurilmada tanlangan mavzu (shu brauzerda tanlov bo'lmasa)
            applyServerTheme(currentUser.theme);
        } catch (err) {
            console.error('Profil: yuklashda xatolik:', err);
            showAlert('pv-alert', 'pv-alert-text', err.message || S['profile.loadError']);
        }
    }

    async function loadStats() {
        try {
            renderStats(await getTrades());
        } catch (err) {
            console.error('Profil: statistikani yuklashda xatolik:', err);
            const empty = document.getElementById('pv-stats-empty');
            if (empty) { empty.hidden = false; empty.textContent = S['profile.statsError']; }
        }
    }

    await loadProfile();
    loadStats();

    // Savdo qo'shilsa/o'chirilsa statistika o'zi yangilanadi
    window.addEventListener(TRADES_UPDATED, (e) => renderStats(e.detail || []));

    // Sozlamalarda email o'zgarsa profil bloki ham yangilanadi
    window.addEventListener(PROFILE_UPDATED, (e) => {
        if (e.detail) { currentUser = e.detail; renderProfile(currentUser); }
    });

    // ----------------------------------------------------- TAHRIRLASH REJIMI

    editBtn?.addEventListener('click', () => setEditMode(true));
    cancelBtn?.addEventListener('click', () => setEditMode(false));

    // Bo'sh maydon yonidagi "Qo'shish" — to'g'ridan-to'g'ri formaga olib boradi
    section.addEventListener('click', (e) => {
        if (e.target.closest('[data-pv-add]')) setEditMode(true);
    });

    // --------------------------------------------------------------- SAQLASH

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert('pv-alert');
        clearFieldErrors(['st-username']);

        const username = (document.getElementById('st-username')?.value || '').trim();

        if (username && (username.length < 2 || username.length > 30)) {
            setFieldError('st-username', "Foydalanuvchi nomi 2–30 belgidan iborat bo'lishi kerak");
            return;
        }
        if (!validateProfileFields()) {
            showAlert('pv-alert', 'pv-alert-text',
                'Formada xatolar bor — belgilangan maydonlarni tekshiring.');
            return;
        }

        const payload = readProfileFields();
        if (username) payload.username = username;

        setButtonLoading(saveBtn, true, S['common.saving']);

        try {
            const data = await api.put('/auth/profile', payload);

            if (data.user) {
                currentUser = data.user;
                setProfile(data.user);       // kesh eskirmasin
                renderProfile(data.user);
                syncSidebarName(data.user.username);
                window.dispatchEvent(new CustomEvent(PROFILE_UPDATED, { detail: data.user }));
            }

            setEditMode(false);
            showAlert('pv-alert', 'pv-alert-text', S['profile.saved'], 'success');
        } catch (err) {
            console.error('Profilni saqlashda xatolik:', err);
            showAlert('pv-alert', 'pv-alert-text', err.message || 'Saqlashda xatolik yuz berdi');
        } finally {
            setButtonLoading(saveBtn, false);
        }
    });

    document.getElementById('st-username')
        ?.addEventListener('input', () => clearFieldErrors(['st-username']));
});

/** Sidebar va mobil hisob menyusidagi ismni yangilaydi */
export function syncSidebarName(username) {
    if (!username) return;
    ['user-name', 'account-sheet-name'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = username;
    });
    localStorage.setItem('username', username);
}
