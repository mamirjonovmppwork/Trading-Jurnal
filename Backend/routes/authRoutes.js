const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const User = require('../models/user');
const { verifyToken, verifyPendingToken } = require('../middleware/authMiddleware');
const { generateToken, generateVerifyToken } = require('../utils/jwt');
const { verifyGoogleToken } = require('../services/googleService');
const { sendVerificationCode } = require('../services/emailService');
const {
    validateRegister,
    validateLogin,
    validateVerifyCode,
    validateChangeEmail,
    validateForgotPassword,
    validateResetPassword,
    validateProfileUpdate,
    validatePasswordChange,
    handleDbValidationError,
} = require('../middleware/validate');

// ==========================================================================
// RATE LIMITERLAR — uchtasi alohida, har birining o'z bucket'i
// app.set('trust proxy', 1) server.js da o'rnatilgan.
// ==========================================================================

/**
 * LOGIN — 15 daqiqada 10 ta MUVAFFAQIYATSIZ urinish.
 *
 * skipSuccessfulRequests faqat status < 400 ni muvaffaqiyat deb biladi.
 * Bizda esa "parol to'g'ri, lekin email tasdiqlanmagan" holati 403
 * qaytaradi — ya'ni to'g'ri parol kiritgan foydalanuvchi o'zini bloklab
 * qo'yardi. requestWasSuccessful shu holatni ham muvaffaqiyat deb
 * hisoblaydi (res.locals.authOk route'da o'rnatiladi).
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (req, res) => res.statusCode < 400 || res.locals.authOk === true,
    message: { message: "Juda ko'p muvaffaqiyatsiz urinish. 15 daqiqadan keyin qayta urinib ko'ring." },
});

/** REGISTER — 1 soatda 5 ta */
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Ro'yxatdan o'tish urinishlari limiti tugadi. 1 soatdan keyin qayta urinib ko'ring." },
});

/** KOD BILAN ISHLASH — 15 daqiqada 10 ta (4 ta endpointga umumiy) */
const codeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Kod bilan juda ko'p urinish bo'ldi. 15 daqiqadan keyin qayta urinib ko'ring." },
});

// ==========================================================================
// KOD MEXANIZMI
// ==========================================================================

const CODE_TTL_MS         = 10 * 60 * 1000; // 10 daqiqa
const MAX_CODE_ATTEMPTS   = 5;
const RESEND_COOLDOWN_MS  = 60 * 1000;      // 60 sekund

/** Emailni bazaga yozishdan oldin bir xil ko'rinishga keltiradi */
function normalizeEmail(email) {
    return String(email ?? '').trim().toLowerCase();
}

