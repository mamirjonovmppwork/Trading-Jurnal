const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const tradeRoutes = require('./routes/tradeRoutes');

const app = express();

// Middleware sozlamalari
app.use(cors());
app.use(express.json());

// API yo'llarini ulash
app.use('/api/auth', authRoutes);
app.use('/api/trades', tradeRoutes);

// MongoDB bazasiga ulanish
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB bazasiga muvaffaqiyatli ulandi! 🖥️'))
    .catch(err => console.error('MongoDB ulanishida xatolik chiqdi:', err));

// Server portini yoqish
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server ${PORT}-portda muammosiz gupillab ishlamoqda... 🔥`);
});