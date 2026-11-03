// ==========================================================================
// SOZLAMALAR BO'LIMI (dashboard.html -> sec-sozlamalar)
//
// Besh mustaqil blok:
//   1. Ko'rinish      — kun / tun / tizim bo'yicha
//   2. Til            — uz / ru / en (tanlov saqlanadi, tarjima 5C'da)
//   3. Akkaunt        — emailni o'zgartirish, parolni o'zgartirish/o'rnatish
//   4. Ma'lumotlar    — savdolarni CSV qilib yuklab olish
//   5. Xavfli zona    — akkauntni butunlay o'chirish
//
// ❗ PROFIL FORMASI BU YERDAN KETDI — endi alohida "Profil" bo'limida
//    (js/profile-view.js). Shu sababli bu fayl profil maydonlari bilan
//    ishlamaydi.
// ==========================================================================

import api from './api.js';
import { getProfile, setProfile, clearProfile } from './profile-store.js';
import { clearTrades } from './trades-store.js';
import { S } from './strings.js';
import { setTheme, getThemePref, THEME_CHANGED } from './theme.js';
import { PROFILE_UPDATED } from './profile-view.js';
import {
    setButtonLoading,
    showAlert,
    hideAlert,
    setFieldError,
    clearFieldErrors,
    initPasswordToggles,
    initPasswordStrength,
    EMAIL_RE,
} from './auth-flow.js';

const PW_FIELDS = ['st-current-password', 'st-new-password', 'st-new-password2'];

/** Kuchlilik indikatorini boshlang'ich holatga qaytaradi */
function resetStrengthMeter() {
    const fill = document.getElementById('st-strength-fill');
    const label = document.getElementById('st-strength-label');
    if (fill) { fill.style.width = '0%'; fill.style.background = 'var(--border-dark)'; }
    if (label) { label.textContent = 'Parol kuchliligi'; label.style.color = 'var(--text-faint)'; }
}

/** Panelni ko'rsatadi/yashiradi va ichidagi birinchi maydonga fokus beradi */
function togglePanel(id, show, focusId) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = !show;
    if (show && focusId) document.getElementById(focusId)?.focus();
}

