const nodemailer = require('nodemailer');

// ==========================================================================
// EMAIL YUBORISH
//
// Provayder EMAIL_PROVIDER env bilan tanlanadi:
//   gmail  (default) — nodemailer + Gmail SMTP (GMAIL_USER, GMAIL_APP_PASSWORD)
//   brevo            — Brevo HTTP API (BREVO_API_KEY)
//
// Tanlangan provayder sozlanmagan bo'lsa — kod SERVER KONSOLIGA chiqadi.
// Shu sababli lokal dev'da hech qanday kalit kerak bo'lmaydi.
// ==========================================================================

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

let cachedTransport = null;

/** Qaysi provayder haqiqatan ishlashga tayyor? */
function resolveProvider() {
    const requested = (process.env.EMAIL_PROVIDER || 'gmail').trim().toLowerCase();

    if (requested === 'gmail') {
        if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return 'gmail';
        console.warn("GMAIL_USER/GMAIL_APP_PASSWORD topilmadi — email konsol rejimida ishlaydi");
        return 'console';
    }

    if (requested === 'brevo') {
        if (process.env.BREVO_API_KEY) return 'brevo';
        console.warn("BREVO_API_KEY topilmadi — email konsol rejimida ishlaydi");
        return 'console';
    }

    console.warn(`EMAIL_PROVIDER="${requested}" tanilmadi — email konsol rejimida ishlaydi`);
    return 'console';
}

/** Jo'natuvchi nomi va manzili */
function resolveFrom() {
    const name = process.env.EMAIL_FROM_NAME || 'TradeJournal';
    const address = process.env.EMAIL_FROM || process.env.GMAIL_USER || 'no-reply@tradejournal.local';
    return { name, address };
}

/** Gmail SMTP transportini bir marta yaratib keshlaydi */
function getGmailTransport() {
    if (!cachedTransport) {
        cachedTransport = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                // Oddiy Gmail paroli emas — "App Password" bo'lishi shart
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });
    }
    return cachedTransport;
}

// ---------------------------------------------------------------- SHABLON

/** HTML ga tushadigan matnni xavfsizlaydi */
function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const PURPOSE_TEXT = {
    verify_email: {
        subject: 'TradeJournal — email tasdiqlash kodi',
        heading: 'Emailingizni tasdiqlang',
        intro: "Ro'yxatdan o'tishni yakunlash uchun quyidagi kodni saytga kiriting:",
    },
    reset_password: {
        subject: 'TradeJournal — parolni tiklash kodi',
        heading: 'Parolni tiklash',
        intro: "Yangi parol o'rnatish uchun quyidagi kodni saytga kiriting:",
    },
};

/**
 * Kod xatining HTML va matnli variantini quradi.
 * Email mijozlari <style> blokini tashlab yuboradi — shuning uchun
 * barcha CSS inline yozilgan.
 */
