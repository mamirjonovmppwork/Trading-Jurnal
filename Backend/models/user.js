const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isVerified: { type: Boolean, default: false },   // Email tasdiqlangani
    isOnboarded: { type: Boolean, default: false },  // Onboardingdan o'tgani
    initialBalance: { type: Number, default: 0 }     // Onboardingda kiritiladigan boshlang'ich balans
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);