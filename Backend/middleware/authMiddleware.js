const jwt = require('jsonwebtoken');

// Tokenni tekshirish uchun umumiy middleware.
// Muvaffaqiyatli bo'lsa req.userId ga foydalanuvchi ID sini yozadi.
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

module.exports = verifyToken;