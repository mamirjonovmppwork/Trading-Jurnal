const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        default: null
    },

    googleId: {
        type: String,
        default: null
    },

    provider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },

    avatar: {
        type: String,
        default: ''
    },

    isVerified: {
        type: Boolean,
        default: false
    },

    isOnboarded: {
        type: Boolean,
        default: false
    },

    initialBalance: {
        type: Number,
        default: 0
    }

}, {
    timestamps: true
});

module.exports = mongoose.model('User', UserSchema);