const mongoose = require('mongoose');

const TradeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    pair: { type: String, required: true, uppercase: true },
    strategy: { type: String, default: 'No Setup' },
    trend: { type: String, enum: ['Long', 'Short'], required: true },
    type: { type: String, enum: ['BUY', 'SELL'] },
    pnl: { type: Number, required: true, default: 0 },
    rr: { type: Number, required: true, default: 0 }, // 🟢 RR MAYDONI QO'SHILDI
    entryPrice: { type: Number, default: 0 },
    size: { type: Number, default: 0.1 },
    notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Trade', TradeSchema);