/** 6 xonali kod — crypto.randomInt bilan (Math.random emas) */
function generateCode() {
    return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

/**
 * Foydalanuvchiga yangi kod biriktiradi (hash qilib).
 * Eski kod nima bo'lishidan qat'i nazar almashtiriladi — bir vaqtda
 * faqat bitta aktiv kod bo'ladi.
 */
async function issueCode(user, purpose, pendingEmail = null) {
    const code = generateCode();
    user.authCode = {
        codeHash: await bcrypt.hash(code, 10),
        purpose,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
        attempts: 0,
        pendingEmail,
        lastSentAt: new Date(),
    };
    return code;
}

/** authCode ni butunlay tozalaydi */
function clearCode(user) {
    user.authCode = {
        codeHash: null,
        purpose: null,
        expiresAt: null,
        attempts: 0,
        pendingEmail: null,
        lastSentAt: null,
    };
}

/**
 * Kelgan kodni tekshiradi. { ok, status, message } qaytaradi.
 * Muvaffaqiyatsiz urinishda attempts ni oshiradi va saqlaydi.
 */
async function checkCode(user, code, expectedPurpose) {
    const ac = user.authCode || {};

    if (!ac.codeHash || !ac.expiresAt) {
        return { ok: false, status: 400, message: 'Aktiv kod yo\'q. Yangi kod so\'rang.' };
    }
    // ❗ purpose tekshiruvi: email tasdiqlash kodi bilan parolni tiklash
    //    (va teskarisi) mumkin bo'lmasligi kerak
    if (ac.purpose !== expectedPurpose) {
        return { ok: false, status: 400, message: 'Bu kod boshqa amal uchun berilgan. Yangi kod so\'rang.' };
    }
    if (ac.expiresAt.getTime() < Date.now()) {
        return { ok: false, status: 400, message: 'Kod muddati tugagan. Yangi kod so\'rang.' };
    }
    if (ac.attempts >= MAX_CODE_ATTEMPTS) {
        return { ok: false, status: 429, message: 'Urinishlar soni tugadi. Yangi kod so\'rang.' };
    }

    const matches = await bcrypt.compare(String(code), ac.codeHash);
    if (!matches) {
        user.authCode.attempts = ac.attempts + 1;
        await user.save();
        const left = MAX_CODE_ATTEMPTS - user.authCode.attempts;
        return {
            ok: false,
            status: 400,
            message: left > 0
                ? `Kod noto'g'ri. Yana ${left} ta urinish qoldi.`
                : 'Kod noto\'g\'ri. Urinishlar tugadi, yangi kod so\'rang.',
        };
    }

    return { ok: true };
}

/** Profil maydonlarini body'dan modelga ko'chiradi (faqat kelganlarini) */
function applyProfileFields(user, b) {
    const text = (v) => String(v).trim();

    if (b.firstName !== undefined)        user.firstName = text(b.firstName);
    if (b.lastName !== undefined)         user.lastName = text(b.lastName);
    if (b.age !== undefined)              user.age = b.age === null || b.age === '' ? null : Number(b.age);
    if (b.phone !== undefined)            user.phone = text(b.phone);
    if (b.phoneCountryCode !== undefined) user.phoneCountryCode = text(b.phoneCountryCode);
    if (b.initialBalance !== undefined)   user.initialBalance = Number(b.initialBalance) || 0;
    if (b.tradingStyles !== undefined)    user.tradingStyles = b.tradingStyles;
    if (b.strategies !== undefined)       user.strategies = b.strategies;
    if (b.markets !== undefined)          user.markets = b.markets;
    if (b.experience !== undefined)       user.experience = b.experience || null;
    if (b.customStrategy !== undefined)   user.customStrategy = text(b.customStrategy);
}

/** Frontendga beriladigan xavfsiz foydalanuvchi obyekti */
function publicUser(user) {
    return {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        provider: user.provider,
        isVerified: user.isVerified,
        isOnboarded: user.isOnboarded,
        initialBalance: user.initialBalance,
        firstName: user.firstName,
        lastName: user.lastName,
        age: user.age,
        phone: user.phone,
        phoneCountryCode: user.phoneCountryCode,
        tradingStyles: user.tradingStyles,
        strategies: user.strategies,
        markets: user.markets,
        customStrategy: user.customStrategy,
        experience: user.experience,
        createdAt: user.createdAt,
    };
}

// ==========================================================================
// 1. RO'YXATDAN O'TISH (POST /api/auth/register)
// Token BERILMAYDI — faqat tasdiqlash oqimi uchun verifyToken.
// ==========================================================================
router.post('/register', registerLimiter, validateRegister, async (req, res) => {
    try {
        const b = req.body;
        const email = normalizeEmail(b.email);

        const existing = await User.findOne({ email });
        if (existing) {
            // Tasdiqlanmagan akkauntni ham qayta yozmaymiz — aks holda
            // begona odam kutilayotgan akkauntning parolini almashtira oladi.
            return res.status(400).json({
                message: "Bu email allaqachon ro'yxatdan o'tgan. Tizimga kiring yoki parolni tiklang.",
            });
        }

        const fullName = [b.firstName, b.lastName].filter(Boolean).join(' ').trim();
        const username = (b.username && String(b.username).trim())
            || fullName
            || email.split('@')[0];

        const user = new User({
            username,
            email,
            password: await bcrypt.hash(b.password, 10),
            provider: 'local',
            isVerified: false,
            // Profil register formasida to'planadi, shuning uchun darhol true
            isOnboarded: true,
        });

        applyProfileFields(user, b);

        const code = await issueCode(user, 'verify_email');
        await user.save();

        const mail = await sendVerificationCode(email, code, 'verify_email', user.username);

        return res.status(201).json({
            message: 'Tasdiqlash kodi emailingizga yuborildi',
            email,
            verifyToken: generateVerifyToken(user._id),
            emailSent: mail.ok,
            emailProvider: mail.provider,
        });
    } catch (err) {
        if (err?.code === 11000) {
            return res.status(400).json({ message: "Bu email allaqachon ro'yxatdan o'tgan." });
        }
        return handleDbValidationError(err, res, 'Serverda xatolik yuz berdi');
    }
});

// ==========================================================================
// 2. TIZIMGA KIRISH (POST /api/auth/login)
// ==========================================================================
router.post('/login', loginLimiter, validateLogin, async (req, res) => {
    try {
        const { password } = req.body;
        const email = normalizeEmail(req.body.email);

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "Email yoki parol noto'g'ri" });

        if (!user.password) {
            return res.status(400).json({
                message: 'Ushbu hisob Google orqali yaratilgan. Google orqali kiring.',
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Email yoki parol noto'g'ri" });

        // 🔑 Parol to'g'ri — limiter uchun bu muvaffaqiyat (403 bo'lsa ham)
        res.locals.authOk = true;

        // Tasdiqlanmagan bo'lsa: access token BERILMAYDI, yangi kod yuboriladi
        if (!user.isVerified) {
            const code = await issueCode(user, 'verify_email');
            await user.save();
            const mail = await sendVerificationCode(email, code, 'verify_email', user.username);

            return res.status(403).json({
                needsVerification: true,
                message: 'Email tasdiqlanmagan. Yangi kod yuborildi.',
                email,
                verifyToken: generateVerifyToken(user._id),
                emailSent: mail.ok,
            });
        }

        return res.json({
            token: generateToken(user._id),
            username: user.username,
            isOnboarded: user.isOnboarded,
        });
    } catch (err) {
        return handleDbValidationError(err, res, 'Serverda xatolik yuz berdi');
    }
});

// ==========================================================================
// 3. GOOGLE ORQALI KIRISH (POST /api/auth/google)
// ==========================================================================
router.post('/google', loginLimiter, async (req, res) => {
    try {
        const { credential } = req.body || {};
        if (!credential || typeof credential !== 'string') {
            return res.status(400).json({ message: 'Google tokeni yuborilmadi' });
        }

        const payload = await verifyGoogleToken(credential);
        const { sub: googleId, email: rawEmail, name, picture } = payload;

        if (!rawEmail) {
            return res.status(400).json({ message: 'Google hisobingizda email topilmadi' });
        }
        const email = normalizeEmail(rawEmail);

        let user = await User.findOne({ email });
        let isNewUser = false;

        if (user) {
            let updated = false;
            if (!user.googleId) { user.googleId = googleId; updated = true; }
            if (!user.avatar && picture) { user.avatar = picture; updated = true; }
            // Google emailni tasdiqlagan — lokal akkaunt tasdiqlanmagan bo'lsa ham
            if (!user.isVerified) { user.isVerified = true; updated = true; }
            if (updated) await user.save();
        } else {
            isNewUser = true;
            user = new User({
                username: name || email.split('@')[0],
                email,
                googleId,
                provider: 'google',
                avatar: picture || '',
                isVerified: true,   // Google emailni allaqachon tasdiqlagan
                isOnboarded: false, // profile-setup sahifasiga yo'naltirish uchun
            });
            await user.save();
        }

        res.locals.authOk = true;

        return res.json({
            token: generateToken(user._id),
            username: user.username,
            isNewUser,
            isOnboarded: user.isOnboarded,
        });
    } catch (err) {
        console.error('Google auth xatosi:', err.message);
        return res.status(401).json({ message: 'Google orqali kirishda xatolik yuz berdi' });
    }
});

// ==========================================================================
// 4. KODNI TASDIQLASH (POST /api/auth/verify-code)
// Muvaffaqiyatli bo'lsa — ACCESS TOKEN beriladi.
// ==========================================================================
router.post('/verify-code', codeLimiter, verifyPendingToken, validateVerifyCode, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });

        const result = await checkCode(user, req.body.code, 'verify_email');
        if (!result.ok) {
            return res.status(result.status).json({ message: result.message });
        }

        // "Emailni o'zgartirish" oqimi — kod yangi emailga yuborilgan edi
        const pending = user.authCode?.pendingEmail;
        if (pending) {
            const taken = await User.findOne({ email: pending, _id: { $ne: user._id } });
            if (taken) {
                clearCode(user);
                await user.save();
                return res.status(400).json({
                    message: 'Bu email oradan boshqa foydalanuvchi tomonidan band qilingan.',
                });
            }
            user.email = pending;
        }

        user.isVerified = true;
        clearCode(user);
        await user.save();

        return res.json({
            message: 'Email muvaffaqiyatli tasdiqlandi',
            token: generateToken(user._id),
            username: user.username,
            email: user.email,
            isOnboarded: user.isOnboarded,
        });
    } catch (err) {
        if (err?.code === 11000) {
            return res.status(400).json({ message: 'Bu email band qilingan.' });
        }
        return handleDbValidationError(err, res, 'Server xatosi');
    }
});

