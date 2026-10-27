// ==========================================================================
// AUTH OQIMI — UMUMIY YORDAMCHILAR
// login.html, register.html, verify.html, reset-password.html va
// profile-setup.html bir xil yo'naltirish mantiqidan foydalanadi.
// ==========================================================================

import api from './api.js';

// Tasdiqlash tokeni sessionStorage'da — localStorage'da EMAS.
// Tab yopilganda o'chadi va API tokeni bilan aralashib ketmaydi.
const VERIFY_TOKEN_KEY = 'verifyToken';
const VERIFY_EMAIL_KEY = 'verifyEmail';

/** Netlify/Vercel va lokal uchun xavfsiz yo'naltirish */
export function redirectTo(page) {
    const path = window.location.pathname;
    if (path.includes('/Frontend/')) {
        window.location.href = `/Frontend/${page}`;
    } else {
        window.location.href = page;
    }
}

// ------------------------------------------------- TASDIQLASH SESSIYASI

export function saveVerifySession(verifyToken, email) {
    if (verifyToken) sessionStorage.setItem(VERIFY_TOKEN_KEY, verifyToken);
    if (email) sessionStorage.setItem(VERIFY_EMAIL_KEY, email);
}

export function getVerifyToken() {
    return sessionStorage.getItem(VERIFY_TOKEN_KEY);
}

export function getVerifyEmail() {
    return sessionStorage.getItem(VERIFY_EMAIL_KEY);
}

export function clearVerifySession() {
    sessionStorage.removeItem(VERIFY_TOKEN_KEY);
    sessionStorage.removeItem(VERIFY_EMAIL_KEY);
}

// ------------------------------------------------------- ACCESS SESSIYASI

/**
 * Access token olingach chaqiriladi.
 * Profil to'ldirilmagan bo'lsa profile-setup, aks holda dashboard.
 */
export function finishAccessLogin(data) {
    if (!data?.token) {
        throw { message: 'Serverdan token kelmadi' };
    }

    localStorage.setItem('token', data.token);
    if (data.username) localStorage.setItem('username', data.username);
    clearVerifySession();

    redirectTo(data.isOnboarded === false ? 'profile-setup.html' : 'dashboard.html');
}

/**
 * Login/register javobida needsVerification bo'lsa — tasdiqlash
 * sahifasiga o'tadi. true qaytarsa chaqiruvchi to'xtashi kerak.
 */
export function routeIfNeedsVerification(errOrData) {
    const body = errOrData?.body || errOrData;
    if (!body?.needsVerification) return false;

    saveVerifySession(body.verifyToken, body.email);
    redirectTo('verify.html');
    return true;
}

// ------------------------------------------------------------- UI YORDAM

/** Tugmani "yuklanmoqda" holatiga o'tkazadi/qaytaradi */
export function setButtonLoading(button, isLoading, loadingText = 'Yuklanmoqda...') {
    if (!button) return;
    if (isLoading) {
        if (!button.dataset.originalHtml) {
            button.dataset.originalHtml = button.innerHTML;
        }
        button.disabled = true;
        button.innerHTML = `<span class="btn-spinner"></span> <span>${loadingText}</span>`;
    } else {
        button.disabled = false;
        if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

/** .form-alert blokini ko'rsatadi */
export function showAlert(alertId, textId, message, type = 'error') {
    const box = document.getElementById(alertId);
    const text = document.getElementById(textId);
    if (text) text.textContent = message;
    if (box) {
        box.className = `form-alert ${type} show`;
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (window.lucide) window.lucide.createIcons();
}

export function hideAlert(alertId) {
    const box = document.getElementById(alertId);
    if (box) box.classList.remove('show');
}

/** Bitta maydon ostidagi xatoni ko'rsatadi */
export function setFieldError(fieldId, message) {
    const el = document.getElementById(fieldId);
    const err = document.getElementById(`err-${fieldId}`);
    el?.closest('.form-group')?.classList.add('has-error');
    if (err) {
        err.textContent = message;
        err.classList.add('show');
    }
}

/** Berilgan maydonlardagi xatolarni tozalaydi */
export function clearFieldErrors(fieldIds) {
    fieldIds.forEach(id => {
        const el = document.getElementById(id);
        const err = document.getElementById(`err-${id}`);
        el?.closest('.form-group')?.classList.remove('has-error');
        if (err) {
            err.textContent = '';
            err.classList.remove('show');
        }
    });
}

// ------------------------------------------------------------ PAROL UI

/** 👁 tugmalarini ishga tushiradi */
export function initPasswordToggles() {
    document.querySelectorAll('.pw-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.target);
            if (!input) return;
            const isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            btn.innerHTML = `<i data-lucide="${isHidden ? 'eye-off' : 'eye'}"></i>`;
            btn.setAttribute('aria-label', isHidden ? 'Parolni yashirish' : 'Parolni ko\'rsatish');
            if (window.lucide) window.lucide.createIcons();
        });
    });
}

/** Parol kuchliligini 0–4 oralig'ida baholaydi */
export function scorePassword(pw) {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return Math.min(score, 4);
}

const STRENGTH_LEVELS = [
    { label: 'Parol kuchliligi',   color: '#e2e8f0', width: '0%'   },
    { label: 'Juda zaif',          color: '#dc2626', width: '25%'  },
    { label: 'Zaif',               color: '#f59e0b', width: '50%'  },
    { label: 'Yaxshi',             color: '#3b82f6', width: '75%'  },
    { label: 'Kuchli',             color: '#16a34a', width: '100%' },
];

/** Kuchlilik indikatorini parol maydoniga ulaydi */
export function initPasswordStrength(inputId, fillId, labelId) {
    const input = document.getElementById(inputId);
    const fill = document.getElementById(fillId);
    const label = document.getElementById(labelId);
    if (!input || !fill || !label) return;

    input.addEventListener('input', () => {
        const level = STRENGTH_LEVELS[input.value ? scorePassword(input.value) : 0];
        fill.style.width = level.width;
        fill.style.background = level.color;
        label.textContent = level.label;
        label.style.color = input.value ? level.color : '#94a3b8';
    });
}

// ------------------------------------------------------------- GOOGLE

/**
 * Google tugmasini ulaydi. Inline skript 'google-auth-success'
 * eventini tarqatadi, biz shu yerda ushlaymiz.
 */
export function initGoogleAuth(onError) {
    window.addEventListener('google-auth-success', async (event) => {
        const credential = event.detail?.credential;
        if (!credential) {
            onError('Google tokeni olinmadi. Qaytadan urinib ko\'ring.');
            return;
        }

        try {
            const data = await api.post('/auth/google', { credential }, { noAuth: true });
            finishAccessLogin(data);
        } catch (err) {
            console.error('Google login xatoligi:', err);
            onError(err.message || 'Google orqali kirishda xatolik yuz berdi');
        }
    });
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
