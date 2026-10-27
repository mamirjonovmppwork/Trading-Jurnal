const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const User = require('../models/user');
// 🟢 Dublikat verifyToken olib tashlandi — yagona manba middleware'da
const verifyToken = require('../middleware/authMiddleware');
// 🟢 Avval shu yerda qayta yozilgan edi, endi mavjud modullar ishlatiladi
const { generateToken } = require('../utils/jwt');
const { verifyGoogleToken } = require('../services/googleService');
const {
    validateRegister,
    validateLogin,
    validateOnboarding,
    handleDbValidationError,
} = require('../middleware/validate');

// 🔒 Brute-force himoyasi — IP bo'yicha 15 daqiqada 10 urinish.
// app.set('trust proxy', 1) server.js da o'rnatilgan, shuning uchun
// Render proxy ortida ham haqiqiy mijoz IP si hisobga olinadi.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Juda ko'p urinish bo'ldi. 15 daqiqadan keyin qayta urinib ko'ring." },
});

/** Emailni bazaga yozishdan oldin bir xil ko'rinishga keltiradi */
function normalizeEmail(email) {
    return String(email).trim().toLowerCase();
}

// RO'YXATDAN O'TISH (POST /api/auth/register)
router.post('/register', authLimiter, validateRegister, async (req, res) => {
    try {
        const { username, password } = req.body;
        const email = normalizeEmail(req.body.email);

        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: 'Bu email allaqachon mavjud' });

        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({
            username: username.trim(),
            email,
            password: hashedPassword,
            provider: 'local',
        });
        await user.save();

        const token = generateToken(user._id);
        res.status(201).json({ token, username: user.username });
    } catch (err) {
        // Unique index poygasi (bir vaqtda ikki so'rov) ham 400 bo'lishi kerak
        if (err?.code === 11000) {
            return res.status(400).json({ message: 'Bu email allaqachon mavjud' });
        }
        return handleDbValidationError(err, res, 'Serverda xatolik yuz berdi');
    }
});

// TIZIMGA KIRISH (POST /api/auth/login)
router.post('/login', authLimiter, validateLogin, async (req, res) => {
    try {
        const { password } = req.body;
        const email = normalizeEmail(req.body.email);

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "Email yoki parol noto'g'ri" });

        // Google orqali ochilgan profilda parol bo'lmasligi mumkin
        if (!user.password) {
            return res.status(400).json({ message: 'Ushbu hisob Google orqali yaratilgan. Google orqali kiring.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Email yoki parol noto'g'ri" });

        const token = generateToken(user._id);
        res.json({ token, username: user.username });
    } catch (err) {
        return handleDbValidationError(err, res, 'Serverda xatolik yuz berdi');
    }
});

// GOOGLE ORQALI KIRISH / RO'YXATDAN O'TISH (POST /api/auth/google)
router.post('/google', authLimiter, async (req, res) => {
    try {
        const { credential } = req.body || {};
        if (!credential || typeof credential !== 'string') {
            return res.status(400).json({ message: 'Google tokeni yuborilmadi' });
        }

        // 🟢 services/googleService.js orqali tekshiriladi (avval bu yerda dublikat edi)
        const payload = await verifyGoogleToken(credential);
        const { sub: googleId, email: rawEmail, name, picture } = payload;

        if (!rawEmail) {
            return res.status(400).json({ message: 'Google hisobingizda email topilmadi' });
        }
        const email = normalizeEmail(rawEmail);

        let user = await User.findOne({ email });

        if (user) {
            // Mavjud foydalanuvchi bo'lsa, ma'lumotlarini to'ldiramiz va provayderni bog'laymiz
            let updated = false;
            if (!user.googleId) {
                user.googleId = googleId;
                updated = true;
            }
            if (!user.avatar && picture) {
                user.avatar = picture;
                updated = true;
            }
            if (updated) await user.save();
        } else {
            // Yangi foydalanuvchi — Google orqali birinchi marta ro'yxatdan o'tmoqda
            user = new User({
                username: name || email.split('@')[0],
                email,
                googleId,
                provider: 'google',
                avatar: picture || '',
                isVerified: true,  // Google emailni allaqachon tasdiqlagan
                isOnboarded: false, // boshlang'ich balans kiritishga yo'naltirish uchun
            });
            await user.save();
        }

        const token = generateToken(user._id);

        res.json({
            token,
            username: user.username,
            isVerified: user.isVerified,
            isOnboarded: user.isOnboarded,
        });
    } catch (err) {
        console.error('Google auth xatosi:', err);
        res.status(401).json({ message: 'Google orqali kirishda xatolik yuz berdi' });
    }
});

// PROFIL MA'LUMOTLARI (GET /api/auth/profile)
router.get('/profile', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });
        res.json(user);
    } catch (err) {
        return handleDbValidationError(err, res, 'Server xatosi');
    }
});

// EMAILNI TASDIQLASH (POST /api/auth/verify)
router.post('/verify', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });

        user.isVerified = true;
        await user.save();
        res.json({ message: 'Email muvaffaqiyatli tasdiqlandi!', isOnboarded: user.isOnboarded });
    } catch (err) {
        return handleDbValidationError(err, res, 'Server xatosi');
    }
});

// ONBOARDINGNI YAKUNLASH (POST /api/auth/onboarding)
router.post('/onboarding', verifyToken, validateOnboarding, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });

        user.initialBalance = Number(req.body.initialBalance);
        user.isOnboarded = true;
        await user.save();
        res.json({ message: 'Onboarding yakunlandi!' });
    } catch (err) {
        return handleDbValidationError(err, res, 'Server xatosi');
    }
});

module.exports = router;
