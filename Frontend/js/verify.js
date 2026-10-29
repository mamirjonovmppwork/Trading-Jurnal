// ==========================================================================
// EMAIL TASDIQLASH SAHIFASI
// 6 katakli kod (js/code-input.js), 60s qayta yuborish taymeri,
// emailni o'zgartirish.
//
// Bu sahifa purpose:'verify' tokeni bilan ishlaydi (sessionStorage'da).
// Access token faqat kod to'g'ri bo'lgandan keyin beriladi.
// ==========================================================================

import api from './api.js';
import { initCodeInput, createResendTimer } from './code-input.js';
import {
    redirectTo,
    getVerifyToken,
    getVerifyEmail,
    saveVerifySession,
    clearVerifySession,
    finishAccessLogin,
    setButtonLoading,
    showAlert,
    hideAlert,
    setFieldError,
    clearFieldErrors,
    EMAIL_RE,
} from './auth-flow.js';

const RESEND_SECONDS = 60;

document.addEventListener('DOMContentLoaded', () => {
    const verifyToken = getVerifyToken();

    // Tasdiqlash sessiyasi yo'q — sahifaga to'g'ridan-to'g'ri kirilgan
    if (!verifyToken) {
        redirectTo('login.html');
        return;
    }

    const emailLabel = document.getElementById('vf-email');
    if (emailLabel) emailLabel.textContent = getVerifyEmail() || '—';

    const submitBtn = document.getElementById('vf-submit');
    const resendBtn = document.getElementById('vf-resend');

    if (window.lucide) lucide.createIcons();

    const code = initCodeInput('code-boxes', {
        onComplete: () => submit(),
        onInput: () => hideAlert('vf-alert'),
    });

    const resendTimer = createResendTimer(resendBtn, RESEND_SECONDS);

    /** 401 — tasdiqlash tokeni muddati tugagan */
    function handleExpiredSession() {
        clearVerifySession();
        setTimeout(() => redirectTo('login.html'), 2200);
    }

    // --------------------------------------------------------- TASDIQLASH

    async function submit() {
        hideAlert('vf-alert');

        const value = code.read();
        if (value.length !== code.length) {
            code.setError(true);
            showAlert('vf-alert', 'vf-alert-text', '6 xonali kodni to\'liq kiriting');
            return;
        }

        setButtonLoading(submitBtn, true, 'Tekshirilmoqda...');

        try {
            const data = await api.post('/auth/verify-code', { code: value }, { token: verifyToken });
            // Access token olindi -> dashboard yoki profile-setup
            finishAccessLogin(data);
        } catch (err) {
            console.error('Verify xatoligi:', err);
            code.setError(true);
            showAlert('vf-alert', 'vf-alert-text', err.message || 'Kodni tasdiqlashda xatolik');
            setButtonLoading(submitBtn, false);

            if (err.status === 401) {
                handleExpiredSession();
                return;
            }
            code.clear();
        }
    }

    submitBtn?.addEventListener('click', submit);
    code.focus();

    // Sahifa ochilganda kod allaqachon yuborilgan — darhol taymer
    resendTimer.start(RESEND_SECONDS);

    // ------------------------------------------------- QAYTA YUBORISH

    resendBtn?.addEventListener('click', async () => {
        hideAlert('vf-alert');
        resendBtn.disabled = true;
        resendBtn.textContent = 'Yuborilmoqda...';

        try {
            const data = await api.post('/auth/resend-code', {}, { token: verifyToken });

            if (data.email && emailLabel) emailLabel.textContent = data.email;
            saveVerifySession(verifyToken, data.email);
            code.clear();
            showAlert('vf-alert', 'vf-alert-text',
                'Yangi kod yuborildi. Pochtangizni tekshiring.', 'success');
            resendTimer.start(data.retryAfter || RESEND_SECONDS);

        } catch (err) {
            console.error('Resend xatoligi:', err);
            showAlert('vf-alert', 'vf-alert-text', err.message || 'Kodni qayta yuborishda xatolik');

            // Server 429 bilan "N sekund kuting" deyishi mumkin
            const wait = err.body?.retryAfter;
            resendTimer.start(typeof wait === 'number' ? wait : RESEND_SECONDS);

            if (err.status === 401) handleExpiredSession();
        }
    });

    // --------------------------------------------- EMAILNI O'ZGARTIRISH

    const panelCode = document.getElementById('panel-code');
    const panelEmail = document.getElementById('panel-email');
    const ceSubmit = document.getElementById('ce-submit');
    const newEmailInput = document.getElementById('new-email');

    function showPanel(which) {
        panelCode?.classList.toggle('active', which === 'code');
        panelEmail?.classList.toggle('active', which === 'email');
        if (window.lucide) lucide.createIcons();
    }

    document.getElementById('vf-change-email')?.addEventListener('click', () => {
        hideAlert('ce-alert');
        clearFieldErrors(['new-email']);
        if (newEmailInput) newEmailInput.value = '';
        showPanel('email');
        newEmailInput?.focus();
    });

    document.getElementById('ce-back')?.addEventListener('click', () => {
        hideAlert('ce-alert');
        showPanel('code');
        code.focus();
    });

    ceSubmit?.addEventListener('click', async () => {
        hideAlert('ce-alert');
        clearFieldErrors(['new-email']);

        const newEmail = (newEmailInput?.value || '').trim().toLowerCase();

        if (!newEmail) {
            setFieldError('new-email', 'Email kiritilishi shart');
            return;
        }
        if (!EMAIL_RE.test(newEmail)) {
            setFieldError('new-email', 'Email formati noto\'g\'ri');
            return;
        }

        setButtonLoading(ceSubmit, true, 'Yuborilmoqda...');

        try {
            const data = await api.post('/auth/change-email', { newEmail }, { token: verifyToken });

            saveVerifySession(verifyToken, data.email);
            if (emailLabel) emailLabel.textContent = data.email;

            code.clear();
            showPanel('code');
            setButtonLoading(ceSubmit, false);
            showAlert('vf-alert', 'vf-alert-text',
                `Kod ${data.email} manziliga yuborildi.`, 'success');
            resendTimer.start(RESEND_SECONDS);

        } catch (err) {
            console.error('change-email xatoligi:', err);
            setFieldError('new-email', err.message || 'Emailni o\'zgartirishda xatolik');
            showAlert('ce-alert', 'ce-alert-text', err.message || 'Emailni o\'zgartirishda xatolik');
            setButtonLoading(ceSubmit, false);

            if (err.status === 401) handleExpiredSession();
        }
    });

    newEmailInput?.addEventListener('input', () => clearFieldErrors(['new-email']));

    // "Kirish" havolasi — tasdiqlash sessiyasini tozalab ketadi
    document.getElementById('vf-logout')?.addEventListener('click', () => {
        clearVerifySession();
    });
});