// ==========================================================================
// 5. KODNI QAYTA YUBORISH (POST /api/auth/resend-code)
// 60s chegara SERVER tomonida — frontend taymeriga ishonmaymiz.
// ==========================================================================
router.post('/resend-code', codeLimiter, verifyPendingToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });

        const lastSent = user.authCode?.lastSentAt;
        if (lastSent) {
            const elapsed = Date.now() - lastSent.getTime();
            if (elapsed < RESEND_COOLDOWN_MS) {
                const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
                return res.status(429).json({
                    message: `Yangi kod so'rash uchun ${wait} sekund kuting.`,
                    retryAfter: wait,
                });
            }
        }

        // Email o'zgartirish jarayonida bo'lsa, kod yana yangi emailga ketadi
        const pending = user.authCode?.pendingEmail || null;
        const target = pending || user.email;

        const code = await issueCode(user, 'verify_email', pending);
        await user.save();
        const mail = await sendVerificationCode(target, code, 'verify_email', user.username);

        return res.json({
            message: 'Yangi kod yuborildi',
            email: target,
            emailSent: mail.ok,
            retryAfter: RESEND_COOLDOWN_MS / 1000,
        });
    } catch (err) {
        return handleDbValidationError(err, res, 'Server xatosi');
    }
});

// ==========================================================================
// 6. EMAILNI O'ZGARTIRISH (POST /api/auth/change-email)
// Faqat tasdiqlash oqimida — verify token talab qiladi.
// ==========================================================================
router.post('/change-email', codeLimiter, verifyPendingToken, validateChangeEmail, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });

        if (user.isVerified) {
            return res.status(400).json({
                message: "Email allaqachon tasdiqlangan. O'zgartirish uchun sozlamalarga murojaat qiling.",
            });
        }

        const newEmail = normalizeEmail(req.body.newEmail);

        if (newEmail === user.email) {
            return res.status(400).json({ message: 'Bu allaqachon sizning emailingiz' });
        }

        // Band emasligini tekshiramiz
        const taken = await User.findOne({ email: newEmail, _id: { $ne: user._id } });
        if (taken) {
            return res.status(400).json({ message: 'Bu email band. Boshqa email kiriting.' });
        }

        // Email hozir ALMASHTIRILMAYDI — faqat kod tasdiqlangach almashadi
        const code = await issueCode(user, 'verify_email', newEmail);
        await user.save();
        const mail = await sendVerificationCode(newEmail, code, 'verify_email', user.username);

        return res.json({
            message: 'Yangi emailga tasdiqlash kodi yuborildi',
            email: newEmail,
            emailSent: mail.ok,
        });
    } catch (err) {
        return handleDbValidationError(err, res, 'Server xatosi');
    }
});

