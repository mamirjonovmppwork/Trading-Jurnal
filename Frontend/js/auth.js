// ==========================================================================
// KIRISH SAHIFASI (login.html)
//
// Register formasi endi js/register.js da — bu fayl faqat login va
// Google bilan kirish uchun.
//
// Tasdiqlanmagan foydalanuvchi to'g'ri parol kiritsa, server 403 +
// needsVerification qaytaradi va yangi kod yuboradi -> verify.html.
// ==========================================================================

import api from './api.js';
import {
    redirectTo,
    finishAccessLogin,
    routeIfNeedsVerification,
    setButtonLoading,
    showAlert,
    hideAlert,
    setFieldError,
    clearFieldErrors,
    initGoogleAuth,
    EMAIL_RE,
} from './auth-flow.js';

document.addEventListener('DOMContentLoaded', () => {
    // Allaqachon kirgan bo'lsa — dashboard'ga
    if (localStorage.getItem('token')) {
        redirectTo('dashboard.html');
        return;
    }

    if (window.lucide) lucide.createIcons();

    initGoogleAuth(msg => showAlert('login-alert', 'login-alert-text', msg));

    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        hideAlert('login-alert');
        clearFieldErrors(['email', 'password']);

        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value;
        const submitBtn = loginForm.querySelector('.submit-btn');

        let valid = true;
        if (!email) {
            setFieldError('email', 'Email kiritilishi shart');
            valid = false;
        } else if (!EMAIL_RE.test(email)) {
            setFieldError('email', 'Email formati noto\'g\'ri');
            valid = false;
        }
        if (!password) {
            setFieldError('password', 'Parol kiritilishi shart');
            valid = false;
        }
        if (!valid) return;

        setButtonLoading(submitBtn, true, 'Kirilmoqda...');

        try {
            const data = await api.post('/auth/login', { email, password }, { noAuth: true });
            finishAccessLogin(data);

        } catch (err) {
            console.error('Login xatoligi:', err);

            // Email tasdiqlanmagan — server yangi kod yubordi, verify.html ga
            if (routeIfNeedsVerification(err)) return;

            showAlert('login-alert', 'login-alert-text', err.message || 'Login qilishda xatolik yuz berdi');
            setButtonLoading(submitBtn, false);
        }
    });

    ['email', 'password'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => clearFieldErrors([id]));
    });
});
