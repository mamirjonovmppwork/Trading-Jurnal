import api from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const tbody = document.getElementById('trades-list');
    const form = document.getElementById('trade-form');
    const usernameDisplay = document.getElementById('user-name');
    
    let initialBalance = 0;

    // Default bugungi sana va vaqtni kiritish
    if(document.getElementById('trade-date')) {
        const today = new Date();
        document.getElementById('trade-date').value = today.toISOString().split('T')[0];
        document.getElementById('trade-time').value = today.toTimeString().split(' ')[0].substring(0,5);
    }

    try {
        const user = await api.get('/auth/profile');
        const localVerified = localStorage.getItem('user_verified') === 'true';

        if (!user.isVerified && !localVerified) {
            window.location.href = 'verify.html';
            return;
        }

        if (usernameDisplay && user) {
            usernameDisplay.innerText = user.username || 'Foydalanuvchi';
        }
        
        initialBalance = user.initialBalance || 0;
        await fetchTrades();

    } catch (err) {
        console.error('Profil xatoligi:', err);
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            if (usernameDisplay) usernameDisplay.innerText = "Dev Mode";
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
            console.error('Savdolarni yuklashda xato:', err);
            renderTrades([]);
        }
    }

    function renderTrades(trades) {
        if (!tbody) return;
        tbody.innerHTML = '';
        
        let totalTrades = trades ? trades.length : 0;
        let wins = 0;
        let losses = 0;
        let totalProfit = 0;

        if (!trades || trades.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2.5rem; color:#64748b;">Hozircha savdolar jurnali bo'sh. Birinchi savdongizni kiriting!</td></tr>`;
            updateStats(0, 0, 0, 0);
            return;
        }

        trades.forEach(trade => {
            const tradePnL = parseFloat(trade.pnl) || 0;
            totalProfit += tradePnL;
            
            if (tradePnL > 0) wins++;
            else if (tradePnL < 0) losses++;

            const tr = document.createElement('tr');
            const pnlClass = tradePnL >= 0 ? 'text-green' : 'text-red';
            const displayDate = trade.date || new Date(trade.createdAt).toLocaleDateString();

            tr.innerHTML = `
                <td><span style="font-weight:700; color:#0f172a;">${trade.pair}</span></td>
                <td style="color:#64748b;">${displayDate} ${trade.time || ''}</td>
                <td><span class="badge-strategy">${trade.strategy || 'No Setup'}</span></td>
                <td><span style="font-size:0.9rem;">${trade.trend || '—'}</span></td>
                <td class="${pnlClass}" style="font-weight:700;">${tradePnL >= 0 ? '+' : ''}$${tradePnL.toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });

        updateStats(totalTrades, wins, losses, totalProfit);
    }

    function updateStats(total, wins, losses, totalProfit) {
        const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;
        const avgRR = losses > 0 ? (wins / losses).toFixed(1) : wins.toFixed(1);
        
        if(document.getElementById('stat-total')) document.getElementById('stat-total').innerText = total;
        if(document.getElementById('stat-wins')) document.getElementById('stat-wins').innerText = wins;
        if(document.getElementById('stat-losses')) document.getElementById('stat-losses').innerText = losses;
        if(document.getElementById('stat-winrate')) document.getElementById('stat-winrate').innerText = `${winrate}%`;
        if(document.getElementById('stat-avgrr')) document.getElementById('stat-avgrr').innerText = avgRR;
        
        if(document.getElementById('stat-profit')) {
            const profEl = document.getElementById('stat-profit');
            profEl.innerText = `${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}`;
            profEl.className = totalProfit >= 0 ? 'stat-number-text text-green' : 'stat-number-text text-red';
        }
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newTradeData = {
                date: document.getElementById('trade-date').value,
                time: document.getElementById('trade-time').value,
                pair: document.getElementById('pair').value.toUpperCase(),
                strategy: document.getElementById('strategy').value,
                trend: document.getElementById('trend').value,
                balanceAtTrade: parseFloat(document.getElementById('balance-at-trade').value) || initialBalance,
                entryPrice: parseFloat(document.getElementById('entry-price').value),
                sl: parseFloat(document.getElementById('sl-price').value) || 0,
                tp: parseFloat(document.getElementById('tp-price').value) || 0,
                pnl: parseFloat(document.getElementById('pnl').value),
                emotion: document.getElementById('emotion').value,
                notes: document.getElementById('notes').value
            };

            try {
                await api.post('/trades', newTradeData);
                form.reset();
                document.getElementById('trade-date').value = new Date().toISOString().split('T')[0];
                document.getElementById('trade-time').value = new Date().toTimeString().split(' ')[0].substring(0,5);
                await fetchTrades();
            } catch (err) {
                alert(err.message || 'Savdo saqlashda xatolik yuz berdi!');
            }
        });
    }

    // --- SIDEBAR SWITCH NAVIGATION ---
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    const sections = document.querySelectorAll('.dashboard-section');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            const targetSectionId = item.getAttribute('data-target');
            sections.forEach(section => {
                if (section.id === targetSectionId) section.classList.add('active-section');
                else section.classList.remove('active-section');
            });
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    });

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user_verified');
            window.location.href = 'login.html';
        });
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
});