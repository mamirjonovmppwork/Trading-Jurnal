const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/user');

// Google tokenlarini tekshirish uchun klient
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Tokenni tekshirish uchun ichki middleware
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Avtorizatsiya rad etildi, token yo\'q' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Yaroqsiz token' });
    }
};

// RO'YXATDAN O'TISH (POST /api/auth/register)
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: 'Bu email allaqachon mavjud' });

        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({ username, email, password: hashedPassword });
        await user.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ token, username: user.username });
    } catch (err) {
        res.status(500).json({ message: 'Serverda xatolik yuz berdi' });
    }
});

// TIZIMGA KIRISH (POST /api/auth/login)
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Email yoki parol noto\'g\'ri' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Email yoki parol noto\'g\'ri' });

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, username: user.username });
    } catch (err) {
        res.status(500).json({ message: 'Serverda xatolik yuz berdi' });
    }
});

// GOOGLE ORQALI KIRISH / RO'YXATDAN O'TISH (POST /api/auth/google)
router.post('/google', async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({ message: 'Google tokeni yuborilmadi' });
        }

        // Google'dan kelgan tokenni tekshiramiz (soxta bo'lishi mumkin emasligiga ishonch hosil qilamiz)
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        if (!email) {
            return res.status(400).json({ message: 'Google hisobingizda email topilmadi' });
        }

        let user = await User.findOne({ email });

        if (user) {
            // Email+parol bilan ro'yxatdan o'tgan foydalanuvchi endi Google bilan ham kirmoqda —
            // hisoblarni bog'laymiz, mavjud ma'lumotlarni buzmaymiz
            if (!user.googleId) {
                user.googleId = googleId;
                if (!user.avatar) user.avatar = picture || '';
                await user.save();
            }
        } else {
            // Yangi foydalanuvchi — Google orqali birinchi marta kirmoqda
            user = new User({
                username: name || email.split('@')[0],
                email,
                googleId,
                provider: 'google',
                avatar: picture || '',
                isVerified: true // Google email'ni allaqachon tasdiqlagan
            });
            await user.save();
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({
            token,
            username: user.username,
            isVerified: user.isVerified,
            isOnboarded: user.isOnboarded
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
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Server xatosi' });
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
        res.status(500).json({ message: 'Server xatosi' });
    }
});

// ONBOARDINGNI YAKUNLASH (POST /api/auth/onboarding)
router.post('/onboarding', verifyToken, async (req, res) => {
    try {
        const { initialBalance } = req.body;
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });

        user.initialBalance = initialBalance;
        user.isOnboarded = true;
        await user.save();
        res.json({ message: 'Onboarding yakunlandi!' });
    } catch (err) {
        res.status(500).json({ message: 'Server xatosi' });
    }
});

module.exports = router;