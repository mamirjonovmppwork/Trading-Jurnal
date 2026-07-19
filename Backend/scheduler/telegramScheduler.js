// ⚠️ Yo'llarni loyihangizdagi haqiqiy joylashuvga moslang
const User = require('../models/user');
const Trade = require('../models/trade');
const { sendTelegramMessage, getUzbekistanTime } = require('../services/telegramService');

/** Bitta foydalanuvchi uchun kunlik hisobot matnini quradi */
function buildDailyReportText(user, trades, dateStr) {
    const includes = user.telegramSettings?.reportIncludes?.length
        ? user.telegramSettings.reportIncludes
        : ['trades', 'winrate', 'profit'];

    const todayTrades = trades.filter(t => t.date === dateStr);

    let wins = 0, losses = 0, profit = 0, rrSum = 0;
    todayTrades.forEach(t => {
        const pnl = parseFloat(t.pnl) || 0;
        profit += pnl;
        rrSum += parseFloat(t.rr) || 0;
        if (pnl > 0) wins++;
        else if (pnl < 0) losses++;
    });
    const winrate = todayTrades.length ? Math.round((wins / todayTrades.length) * 100) : 0;

    let text = `📊 <b>Kunlik hisobot</b>\n📅 ${dateStr}\n\n`;
    if (includes.includes('trades'))  text += `Savdolar: <b>${todayTrades.length}</b> ta\n`;
    if (includes.includes('winrate')) text += `Winrate: <b>${winrate}%</b> (${wins}W / ${losses}L)\n`;
    if (includes.includes('profit'))  text += `Profit: <b>${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}</b>\n`;
    if (includes.includes('rr'))      text += `O'rtacha R:R: <b>${todayTrades.length ? (rrSum / todayTrades.length).toFixed(2) : '0.00'}</b>\n`;

    if (todayTrades.length === 0) text += "\nBugun hali savdo kiritilmagan.";
    text += `\n\nIntizomni davom ettiring 🔥`;
    return text;
}

/** Vaqti kelgan foydalanuvchilarga kunlik hisobot yuboradi (kuniga 1 marta) */
async function checkDailyReports() {
    const { hhmm, dateStr } = getUzbekistanTime();

    const users = await User.find({
        telegramChatId: { $ne: null },
        'telegramSettings.reportAutoSend': true,
        'telegramSettings.reportTime': hhmm,
    });

    for (const user of users) {
        if (user.telegramSettings.lastReportSentDate === dateStr) continue; // bugun allaqachon yuborilgan

        const trades = await Trade.find({ userId: user._id });
        const text = buildDailyReportText(user, trades, dateStr);

        await sendTelegramMessage(user.telegramChatId, text);
        user.telegramSettings.lastReportSentDate = dateStr;
        await user.save();
    }
}

/** Vaqti kelgan savdo eslatmalarini yuboradi (kuniga 1 marta har bir eslatma uchun) */
async function checkReminders() {
    const { hhmm, dateStr } = getUzbekistanTime();

    const users = await User.find({
        telegramChatId: { $ne: null },
        telegramReminders: { $elemMatch: { time: hhmm, active: true } },
    });

    for (const user of users) {
        let changed = false;
        for (const reminder of user.telegramReminders) {
            if (!reminder.active || reminder.time !== hhmm) continue;
            if (reminder.lastSentDate === dateStr) continue;

            await sendTelegramMessage(user.telegramChatId, `⏰ <b>Eslatma:</b> ${reminder.title}`);
            reminder.lastSentDate = dateStr;
            changed = true;
        }
        if (changed) await user.save();
    }
}

/**
 * Scheduler'ni ishga tushiradi. Qo'shimcha kutubxona (node-cron) shart emas —
 * har daqiqada bir marta tekshirish yetarli.
 */
function startTelegramScheduler() {
    setInterval(() => {
        checkDailyReports().catch(err => console.error('Kunlik hisobot xatoligi:', err));
        checkReminders().catch(err => console.error('Eslatma xatoligi:', err));
    }, 60 * 1000);

    console.log('📨 Telegram scheduler ishga tushdi (har daqiqada tekshiradi)');
}

module.exports = { startTelegramScheduler };