// ==========================================================================
// 7. PAROLNI UNUTDIM (POST /api/auth/forgot-password)
// Email mavjudligini OSHKOR QILMAYDI — har doim bir xil 200 javob.
// ==========================================================================
router.post('/forgot-password', codeLimiter, validateForgotPassword, async (req, res) => {
    const genericResponse = {
        message: "Agar bu email ro'yxatdan o'tgan bo'lsa, tiklash kodi yuborildi.",
    };

    try {
        const email = normalizeEmail(req.body.email);
        const user = await User.findOne({ email });

        // Google-only akkauntda parol yo'q — tiklashning ma'nosi yo'q,
        // lekin javob bir xil qoladi (oshkor qilmaslik uchun)
        if (user && user.password) {
            const code = await issueCode(user, 'reset_password');
            await user.save();
            await sendVerificationCode(email, code, 'reset_password', user.username);
        }

        return res.json(genericResponse);
    } catch (err) {
        console.error('forgot-password xatosi:', err);
        // Xato bo'lsa ham bir xil javob — oshkor qilmaslik muhimroq
        return res.json(genericResponse);
    }
});

// ==========================================================================
// 8. PAROLNI TIKLASH (POST /api/auth/reset-password)
// Muvaffaqiyatli bo'lsa isVerified = true — email egaligi isbotlandi.
// Shu sababli begona odam band qilgan emailni haqiqiy egasi qaytarib oladi.
// ==========================================================================
router.post('/reset-password', codeLimiter, validateResetPassword, async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const user = await User.findOne({ email });

        // Foydalanuvchi yo'q bo'lsa ham kod xatosi bilan bir xil javob
        if (!user) {
            return res.status(400).json({ message: "Kod noto'g'ri yoki muddati tugagan" });
        }

        const result = await checkCode(user, req.body.code, 'reset_password');
        if (!result.ok) {
            return res.status(result.status).json({ message: result.message });
        }

        user.password = await bcrypt.hash(req.body.newPassword, 10);
        // Kodni emailga olgan — demak email egasi
        user.isVerified = true;
        clearCode(user);
        await user.save();

        return res.json({
            message: 'Parol muvaffaqiyatli o\'zgartirildi. Endi yangi parol bilan kiring.',
        });
    } catch (err) {
        return handleDbValidationError(err, res, 'Server xatosi');
    }
});

