function renderTrades(trades) {
    if (dbTbody) dbTbody.innerHTML = '';
    if (journalTbody) journalTbody.innerHTML = '';
    
    let totalTrades = trades ? trades.length : 0;
    let wins = 0; let losses = 0; let totalProfit = 0;

    if (!trades || trades.length === 0) {
        const empty = `<tr><td colspan="8" style="text-align:center; padding:3rem; color:#64748b;">Hozircha jurnal bo'sh.</td></tr>`;
        if (dbTbody) dbTbody.innerHTML = empty;
        if (journalTbody) journalTbody.innerHTML = empty;
        return;
    }

    trades.forEach((trade, index) => {
        const tradePnL = parseFloat(trade.pnl) || 0;
        totalProfit += tradePnL;
        if (tradePnL > 0) wins++; else if (tradePnL < 0) losses++;

        const displayDate = trade.date || '';
        const displayTime = trade.time ? trade.time.substring(0, 5) : '';
        const isShort = trade.trend && trade.trend.toLowerCase().includes('short');
        const isWin = tradePnL >= 0;
        const pnlClass = isWin ? 'text-green' : 'text-red';
        
        // 🟢 Formadan kiritilgan haqiqiy R:R ni ko'rsatish
        const realRR = trade.rr ? parseFloat(trade.rr).toFixed(1) : '0.0';
        const rrDisplay = `${isWin ? '+' : '-'}${realRR}R`;

        const baseHTML = `
            <td class="text-muted">${displayDate} ${displayTime}</td>
            <td class="font-bold">${trade.pair ? trade.pair.toUpperCase() : '—'}</td>
            <td><span class="badge-setup">${trade.strategy || 'No Setup'}</span></td>
            <td><span class="direction-indicator ${isShort ? 'short' : 'long'}"><span class="dot"></span> ${isShort ? 'Short' : 'Long'}</span></td>
            <td><span class="badge-result ${isWin ? 'win' : 'loss'}">${isWin ? 'Win' : 'Loss'}</span></td>
            <td class="${pnlClass} font-semibold">${rrDisplay}</td>
            <td class="${pnlClass} font-bold">${isWin ? '+' : ''}$${tradePnL.toFixed(2)}</td>
        `;

        if (dbTbody && index < 3) {
            const trDb = document.createElement('tr');
            trDb.innerHTML = baseHTML + `<td><div class="mini-trend-box ${pnlClass}">${isWin ? '📈' : '📉'}</div></td>`;
            dbTbody.appendChild(trDb);
        }

        if (journalTbody) {
            const trJournal = document.createElement('tr');
            trJournal.innerHTML = baseHTML + `
                <td style="text-align: center; white-space: nowrap;">
                    <button class="btn-action-edit" data-id="${trade._id}" title="Tahrirlash" style="background: none; border: none; color: #2563eb; cursor: pointer; padding: 4px; margin-right: 8px;">
                        <i data-lucide="edit-3" style="width: 18px; height: 18px;"></i>
                    </button>
                    <button class="btn-action-delete" data-id="${trade._id}" title="O'chirish" style="background: none; border: none; color: #dc2626; cursor: pointer; padding: 4px;">
                        <i data-lucide="trash-2" style="width: 18px; height: 18px;"></i>
                    </button>
                </td>
            `;
            journalTbody.appendChild(trJournal);
        }
    });

    if (typeof updateStats === 'function') {
        updateStats(totalTrades, wins, losses, totalProfit);
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
    attachActionButtons(); 
}