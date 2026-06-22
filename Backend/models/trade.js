const mongoose = require('mongoose');

const TradeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pair: { type: String, required: true },
    type: { type: String, enum: ['BUY', 'SELL'], required: true },
    entryPrice: { type: Number, required: true },
    exitPrice: { type: Number, default: null },
    size: { type: Number, required: true },
    pnl: { type: Number, default: 0 },
    status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
    notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Trade', TradeSchema);