import api from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // HTML-dagi yangi ID-lar bilan sinxronizatsiya qilindi
    const tbody = document.getElementById('trades-list'); // HTML-dagi trades-list id ga moslandi
    const form = document.getElementById('trade-form');
    const usernameDisplay = document.getElementById('user-name'); // HTML-dagi user-name id ga moslandi
    
    let initialBalance = 0;

    try {
        const user = await api.get('/auth/profile');
        
        // --- HAQIQIY VA LOKAL SIMULYATSIYA MUTANOSIBLIGI ---
        const localVerified = localStorage.getItem('user_verified') === 'true';

        // Agar foydalanuvchi bazada tasdiqlanmagan bo'lsa VA lokal simulyatsiyadan o'tmagan bo'lsa
        if (!user.isVerified && !localVerified) {
            window.location.href = 'verify.html';
            return;
        }
        
        // Onboarding holatini tekshirish (Simulyatsiya hisobga olingan)
        if (!user.isOnboarded && !localVerified) {
            window.location.href = 'onboarding.html';
            return;
        }

        // Ismni chiqarish
        if (usernameDisplay && user) {
            usernameDisplay.innerText = user.username || 'Foydalanuvchi';
        }
        
        initialBalance = user.initialBalance || 0;
        await fetchTrades();

    } catch (err) {
        console.error('Profil yuklanishida xato yoki token eskirgan:', err);
        
        // Agar local test bo'lsa, xato holatida ham kirishga ruxsat berish
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log("Lokal test: Profil xatoligi o'tkazib yuborildi.");
            if (usernameDisplay) usernameDisplay.innerText = "Developer (Local)";
            await fetchTrades();
        } else {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
            return;
        }
    }

    async function fetchTrades() {
        try {
            const trades = await api.get('/trades');
            renderTrades(trades);
        } catch (err) {
            console.error('Savdolarni yuklashda xatolik:', err);
            // Agar bazada xatolik bo'lsa, bo'sh holatni render qilamiz
            renderTrades([]);
        }
    }

    function renderTrades(trades) {
        if (!tbody) return;
        tbody.innerHTML = '';
        
        let totalPnL = 0;
        let winTrades = 0;
        let totalTradesCount = trades ? trades.length : 0;

        // Agar savdolar bo'lmasa, HTML-dagi premium-empty-state qolipini chiqaramiz
        if (!trades || trades.length === 0) {
            tbody.innerHTML = `
                <tr id="empty-state-row">
                    <td colspan="4" class="table-empty-state" style="text-align:center; padding:2rem; color:#64748b;">
                        <i data-lucide="folder-open" style="margin-bottom:8px; display:inline-block;"></i>
                        <p>Hozircha savdolar mavjud emas. Birinchi savdoni kiriting!</p>
                    </td>
                </tr>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            updateStats(0, 0, 0);
            return;
        }

        trades.forEach(trade => {
            // Yangi forma strukturasidan keladigan PnL qiymatini hisoblash
            const tradePnL = parseFloat(trade.pnl) || 0;
            totalPnL += tradePnL;
            
            if (tradePnL > 0) winTrades++;

            const tr = document.createElement('tr');
            const pnlClass = tradePnL >= 0 ? 'pos-pnl' : 'neg-pnl'; // HTML-dagi klaslarga moslandi
            const typeClass = trade.type === 'BUY' ? 'text-green' : 'text-red';
            
            // Sana formatlash
            const tradeDate = trade.createdAt ? new Date(trade.createdAt).toLocaleDateString() : new Date().toLocaleDateString();

            tr.innerHTML = `
                <td style="font-weight:600">${trade.pair}</td>
                <td class="${typeClass}"><b>${trade.type}</b></td>
                <td class="${pnlClass}">${tradePnL >= 0 ? '+' : ''}$${tradePnL.toFixed(2)}</td>
                <td class="text-muted">${tradeDate}</td>
            `;
            tbody.appendChild(tr);
        });

        updateStats(totalPnL, winTrades, totalTradesCount);
    }

    function updateStats(totalPnL, winTrades, totalTradesCount) {
        // 1. Total PnL Yangilash
        const pnlEl = document.getElementById('total-pnl');
        const pnlPercentageEl = document.getElementById('pnl-percentage');
        
        if (pnlEl) {
            pnlEl.innerText = `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`;
            pnlEl.className = totalPnL >= 0 ? 'stat-value pos-pnl' : 'stat-value neg-pnl';
        }

        if (pnlPercentageEl) {
            const growthPct = initialBalance > 0 ? (totalPnL / initialBalance) * 100 : 0;
            pnlPercentageEl.innerText = `${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(2)}% o'sish`;
            pnlPercentageEl.className = growthPct >= 0 ? 'stat-footer text-green' : 'stat-footer text-red';
        }

        // 2. Joriy Balans (Account Growth)
        const currentBalanceEl = document.getElementById('total-balance'); // HTML-dagi joriy balans ID-si
        if (currentBalanceEl) {
            const currentBalance = initialBalance + totalPnL;
            currentBalanceEl.innerText = `$${currentBalance.toFixed(2)}`;
        }

        // 3. Jami savdolar soni (Ham sarlavha, ham Overview uchun)
        const tradesCountOverview = document.getElementById('trades-count-overview');
        const tradesCountHeader = document.getElementById('trades-count');
        
        if (tradesCountOverview) tradesCountOverview.innerText = totalTradesCount;
        if (tradesCountHeader) tradesCountHeader.innerText = `${totalTradesCount} ta savdo`;

        // 4. Win Rate % hisoblash
        const winRateEl = document.getElementById('win-rate');
        if (winRateEl) {
            const winRate = totalTradesCount > 0 ? Math.round((winTrades / totalTradesCount) * 100) : 0;
            winRateEl.innerText = `${winRate}%`;
        }
    }

    // Yangi Savdo Kiritish Formasi Eventi
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newTradeData = {
                pair: document.getElementById('pair').value,
                type: document.getElementById('type').value,
                pnl: parseFloat(document.getElementById('pnl').value), // Yangi formadagi pnl fieldi
                notes: document.getElementById('notes').value,
                // Tanlangan emotsiya radio tugmasini olish
                emotion: document.querySelector('input[name="emotion"]:checked')?.value || 'Calm'
            };

            try {
                await api.post('/trades', newTradeData);
                form.reset();
                await fetchTrades();
            } catch (err) {
                alert(err.message || 'Savdo qoʻshishda xatolik!');
            }
        });
    }

    // Tizimdan chiqish (Siz taqdim etgan HTML-dagi #logout-btn ID-siga to'g'rilandi)
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user_verified');
            window.location.href = 'login.html';
        });
    }
});