// ==========================================================================
// 9. PROFIL MA'LUMOTLARI (GET /api/auth/profile)
// ==========================================================================
router.get('/profile', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password -authCode');
        if (!user) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });
        return res.json(publicUser(user));
    } catch (err) {
        return handleDbValidationError(err, res, 'Server xatosi');
    }
});

// ==========================================================================
// 10. PROFILNI YANGILASH (PUT /api/auth/profile)
// profile-setup va Sozlamalar/Profil — ikkisi ham shu endpointni ishlatadi.
// ==========================================================================
router.put('/profile', verifyToken, validateProfileUpdate, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });

        if (req.body.username !== undefined) {
            user.username = String(req.body.username).trim();
        }
        applyProfileFields(user, req.body);

        // "Keyinroq to'ldiraman" ham shu endpointni bo'sh body bilan chaqiradi —
        // isOnboarded true bo'lmasa dashboard qayta profile-setup'ga yuboradi
        // va cheksiz halqa yuzaga keladi.
        user.isOnboarded = true;

        await user.save();
        return res.json({ message: 'Profil saqlandi', user: publicUser(user) });
    } catch (err) {
        return handleDbValidationError(err, res, 'Server xatosi');
    }
});

// ==========================================================================
// 11. PAROLNI O'ZGARTIRISH (PUT /api/auth/password)
// ==========================================================================
router.put('/password', verifyToken, validatePasswordChange, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });

        if (!user.password) {
            return res.status(400).json({
                message: "Bu hisob Google orqali yaratilgan — parol o'rnatilmagan. \"Parolni unutdim\" orqali parol yarating.",
            });
        }

        const isMatch = await bcrypt.compare(req.body.currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Joriy parol noto'g'ri" });
        }

        user.password = await bcrypt.hash(req.body.newPassword, 10);
        await user.save();

        return res.json({ message: "Parol muvaffaqiyatli o'zgartirildi" });
    } catch (err) {
        return handleDbValidationError(err, res, 'Server xatosi');
    }
});

module.exports = router;