document.addEventListener('DOMContentLoaded', async () => {
    const section = document.getElementById('sec-sozlamalar');
    if (!section) return;
    if (!localStorage.getItem('token')) return; // dashboard.js login'ga yo'naltiradi

    initPasswordToggles();
    initPasswordStrength('st-new-password', 'st-strength-fill', 'st-strength-label');
    if (window.lucide) lucide.createIcons();

    let user = null;

    // ==================================================================
    // 1. KO'RINISH (kun / tun / tizim)
    // ==================================================================

    const themeCards = [...section.querySelectorAll('[data-theme-choice]')];

    function paintThemeCards(pref = getThemePref()) {
        themeCards.forEach(btn => {
            btn.setAttribute('aria-checked', String(btn.dataset.themeChoice === pref));
        });
    }

    themeCards.forEach(btn => {
        btn.addEventListener('click', async () => {
            const pref = btn.dataset.themeChoice;
            setTheme(pref);                 // darhol qo'llanadi va localStorage'ga yoziladi
            paintThemeCards(pref);
            await savePreference({ theme: pref });
        });
    });

    // Sidebar'dagi oy/quyosh tugmasi bosilganda kartalar ham yangilanadi
    window.addEventListener(THEME_CHANGED, (e) => {
        paintThemeCards(e.detail?.pref);
        // Sidebar tugmasi orqali o'zgargan tanlov ham serverga yoziladi
        if (e.detail?.pref && user && e.detail.pref !== user.theme) {
            savePreference({ theme: e.detail.pref });
        }
    });

    paintThemeCards();

    // ==================================================================
    // 2. TIL
    // ==================================================================

    const langCards = [...section.querySelectorAll('[data-lang-choice]')];

    function paintLangCards(lang) {
        langCards.forEach(btn => {
            btn.setAttribute('aria-checked', String(btn.dataset.langChoice === lang));
        });
    }

    langCards.forEach(btn => {
        btn.addEventListener('click', async () => {
            const lang = btn.dataset.langChoice;
            paintLangCards(lang);
            const ok = await savePreference({ language: lang });
            if (ok) {
                // ❗ Interfeys HOZIR tarjima qilinmaydi — foydalanuvchi
                //    "hech narsa o'zgarmadi" deb o'ylab qolmasin, shuning
                //    uchun aniq izoh beramiz.
                showAlert('lang-alert', 'lang-alert-text',
                    `${S['lang.saved']}. ${S['lang.pending']}.`, 'info');
            }
        });
    });

    /**
     * Mavzu/til tanlovini serverga yozadi.
     *
     * Mavzu ALLAQACHON localStorage'da va ekranda — server javobi kutilmaydi.
     * Shu sababli so'rov yiqilsa ham interfeys ishlashda davom etadi,
     * faqat boshqa qurilmada sinxronlanmaydi.
     */
    async function savePreference(patch) {
        try {
            const res = await api.put('/auth/preferences', patch);
            if (user) {
                if (res.theme) user.theme = res.theme;
                if (res.language) user.language = res.language;
                setProfile(user);
            }
            return true;
        } catch (err) {
            console.warn('Sozlamani serverga yozib bo\'lmadi:', err.message);
            return false;
        }
    }

    // ==================================================================
    // 3. AKKAUNT — YUKLASH
    // ==================================================================

    const emailEl = document.getElementById('acc-email');
    const pwStateEl = document.getElementById('acc-password-state');
    const pwOpenBtn = document.getElementById('pw-open-btn');

    function renderAccount(u) {
        user = u;

        if (emailEl) emailEl.textContent = u.email || '—';
        paintThemeCards();
        paintLangCards(u.language || 'uz');

        const isGoogle = u.provider === 'google' || !u.hasPassword;

        // --- Email: Google hisobida o'zgartirilmaydi ---
        const emOpen = document.getElementById('em-open-btn');
        const emNote = document.getElementById('em-google-note');
        if (u.provider === 'google') {
            if (emOpen) { emOpen.disabled = true; emOpen.title = S['account.emailGoogleNote']; }
            if (emNote) { emNote.hidden = false; emNote.className = 'form-alert info show'; }
        } else {
            if (emOpen) { emOpen.disabled = false; emOpen.removeAttribute('title'); }
            if (emNote) { emNote.hidden = true; emNote.className = 'form-alert info'; }
        }

        // --- Parol: o'rnatilganmi? ---
        if (u.hasPassword) {
            if (pwStateEl) pwStateEl.textContent = "O'rnatilgan";
            if (pwOpenBtn) pwOpenBtn.querySelector('span').textContent = S['account.passwordChange'];
        } else {
            if (pwStateEl) pwStateEl.textContent = "O'rnatilmagan";
            if (pwOpenBtn) pwOpenBtn.querySelector('span').textContent = S['account.passwordSet'];
        }
        if (isGoogle && !u.hasPassword) {
            showAlert('pw-alert', 'pw-alert-text', S['account.passwordNone'], 'info');
        }

        // Parol o'rnatish havolasi emailni oldindan to'ldiradi
        const setLink = document.getElementById('pw-set-link');
        if (setLink && u.email) {
            setLink.href = `reset-password.html?email=${encodeURIComponent(u.email)}`;
        }

        // Xavfli zonada aynan qaysi email yozilishi kerakligi ko'rinadi
        const sample = document.getElementById('del-email-sample');
        if (sample) sample.textContent = u.email || '';

        if (window.lucide) lucide.createIcons();
    }

    try {
        renderAccount(await getProfile());   // dashboard.js bilan bitta so'rov
    } catch (err) {
        console.error('Sozlamalar: profil yuklashda xatolik:', err);
        showAlert('em-alert', 'em-alert-text', err.message || S['profile.loadError']);
    }

    // Profil bo'limida saqlangan o'zgarish bu yerda ham ko'rinadi
    window.addEventListener(PROFILE_UPDATED, (e) => { if (e.detail) renderAccount(e.detail); });

    // ==================================================================
    // 3a. EMAILNI O'ZGARTIRISH (ikki qadam: so'rov -> kod)
    // ==================================================================

    const emSendBtn = document.getElementById('em-send-btn');
    const emConfirmBtn = document.getElementById('em-confirm-btn');

    function closeEmailPanels() {
        togglePanel('em-panel-request', false);
        togglePanel('em-panel-confirm', false);
        clearFieldErrors(['em-new', 'em-code']);
        hideAlert('em-alert');
    }

    document.getElementById('em-open-btn')?.addEventListener('click', () => {
        hideAlert('em-alert');
        togglePanel('em-panel-confirm', false);
        togglePanel('em-panel-request', true, 'em-new');
    });

    document.getElementById('em-cancel-btn')?.addEventListener('click', closeEmailPanels);
    document.getElementById('em-back-btn')?.addEventListener('click', closeEmailPanels);

    emSendBtn?.addEventListener('click', async () => {
        hideAlert('em-alert');
        clearFieldErrors(['em-new']);

        const newEmail = (document.getElementById('em-new')?.value || '').trim();

        if (!newEmail) {
            setFieldError('em-new', 'Yangi email kiritilishi shart');
            return;
        }
        if (!EMAIL_RE.test(newEmail)) {
            setFieldError('em-new', "Email formati noto'g'ri (masalan: ism@example.com)");
            return;
        }
        if (newEmail.toLowerCase() === (user?.email || '').toLowerCase()) {
            setFieldError('em-new', 'Bu allaqachon sizning emailingiz');
            return;
        }

        setButtonLoading(emSendBtn, true, 'Yuborilmoqda...');
        try {
            const res = await api.post('/auth/email/request', { newEmail });

            togglePanel('em-panel-request', false);
            togglePanel('em-panel-confirm', true, 'em-code');

            const extra = res.emailSent === false
                ? " (email yuborilmadi — server logidagi kodni ishlatib ko'ring)"
                : '';
            showAlert('em-alert', 'em-alert-text',
                `${S['account.emailCodeSent']}: ${res.email}${extra}`, 'info');
        } catch (err) {
            console.error('Email o\'zgartirish so\'rovida xatolik:', err);
            showAlert('em-alert', 'em-alert-text', err.message || 'Kod yuborishda xatolik');
        } finally {
            setButtonLoading(emSendBtn, false);
        }
    });

    emConfirmBtn?.addEventListener('click', async () => {
        hideAlert('em-alert');
        clearFieldErrors(['em-code']);

        const code = (document.getElementById('em-code')?.value || '').trim();
        if (!/^\d{6}$/.test(code)) {
            setFieldError('em-code', '6 xonali kodni kiriting');
            return;
        }

        setButtonLoading(emConfirmBtn, true, 'Tekshirilmoqda...');
        try {
            const res = await api.post('/auth/email/confirm', { code });

            closeEmailPanels();

            // Kesh eskirmasin: email o'zgardi, profil blokida ham ko'rinishi kerak
            const fresh = await getProfile({ force: true });
            renderAccount(fresh);
            window.dispatchEvent(new CustomEvent(PROFILE_UPDATED, { detail: fresh }));

            showAlert('em-alert', 'em-alert-text',
                `${S['account.emailChanged']}: ${res.email}`, 'success');
        } catch (err) {
            console.error('Emailni tasdiqlashda xatolik:', err);
            if (/kod/i.test(err.message || '')) setFieldError('em-code', err.message);
            showAlert('em-alert', 'em-alert-text', err.message || 'Tasdiqlashda xatolik');
        } finally {
            setButtonLoading(emConfirmBtn, false);
        }
    });

    // ==================================================================
    // 3b. PAROLNI O'ZGARTIRISH / O'RNATISH
    // ==================================================================

    const passwordForm = document.getElementById('settings-password-form');
    const pwSaveBtn = document.getElementById('pw-save');

    pwOpenBtn?.addEventListener('click', () => {
        // Parol yo'q bo'lsa "o'zgartirish" formasi ma'nosiz (joriy parol
        // so'raladi) — o'rniga emailga kod yuborish oqimiga yo'naltiramiz.
        if (user && !user.hasPassword) {
            togglePanel('pw-panel-change', false);
            togglePanel('pw-panel-set', true);
            return;
        }
        togglePanel('pw-panel-set', false);
        const panel = document.getElementById('pw-panel-change');
        togglePanel('pw-panel-change', panel?.hidden !== false, 'st-current-password');
    });

    document.getElementById('pw-cancel-btn')?.addEventListener('click', () => {
        togglePanel('pw-panel-change', false);
        passwordForm?.reset();
        resetStrengthMeter();
        clearFieldErrors(PW_FIELDS);
    });

    passwordForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert('pw-alert');
        clearFieldErrors(PW_FIELDS);

        const current = document.getElementById('st-current-password').value;
        const next = document.getElementById('st-new-password').value;
        const next2 = document.getElementById('st-new-password2').value;

        let valid = true;
        if (!current) {
            setFieldError('st-current-password', 'Joriy parol kiritilishi shart');
            valid = false;
        }
        if (!next) {
            setFieldError('st-new-password', 'Yangi parol kiritilishi shart');
            valid = false;
        } else if (next.length < 8) {
            setFieldError('st-new-password', "Parol kamida 8 belgidan iborat bo'lishi kerak");
            valid = false;
        } else if (next === current) {
            setFieldError('st-new-password', 'Yangi parol joriy paroldan farq qilishi kerak');
            valid = false;
        }
        if (!next2) {
            setFieldError('st-new-password2', 'Yangi parolni takrorlang');
            valid = false;
        } else if (next && next !== next2) {
            setFieldError('st-new-password2', 'Parollar mos kelmadi');
            valid = false;
        }
        if (!valid) return;

        setButtonLoading(pwSaveBtn, true, "O'zgartirilmoqda...");
        try {
            const data = await api.put('/auth/password', {
                currentPassword: current,
                newPassword: next,
            });

            // 🔒 Server parol o'zgarishidan oldingi BARCHA tokenlarni bekor
            // qiladi — joriy sessiya ham shunga kiradi. Javobdagi yangi
            // tokenni darhol saqlamasak, keyingi so'rov 401 olib
            // foydalanuvchini tizimdan chiqarib yuborardi.
            if (data?.token) localStorage.setItem('token', data.token);

            passwordForm.reset();
            resetStrengthMeter();
            togglePanel('pw-panel-change', false);

            showAlert('pw-alert', 'pw-alert-text', "Parol muvaffaqiyatli o'zgartirildi", 'success');
        } catch (err) {
            console.error("Parolni o'zgartirishda xatolik:", err);
            if (/joriy parol/i.test(err.message || '')) {
                setFieldError('st-current-password', err.message);
            }
            showAlert('pw-alert', 'pw-alert-text', err.message || "Parolni o'zgartirishda xatolik");
        } finally {
            setButtonLoading(pwSaveBtn, false);
        }
    });

    // ==================================================================
    // 4. MA'LUMOTLAR — CSV
    // ==================================================================

    const csvBtn = document.getElementById('csv-btn');

    csvBtn?.addEventListener('click', async () => {
        hideAlert('csv-alert');
        setButtonLoading(csvBtn, true, 'Tayyorlanmoqda...');

        try {
            // ❗ Oddiy <a href> ishlamaydi: endpoint Authorization header
            //    talab qiladi. Tokenni manzil satriga qo'yish esa uni
            //    brauzer tarixiga va server loglariga tushiradi — shuning
            //    uchun fetch + blob.
            const token = localStorage.getItem('token');
            const res = await fetch(`${api.baseUrl}/api/trades/export.csv`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                let msg = `Server xatolik qaytardi (${res.status})`;
                try { msg = (await res.json())?.message || msg; } catch { /* JSON emas */ }
                throw new Error(msg);
            }

            const blob = await res.blob();

            // Fayl nomini serverning Content-Disposition'idan olamiz
            const cd = res.headers.get('Content-Disposition') || '';
            // Zaxira nom ham sanali bo'lsin: header o'qilmagan holatda
            // (masalan proxy uni olib tashlasa) fayl "trading-jurnal.csv"
            // bo'lib qolib, oldingi yuklamani bosib ketmasligi uchun.
            const today = new Date().toISOString().slice(0, 10);
            const name = /filename="?([^"]+)"?/.exec(cd)?.[1]
                || `trading-jurnal-${today}.csv`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            // Blob xotirada qolib ketmasin
            URL.revokeObjectURL(url);

            showAlert('csv-alert', 'csv-alert-text', `Fayl yuklandi: ${name}`, 'success');
        } catch (err) {
            console.error('CSV yuklab olishda xatolik:', err);
            showAlert('csv-alert', 'csv-alert-text', err.message || S['data.exportError']);
        } finally {
            setButtonLoading(csvBtn, false);
        }
    });

    // ==================================================================
    // 5. XAVFLI ZONA — AKKAUNTNI O'CHIRISH
    // ==================================================================

    const delConfirmBtn = document.getElementById('del-confirm-btn');

    document.getElementById('del-open-btn')?.addEventListener('click', () => {
        hideAlert('del-alert');
        togglePanel('del-panel', true, 'del-email');
    });

    document.getElementById('del-cancel-btn')?.addEventListener('click', () => {
        togglePanel('del-panel', false);
        const input = document.getElementById('del-email');
        if (input) input.value = '';
        clearFieldErrors(['del-email']);
        hideAlert('del-alert');
    });

    delConfirmBtn?.addEventListener('click', async () => {
        hideAlert('del-alert');
        clearFieldErrors(['del-email']);

        const typed = (document.getElementById('del-email')?.value || '').trim();

        // Brauzerda ham tekshiramiz — serverga behuda so'rov ketmasin
        // (o'chirish endpointi soatda faqat 3 ta urinishga ruxsat beradi).
        if (typed.toLowerCase() !== (user?.email || '').toLowerCase()) {
            setFieldError('del-email', S['danger.deleteMismatch']);
            return;
        }

        setButtonLoading(delConfirmBtn, true, S['danger.deleting']);
        try {
            await api.delete('/auth/account', { email: typed });

            // Sessiyani to'liq tozalaymiz — endi bu token hech narsaga yaramaydi
            clearProfile();
            clearTrades();
            ['token', 'username', 'user', 'profile', 'isOnboarded', 'isVerified']
                .forEach(k => localStorage.removeItem(k));
            try { sessionStorage.clear(); } catch { /* private rejim */ }

            showAlert('del-alert', 'del-alert-text', S['danger.deleted'], 'success');
            setTimeout(() => { window.location.href = 'index.html'; }, 1200);
        } catch (err) {
            console.error("Akkauntni o'chirishda xatolik:", err);
            showAlert('del-alert', 'del-alert-text', err.message || "O'chirishda xatolik");
            setButtonLoading(delConfirmBtn, false);
        }
    });

    // Yozishni boshlaganda o'sha maydon xatosini olib tashlaymiz
    [...PW_FIELDS, 'em-new', 'em-code', 'del-email'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => clearFieldErrors([id]));
    });
});
