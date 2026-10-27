// ==========================================================================
// RO'YXATDAN O'TISH SAHIFASI
// Faqat email, parol, parol takrori va shartlar checkbox'i majburiy.
// Profil maydonlari (1- va 2-bo'lim) ixtiyoriy va js/profile-fields.js dan.
// ==========================================================================

import api from './api.js';
import {
    profileSectionsHtml,
    initProfileFields,
    readProfileFields,
    validateProfileFields,
} from './profile-fields.js';
import {
    redirectTo,
    saveVerifySession,
    setButtonLoading,
    showAlert,
    hideAlert,
    setFieldError,
    clearFieldErrors,
    initPasswordToggles,
    initPasswordStrength,
    initGoogleAuth,
    EMAIL_RE,
} from './auth-flow.js';

const LOGIN_FIELDS = ['email', 'password', 'password2', 'accept-terms'];

document.addEventListener('DOMContentLoaded', () => {
    // Allaqachon kirgan bo'lsa — bu sahifada ishi yo'q
    if (localStorage.getItem('token')) {
        redirectTo('dashboard.html');
        return;
    }

    // 1- va 2-bo'limni joylashtiramiz
    const holder = document.getElementById('profile-sections');
    if (holder) holder.innerHTML = profileSectionsHtml(1);

    initProfileFields();
    initPasswordToggles();
    initPasswordStrength('password', 'pw-strength-fill', 'pw-strength-label');

    if (window.lucide) lucide.createIcons();

    initGoogleAuth(msg => showAlert('reg-alert', 'reg-alert-text', msg));

    // ------------------------------------------------------------- SUBMIT

    const form = document.getElementById('register-form');
    const submitBtn = document.getElementById('reg-submit');

    /** Majburiy maydonlarni tekshiradi */
    function validateLoginFields() {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const password2 = document.getElementById('password2').value;
        const accepted = document.getElementById('accept-terms').checked;

        let valid = true;

        if (!email) {
            setFieldError('email', 'Email kiritilishi shart');
            valid = false;
        } else if (!EMAIL_RE.test(email)) {
            setFieldError('email', 'Email formati noto\'g\'ri (masalan: ism@example.com)');
            valid = false;
        }

        if (!password) {
            setFieldError('password', 'Parol kiritilishi shart');
            valid = false;
        } else if (password.length < 8) {
            setFieldError('password', 'Parol kamida 8 belgidan iborat bo\'lishi kerak');
            valid = false;
        }

        if (!password2) {
            setFieldError('password2', 'Parolni takrorlang');
            valid = false;
        } else if (password && password !== password2) {
            setFieldError('password2', 'Parollar mos kelmadi');
            valid = false;
        }

        if (!accepted) {
            const err = document.getElementById('err-accept-terms');
            if (err) {
                err.textContent = 'Davom etish uchun shartlarga rozilik bildiring';
                err.classList.add('show');
            }
            valid = false;
        }

        return valid;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        hideAlert('reg-alert');
        clearFieldErrors(LOGIN_FIELDS);
        const termsErr = document.getElementById('err-accept-terms');
        if (termsErr) termsErr.classList.remove('show');

        const loginOk = validateLoginFields();
        const profileOk = validateProfileFields();
        if (!loginOk || !profileOk) {
            showAlert('reg-alert', 'reg-alert-text', 'Formada xatolar bor — belgilangan maydonlarni tekshiring.');
            return;
        }

        // Profil maydonlari + kirish ma'lumotlari
        const payload = {
            ...readProfileFields(),
            email: document.getElementById('email').value.trim().toLowerCase(),
            password: document.getElementById('password').value,
            acceptedTerms: true,
        };

        setButtonLoading(submitBtn, true, 'Ro\'yxatdan o\'tilmoqda...');

        try {
            const data = await api.post('/auth/register', payload, { noAuth: true });

            // Access token BERILMAYDI — avval email tasdiqlanadi
            saveVerifySession(data.verifyToken, data.email);
            redirectTo('verify.html');

        } catch (err) {
            console.error('Registratsiya xatoligi:', err);

            // Email band bo'lsa — maydon ostida ham ko'rsatamiz
            if (/ro'yxatdan o'tgan|band/i.test(err.message || '')) {
                setFieldError('email', err.message);
            }

            showAlert('reg-alert', 'reg-alert-text', err.message || 'Ro\'yxatdan o\'tishda xatolik yuz berdi');
            setButtonLoading(submitBtn, false);
        }
    });

    // Yozishni boshlaganda o'sha maydon xatosini olib tashlaymiz
    LOGIN_FIELDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const evt = el.type === 'checkbox' ? 'change' : 'input';
        el.addEventListener(evt, () => clearFieldErrors([id]));
    });
});