function buildCodeEmail(code, purpose, username) {
    const t = PURPOSE_TEXT[purpose] || PURPOSE_TEXT.verify_email;
    const safeName = escapeHtml(username || '');
    const greeting = safeName ? `Salom, <strong>${safeName}</strong>!` : 'Salom!';

    const html = [
        '<!DOCTYPE html>',
        '<html lang="uz">',
        '<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">',
        '  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">',
        '    <tr><td align="center">',
        '      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,.08);">',

        '        <tr><td style="background:#2563eb;padding:24px 28px;text-align:center;">',
        '          <div style="font-size:21px;font-weight:700;color:#ffffff;letter-spacing:-.3px;">TradeJournal</div>',
        '          <div style="font-size:13px;color:#dbeafe;margin-top:4px;">Savdo jurnali va tahlil platformasi</div>',
        '        </td></tr>',

        '        <tr><td style="padding:30px 28px 8px;">',
        `          <h1 style="margin:0 0 14px;font-size:19px;color:#0f172a;">${t.heading}</h1>`,
        `          <p style="margin:0 0 6px;font-size:14px;color:#334155;line-height:1.6;">${greeting}</p>`,
        `          <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">${t.intro}</p>`,
        '        </td></tr>',

        '        <tr><td style="padding:22px 28px;">',
        '          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;text-align:center;">',
        `            <div style="font-family:Courier New,Courier,monospace;font-size:38px;font-weight:700;letter-spacing:10px;color:#2563eb;">${escapeHtml(code)}</div>`,
        '          </div>',
        '        </td></tr>',

        '        <tr><td style="padding:0 28px 26px;">',
        '          <p style="margin:0 0 10px;font-size:13px;color:#dc2626;font-weight:600;">Kod 10 daqiqa amal qiladi.</p>',
        '          <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">',
        "            Kodni hech kimga aytmang. Agar bu so'rovni siz yubormagan bo'lsangiz,",
        "            bu xatni e'tiborsiz qoldiring — hisobingizda hech narsa o'zgarmaydi.",
        '          </p>',
        '        </td></tr>',

        '        <tr><td style="background:#f8fafc;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0;">',
        '          <div style="font-size:12px;color:#94a3b8;">Bu xat avtomatik yuborilgan, javob yozmang.</div>',
        '        </td></tr>',

        '      </table>',
        '    </td></tr>',
        '  </table>',
        '</body>',
        '</html>',
    ].join('\n');

    const text = [
        `TradeJournal — ${t.heading}`,
        '',
        t.intro,
        '',
        `KOD: ${code}`,
        '',
        "Kod 10 daqiqa amal qiladi. Kodni hech kimga aytmang.",
    ].join('\n');

    return { subject: t.subject, html, text };
}

// ---------------------------------------------------------------- YUBORISH

/**
 * Bir martalik kodni emailga yuboradi.
 * Hech qachon exception tashlamaydi — { ok, provider } qaytaradi,
 * shunda email xatosi register/login oqimini to'xtatib qo'ymaydi.
 */
async function sendVerificationCode(email, code, purpose = 'verify_email', username = '') {
    const provider = resolveProvider();
    const { subject, html, text } = buildCodeEmail(code, purpose, username);
    const from = resolveFrom();

    if (provider === 'console') {
        console.log('\n' + '='.repeat(58));
        console.log('EMAIL KONSOL REJIMI (provayder sozlanmagan)');
        console.log(`   Kimga : ${email}`);
        console.log(`   Maqsad: ${purpose}`);
        console.log(`   KOD   : ${code}`);
        console.log('='.repeat(58) + '\n');
        return { ok: true, provider: 'console' };
    }

    try {
        if (provider === 'gmail') {
            await getGmailTransport().sendMail({
                from: `"${from.name}" <${from.address}>`,
                to: email,
                subject,
                text,
                html,
            });
            return { ok: true, provider: 'gmail' };
        }

        // brevo
        const res = await fetch(BREVO_ENDPOINT, {
            method: 'POST',
            headers: {
                'api-key': process.env.BREVO_API_KEY,
                'Content-Type': 'application/json',
                accept: 'application/json',
            },
            body: JSON.stringify({
                sender: { name: from.name, email: from.address },
                to: [{ email }],
                subject,
                htmlContent: html,
                textContent: text,
            }),
        });

        if (!res.ok) {
            const body = await res.text();
            console.error(`Brevo xatosi (${res.status}):`, body.slice(0, 300));
            return { ok: false, provider: 'brevo' };
        }
        return { ok: true, provider: 'brevo' };

    } catch (err) {
        console.error(`Email yuborishda xatolik (${provider}):`, err.message);
        // Fallback: xat ketmasa ham kod konsolda qolsin, aks holda
        // foydalanuvchi butunlay tiqilib qoladi
        console.log(`[fallback] ${email} uchun kod: ${code}`);
        return { ok: false, provider };
    }
}

module.exports = {
    sendVerificationCode,
    buildCodeEmail,
    resolveProvider,
    escapeHtml,
};
