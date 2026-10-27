// ==========================================================================
// SOZLAMALAR BO'LIMI (dashboard.html -> sec-sozlamalar)
//   - Profil: barcha ma'lumotlarni ko'rish va tahrirlash (email'dan tashqari)
//   - Parolni o'zgartirish: joriy parol + yangi parol x2
//
// Profil maydonlari register va profile-setup bilan bir xil manbadan
// (js/profile-fields.js) keladi.
// ==========================================================================

import api from './api.js';
import {
    profileSectionsHtml,
    initProfileFields,
    readProfileFields,
    fillProfileFields,
    validateProfileFields,
} from './profile-fields.js';
import {
    setButtonLoading,
    showAlert,
    hideAlert,
    setFieldError,
    clearFieldErrors,
    initPasswordToggles,
    initPasswordStrength,
} from './auth-flow.js';

const PW_FIELDS = ['st-current-password', 'st-new-password', 'st-new-password2'];

document.addEventListener('DOMContentLoaded', async () => {
    const section = document.getElementById('sec-sozlamalar');
    if (!section) return;
    if (!localStorage.getItem('token')) return; // dashboard.js login'ga yo'naltiradi

    // Profil maydonlarini joylashtiramiz
    const holder = section.querySelector('#profile-sections');
    if (holder) holder.innerHTML = profileSectionsHtml(1);

    initProfileFields();
    initPasswordToggles();
    initPasswordStrength('st-new-password', 'st-strength-fill', 'st-strength-label');
    if (window.lucide) lucide.createIcons();

    const profileForm = document.getElementById('settings-profile-form');
    const passwordForm = document.getElementById('settings-password-form');
    const saveBtn = document.getElementById('st-save');
    const pwSaveBtn = document.getElementById('pw-save');

    // ------------------------------------------------------------ YUKLASH

    /** Serverdan profilni olib formani to'ldiradi */
    async function loadProfile() {
        try {
            const user = await api.get('/auth/profile');

            const usernameEl = document.getElementById('st-username');
            const emailEl = document.getElementById('st-email');
            if (usernameEl) usernameEl.value = user.username || '';
            if (emailEl) emailEl.value = user.email || '';

            fillProfileFields(user);

            // Google orqali yaratilgan hisobda parol bo'lmasligi mumkin —
            // bunday holatda parolni o'zgartirish emas, YARATISH kerak.
            if (!user.hasPassword) {
                showAlert('pw-alert', 'pw-alert-text',
                    'Bu hisobda parol o\'rnatilmagan (Google orqali yaratilgan). '
                    + 'Parol yaratish uchun "Parolni unutdim" oqimidan foydalaning.',
                    'info');
            }
        } catch (err) {
            console.error('Sozlamalar: profil yuklashda xatolik:', err);
            showAlert('st-alert', 'st-alert-text', err.message || 'Profilni yuklashda xatolik');
        }
    }

    await loadProfile();

    // ------------------------------------------------------- PROFIL SAQLASH

    profileForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        hideAlert('st-alert');
        clearFieldErrors(['st-username']);

        const username = (document.getElementById('st-username')?.value || '').trim();

        if (username && (username.length < 2 || username.length > 30)) {
            setFieldError('st-username', 'Foydalanuvchi nomi 2–30 belgidan iborat bo\'lishi kerak');
            return;
        }
        if (!validateProfileFields()) {
            showAlert('st-alert', 'st-alert-text', 'Formada xatolar bor — belgilangan maydonlarni tekshiring.');
            return;
        }

        const payload = readProfileFields();
        if (username) payload.username = username;

        setButtonLoading(saveBtn, true, 'Saqlanmoqda...');

        try {
            const data = await api.put('/auth/profile', payload);

            // Sidebar'dagi ism ham yangilanadi
            const nameEl = document.getElementById('user-name');
            if (nameEl && data.user?.username) nameEl.innerText = data.user.username;
            if (data.user?.username) localStorage.setItem('username', data.user.username);

            if (data.user) fillProfileFields(data.user);

            showAlert('st-alert', 'st-alert-text', 'Profil muvaffaqiyatli saqlandi', 'success');
        } catch (err) {
            console.error('Profilni saqlashda xatolik:', err);
            showAlert('st-alert', 'st-alert-text', err.message || 'Saqlashda xatolik yuz berdi');
        } finally {
            setButtonLoading(saveBtn, false);
        }
    });

    // ----------------------------------------------------- PAROL O'ZGARTIRISH

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
            setFieldError('st-new-password', 'Parol kamida 8 belgidan iborat bo\'lishi kerak');
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

        setButtonLoading(pwSaveBtn, true, 'O\'zgartirilmoqda...');

        try {
            await api.put('/auth/password', { currentPassword: current, newPassword: next });

            passwordForm.reset();
            // Kuchlilik indikatorini nolga qaytaramiz
            const fill = document.getElementById('st-strength-fill');
            const label = document.getElementById('st-strength-label');
            if (fill) { fill.style.width = '0%'; fill.style.background = '#e2e8f0'; }
            if (label) { label.textContent = 'Parol kuchliligi'; label.style.color = '#94a3b8'; }

            showAlert('pw-alert', 'pw-alert-text', 'Parol muvaffaqiyatli o\'zgartirildi', 'success');
        } catch (err) {
            console.error('Parolni o\'zgartirishda xatolik:', err);

            if (/joriy parol/i.test(err.message || '')) {
                setFieldError('st-current-password', err.message);
            }
            showAlert('pw-alert', 'pw-alert-text', err.message || 'Parolni o\'zgartirishda xatolik');
        } finally {
            setButtonLoading(pwSaveBtn, false);
        }
    });

    // Yozishni boshlaganda o'sha maydon xatosini olib tashlaymiz
    [...PW_FIELDS, 'st-username'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => clearFieldErrors([id]));
    });
});
