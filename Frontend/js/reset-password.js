// ==========================================================================
// PAROLNI TIKLASH — 3 QADAM
//   1) email       -> POST /auth/forgot-password (har doim 200)
//   2) 6 xonali kod -> mijozda yig'iladi
//   3) yangi parol  -> POST /auth/reset-password { email, code, newPassword }
//
// Kod faqat 3-qadamda serverda tekshiriladi (bitta endpoint). Kod xato
// bo'lsa foydalanuvchi 2-qadamga qaytariladi.
// ==========================================================================

import api from './api.js';
import { initCodeInput, createResendTimer } from './code-input.js';
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

const RESEND_SECONDS = 60;

document.addEventListener('DOMContentLoaded', () => {
    let email = '';

    const sendBtn   = document.getElementById('rp-send');
    const codeNext  = document.getElementById('rp-code-next');
    const submitBtn = document.getElementById('rp-submit');
    const resendBtn = document.getElementById('rp-resend');
    const emailInput = document.getElementById('rp-email');

    initPasswordToggles();
    initPasswordStrength('rp-password', 'rp-strength-fill', 'rp-strength-label');
    if (window.lucide) lucide.createIcons();

    const code = initCodeInput('rp-code-boxes', {
        onComplete: () => goToStep(3),
        onInput: () => hideAlert('rp-alert'),
    });

    const resendTimer = createResendTimer(resendBtn, RESEND_SECONDS);

    // ------------------------------------------------------------- QADAMLAR

    function goToStep(n) {
        hideAlert('rp-alert');

        ['1', '2', '3', 'done'].forEach(id => {
            document.getElementById(`panel-${id}`)?.classList.remove('active');
        });
        document.getElementById(`panel-${n}`)?.classList.add('active');

        // Qadam indikatori
        [1, 2, 3].forEach(i => {
            const dot = document.getElementById(`dot-${i}`);
            if (!dot) return;
            dot.classList.remove('active', 'done');
            if (n === 'done' || i < n) dot.classList.add('done');
            else if (i === n) dot.classList.add('active');
        });
        [1, 2].forEach(i => {
            const line = document.getElementById(`line-${i}`);
            if (line) line.classList.toggle('done', n === 'done' || i < n);
        });

        if (n === 2) code.focus();
        if (n === 3) document.getElementById('rp-password')?.focus();
        if (window.lucide) lucide.createIcons();
    }

    // --------------------------------------------------- 1-QADAM: EMAIL

    /** Kod so'raydi. Javob har doim 200 — email mavjudligi oshkor qilinmaydi. */
    async function requestCode(isResend = false) {
        const btn = isResend ? resendBtn : sendBtn;

        if (isResend) {
            resendBtn.disabled = true;
            resendBtn.textContent = 'Yuborilmoqda...';
        } else {
            setButtonLoading(btn, true, 'Yuborilmoqda...');
        }

        try {
            await api.post('/auth/forgot-password', { email }, { noAuth: true });

            const label = document.getElementById('rp-email-label');
            if (label) label.textContent = email;

            if (!isResend) {
                setButtonLoading(btn, false);
                goToStep(2);
            } else {
                code.clear();
            }

            showAlert('rp-alert', 'rp-alert-text',
                `Agar ${email} ro'yxatdan o'tgan bo'lsa, kod yuborildi.`, 'info');
            resendTimer.start(RESEND_SECONDS);

        } catch (err) {
            console.error('forgot-password xatoligi:', err);
            showAlert('rp-alert', 'rp-alert-text', err.message || 'Kod yuborishda xatolik');
            if (isResend) resendTimer.start(RESEND_SECONDS);
            else setButtonLoading(btn, false);
        }
    }

    sendBtn?.addEventListener('click', async () => {
        hideAlert('rp-alert');
        clearFieldErrors(['rp-email']);

        const value = (emailInput?.value || '').trim().toLowerCase();

        if (!value) {
            setFieldError('rp-email', 'Email kiritilishi shart');
            return;
        }
        if (!EMAIL_RE.test(value)) {
            setFieldError('rp-email', 'Email formati noto\'g\'ri');
            return;
        }

        email = value;
        await requestCode(false);
    });

    emailInput?.addEventListener('input', () => clearFieldErrors(['rp-email']));
    emailInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); sendBtn?.click(); }
    });

    // ----------------------------------------------------- 2-QADAM: KOD

    codeNext?.addEventListener('click', () => {
        if (code.read().length !== code.length) {
            code.setError(true);
            showAlert('rp-alert', 'rp-alert-text', '6 xonali kodni to\'liq kiriting');
            return;
        }
        goToStep(3);
    });

    resendBtn?.addEventListener('click', () => requestCode(true));

    document.getElementById('rp-back-1')?.addEventListener('click', () => {
        code.clear();
        resendTimer.stop();
        goToStep(1);
        emailInput?.focus();
    });

    // --------------------------------------------- 3-QADAM: YANGI PAROL

    submitBtn?.addEventListener('click', async () => {
        hideAlert('rp-alert');
        clearFieldErrors(['rp-password', 'rp-password2']);

        const pw1 = document.getElementById('rp-password').value;
        const pw2 = document.getElementById('rp-password2').value;

        let valid = true;
        if (!pw1) {
            setFieldError('rp-password', 'Yangi parol kiritilishi shart');
            valid = false;
        } else if (pw1.length < 8) {
            setFieldError('rp-password', 'Parol kamida 8 belgidan iborat bo\'lishi kerak');
            valid = false;
        }
        if (!pw2) {
            setFieldError('rp-password2', 'Parolni takrorlang');
            valid = false;
        } else if (pw1 && pw1 !== pw2) {
            setFieldError('rp-password2', 'Parollar mos kelmadi');
            valid = false;
        }
        if (!valid) return;

        setButtonLoading(submitBtn, true, 'Saqlanmoqda...');

        try {
            await api.post('/auth/reset-password', {
                email,
                code: code.read(),
                newPassword: pw1,
            }, { noAuth: true });

            setButtonLoading(submitBtn, false);
            goToStep('done');

        } catch (err) {
            console.error('reset-password xatoligi:', err);
            setButtonLoading(submitBtn, false);
            showAlert('rp-alert', 'rp-alert-text', err.message || 'Parolni tiklashda xatolik');

            // Kod bilan bog'liq xato bo'lsa — 2-qadamga qaytaramiz
            if (/kod/i.test(err.message || '')) {
                code.setError(true);
                goToStep(2);
                showAlert('rp-alert', 'rp-alert-text', err.message);
            }
        }
    });

    document.getElementById('rp-password2')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submitBtn?.click(); }
    });

    emailInput?.focus();
});
