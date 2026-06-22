import api from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const tbody = document.getElementById('trades-tbody');
    const form = document.getElementById('trade-form');
    const usernameDisplay = document.getElementById('username-display');
    
    let initialBalance = 0;

    try {
        const user = await api.get('/auth/profile');
        
        if (!user.isVerified) {
            window.location.href = 'verify.html';
            return;
        }
        
        if (!user.isOnboarded) {
            window.location.href = 'onboarding.html';
            return;
        }

        if (usernameDisplay && user) {
            usernameDisplay.innerText = user.username;
        }
        
        initialBalance = user.initialBalance || 0;
        await fetchTrades();

    } catch (err) {
        console.error('Profil yuklanishida xato yoki token eskirgan:', err);
        localStorage.removeItem('token');
        window.location.href = 'login.html';
        return;
    }

    async function fetchTrades() {
        try {
            const trades = await api.get('/trades');
            renderTrades(trades);
        } catch (err) {
            console.error('Savdolarni yuklashda xatolik:', err);
        }
    }

    function renderTrades(trades) {
        if (!tbody) return;
        tbody.innerHTML = '';
        let totalPnL = 0;
        let openCount = 0;
        let closedCount = 0;

        if (!trades || trades.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#6b7280; padding:2rem;">Hozircha hech qanday savdo kiritilmagan.</td></tr>`;
            updateStats(0, 0, 0);
            return;
        }

        trades.forEach(trade => {
            totalPnL += trade.pnl || 0;
            if (trade.status === 'OPEN') openCount++;
            if (trade.status === 'CLOSED') closedCount++;

            const tr = document.createElement('tr');
            const pnlText = trade.status === 'CLOSED' ? `$${(trade.pnl || 0).toFixed(2)}` : '—';
            const pnlClass = (trade.pnl || 0) >= 0 ? 'text-green' : 'text-red';
            const typeClass = trade.type === 'BUY' ? 'text-green' : 'text-red';

            tr.innerHTML = `
                <td style="font-weight:600">${trade.pair}</td>
                <td class="${typeClass}">${trade.type}</td>
                <td>$${trade.entryPrice}</td>
                <td>${trade.size}</td>
                <td><span class="badge ${trade.status === 'OPEN' ? 'badge-open' : 'badge-closed'}">${trade.status}</span></td>
                <td class="${pnlClass}">${pnlText}</td>
            `;
            tbody.appendChild(tr);
        });

        updateStats(totalPnL, openCount, closedCount);
    }

    function updateStats(totalPnL, openCount, closedCount) {
        const pnlEl = document.getElementById('total-pnl');
        if (pnlEl) {
            pnlEl.innerText = `$${totalPnL.toFixed(2)}`;
            pnlEl.className = totalPnL >= 0 ? 'text-green' : 'text-red';
        }

        const currentBalanceEl = document.getElementById('current-balance');
        if (currentBalanceEl) {
            const currentBalance = initialBalance + totalPnL;
            currentBalanceEl.innerText = `$${currentBalance.toFixed(2)}`;
        }

        const initialBalanceEl = document.getElementById('initial-balance');
        if (initialBalanceEl) {
            initialBalanceEl.innerText = `$${initialBalance.toFixed(2)}`;
        }

        if (document.getElementById('open-count')) document.getElementById('open-count').innerText = `${openCount} ta`;
        if (document.getElementById('closed-count')) document.getElementById('closed-count').innerText = `${closedCount} ta`;
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newTradeData = {
                pair: document.getElementById('pair').value,
                type: document.getElementById('type').value,
                entryPrice: parseFloat(document.getElementById('entryPrice').value),
                size: parseFloat(document.getElementById('size').value),
                notes: document.getElementById('notes').value
            };

            try {
                await api.post('/trades', newTradeData);
                form.reset();
                fetchTrades();
            } catch (err) {
                alert(err.message || 'Savdo qoʻshishda xatolik!');
            }
        });
    }

    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
        });
    }
});