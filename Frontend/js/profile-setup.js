// ==========================================================================
// PROFIL TO'LDIRISH (profile-setup.html)
//
// Google orqali birinchi marta kirgan foydalanuvchi shu sahifaga tushadi
// (isOnboarded === false). Register formasining Shaxsiy + Treyding
// qismlari, email/parolsiz.
//
// ❗ "Keyinroq to'ldiraman" ham PUT /auth/profile chaqiradi — backend
//    isOnboarded = true qiladi. Busiz dashboard yana shu sahifaga
//    qaytarib, cheksiz halqa yuzaga kelardi.
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
    redirectTo,
    setButtonLoading,
    showAlert,
    hideAlert,
} from './auth-flow.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Access token kerak — bu sahifa login qilingandan keyin ko'rinadi
    if (!localStorage.getItem('token')) {
        redirectTo('login.html');
        return;
    }

    const holder = document.getElementById('profile-sections');
    if (holder) holder.innerHTML = profileSectionsHtml(1);

    initProfileFields();
    if (window.lucide) lucide.createIcons();

    const form = document.getElementById('profile-setup-form');
    const submitBtn = document.getElementById('ps-submit');
    const skipBtn = document.getElementById('ps-skip');

    // Google'dan kelgan ism/avatar bo'lsa — formani oldindan to'ldiramiz
    try {
        const user = await api.get('/auth/profile');

        if (!user.isVerified) {
            redirectTo('verify.html');
            return;
        }
        // Profil allaqachon to'ldirilgan — bu sahifada ishi yo'q
        if (user.isOnboarded) {
            redirectTo('dashboard.html');
            return;
        }

        fillProfileFields(user);

        // Google username'ini ism/familiyaga bo'lib qo'yamiz (bo'sh bo'lsa)
        if (!user.firstName && !user.lastName && user.username) {
            const parts = user.username.trim().split(/\s+/);
            const first = document.getElementById('pf-firstName');
            const last = document.getElementById('pf-lastName');
            if (first && !first.value) first.value = parts[0] || '';
            if (last && !last.value && parts.length > 1) last.value = parts.slice(1).join(' ');
        }

        const greeting = document.getElementById('ps-greeting');
        if (greeting && user.username) {
            greeting.textContent = `Salom, ${user.username}! `;
        }

    } catch (err) {
        console.error('Profil yuklashda xatolik:', err);
        if (err.status === 401) {
            localStorage.removeItem('token');
            redirectTo('login.html');
            return;
        }
        showAlert('ps-alert', 'ps-alert-text',
            err.message || 'Profilni yuklashda xatolik. Maydonlarni qo\'lda to\'ldirishingiz mumkin.');
    }

    // --------------------------------------------------------------- SAQLASH

    async function save(payload, button, loadingText) {
        hideAlert('ps-alert');
        setButtonLoading(button, true, loadingText);

        try {
            await api.put('/auth/profile', payload);
            redirectTo('dashboard.html');
        } catch (err) {
            console.error('Profilni saqlashda xatolik:', err);
            showAlert('ps-alert', 'ps-alert-text', err.message || 'Saqlashda xatolik yuz berdi');
            setButtonLoading(button, false);

            if (err.status === 401) {
                localStorage.removeItem('token');
                setTimeout(() => redirectTo('login.html'), 2000);
            }
        }
    }

    form?.addEventListener('submit', (e) => {
        e.preventDefault();

        if (!validateProfileFields()) {
            showAlert('ps-alert', 'ps-alert-text', 'Formada xatolar bor — belgilangan maydonlarni tekshiring.');
            return;
        }

        save(readProfileFields(), submitBtn, 'Saqlanmoqda...');
    });

    // Bo'sh body — backend isOnboarded = true qiladi
    skipBtn?.addEventListener('click', () => {
        save({}, skipBtn, 'Yuklanmoqda...');
    });
});
