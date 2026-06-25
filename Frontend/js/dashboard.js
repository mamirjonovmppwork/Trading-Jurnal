import api from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const dbTbody = document.getElementById('trades-list'); // Dashboard mini jadvali
    const journalTbody = document.getElementById('journal-trades-list'); // Journal to'liq jadvali
    const form = document.getElementById('trade-form');
    const usernameDisplay = document.getElementById('user-name');
    
    // Tahrirlash boshqaruv elementlari
    const editingIdInput = document.getElementById('editing-trade-id');
    const formTitle = document.getElementById('form-title') || document.querySelector('.card-main-header h3');
    const btnSaveTrade = document.getElementById('btn-save-trade');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    
    let initialBalance = 0;

    const dateInput = document.getElementById('trade-date');
    const timeInput = document.getElementById('trade-time');
    
    function setDefaultDateTime() {
        if (dateInput && timeInput) {
            const today = new Date();
            dateInput.value = today.toISOString().split('T')[0];
            timeInput.value = today.toTimeString().split(' ')[0].substring(0, 5);
        }
    }
    setDefaultDateTime();

    // Profilni tekshirish
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
        console.error('Profil yuklashda xatolik:', err);
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            if (usernameDisplay) usernameDisplay.innerText = "Muhammadaziz (Dev)";
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
        if (dbTbody) dbTbody.innerHTML = '';
        if (journalTbody) journalTbody.innerHTML = '';
        
        let totalTrades = trades ? trades.length : 0;
        let wins = 0;
        let losses = 0;
        let totalProfit = 0;

        const emptyRow = `<tr><td colspan="8" style="text-align:center; padding:3rem; color:#64748b; font-weight: 500;">Hozircha savdolar jurnali bo'sh. Birinchi savdongizni kiriting!</td></tr>`;

        if (!trades || trades.length === 0) {
            if (dbTbody) dbTbody.innerHTML = emptyRow;
            if (journalTbody) journalTbody.innerHTML = emptyRow;
            updateStats(0, 0, 0, 0);
            return;
        }

        const sortedTrades = [...trades];

        sortedTrades.forEach((trade, index) => {
            const tradePnL = parseFloat(trade.pnl) || 0;
            totalProfit += tradePnL;
            
            if (tradePnL > 0) wins++;
            else if (tradePnL < 0) losses++;

            const displayDate = trade.date || new Date(trade.createdAt).toLocaleDateString();
            const displayTime = trade.time ? trade.time.substring(0, 5) : '';
            
            const isShort = trade.trend && trade.trend.toLowerCase().includes('short');
            const directionText = isShort ? 'Short' : 'Long';
            const directionClass = isShort ? 'short' : 'long';

            const isWin = tradePnL >= 0;
            const pnlClass = isWin ? 'text-green' : 'text-red';
            const badgeResultClass = isWin ? 'win' : 'loss';
            const resultText = isWin ? 'Win' : 'Loss';
            const miniTrendEmoji = isWin ? '📈' : '📉';
            const rrValue = `${isWin ? '+' : '-'}${(Math.abs(tradePnL) / 100).toFixed(2)}R`;

            // Siz xohlagan tartibdagi HTML ustunlari
            const baseHTML = `
                <td class="text-muted">${displayDate} ${displayTime}</td>
                <td class="font-bold">${trade.pair ? trade.pair.toUpperCase() : '—'}</td>
                <td><span class="badge-setup">${trade.strategy || 'No Setup'}</span></td>
                <td><span class="direction-indicator ${directionClass}"><span class="dot"></span> ${directionText}</span></td>
                <td><span class="badge-result ${badgeResultClass}">${resultText}</span></td>
                <td class="${pnlClass} font-semibold">${rrValue}</td>
                <td class="${pnlClass} font-bold">${isWin ? '+' : ''}$${tradePnL.toFixed(2)}</td>
            `;

            // 1. Dashboard mini jadvali uchun
            if (dbTbody && index < 3) {
                const trDb = document.createElement('tr');
                trDb.innerHTML = baseHTML + `<td><div class="mini-trend-box ${pnlClass}">${miniTrendEmoji}</div></td>`;
                dbTbody.appendChild(trDb);
            }

            // 2. Journal to'liq jadvali uchun (AMALLAR ICON TUGMALARI BILAN)
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

        updateStats(totalTrades, wins, losses, totalProfit);
        
        // Lucide iconlarini generatsiya qilish (Jadval ichidagilar uchun)
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        attachActionButtons(); 
    }

    function updateStats(total, wins, losses, totalProfit) {
        const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;
        const avgRR = losses > 0 ? (wins / losses).toFixed(2) : wins.toFixed(2);
        
        if (document.getElementById('stat-total')) document.getElementById('stat-total').innerText = total;
        if (document.getElementById('stat-avgrr')) document.getElementById('stat-avgrr').innerText = avgRR;
        
        const winrateEl = document.getElementById('stat-winrate');
        if (winrateEl) {
            winrateEl.innerText = `${winrate}%`;
            const subtextEl = winrateEl.nextElementSibling;
            if (subtextEl && subtextEl.classList.contains('stat-subtext')) {
                subtextEl.innerHTML = `<span class="text-green">${wins} Win</span> / <span class="text-red">${losses} Loss</span>`;
            }
        }
        
        const profitEl = document.getElementById('stat-profit');
        if (profitEl) {
            profitEl.innerText = `${totalProfit >= 0 ? '+' : ''}$${totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            profitEl.className = totalProfit >= 0 ? 'stat-number-text text-green' : 'stat-number-text text-red';
            
            const percentEl = profitEl.nextElementSibling;
            if (percentEl && initialBalance > 0) {
                const percentChange = ((totalProfit / initialBalance) * 100).toFixed(1);
                percentEl.innerText = `${totalProfit >= 0 ? '+' : ''}${percentChange}%`;
                percentEl.className = totalProfit >= 0 ? 'stat-subtext text-green' : 'stat-subtext text-red';
            }
        }
    }

    // FORM SUBMIT (FAQAT SIZNING FORMANGIZ ELEMENTLARINI TO'G'RI O'QIYDI)
    if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tradeId = editingIdInput ? editingIdInput.value : '';
        const trendValue = document.getElementById('trend').value;

        const tradeData = {
            date: document.getElementById('trade-date').value,
            time: document.getElementById('trade-time').value,
            pair: document.getElementById('pair').value.toUpperCase(),
            strategy: document.getElementById('strategy').value || 'No Setup',
            trend: trendValue,
            type: trendValue === 'Long' ? 'BUY' : 'SELL',
            pnl: parseFloat(document.getElementById('pnl').value) || 0,
            rr: parseFloat(document.getElementById('trade-rr').value) || 0, // 🟢 Formadagi RR ni oladi
            entryPrice: 0, size: 0.1, notes: 'No Setup'
        };

        try {
            if (tradeId) {
                await api.put(`/trades/${tradeId}`, tradeData);
                alert('Savdo tahrirlandi!');
            } else {
                await api.post('/trades', tradeData);
                alert('Savdo saqlandi!');
            }
            resetFormState();
            await fetchTrades();
        } catch (err) { alert(err.message || 'Xatolik!'); }
    });
}

    // TAHRIRLASH VA O'CHIRISH (ICON BOSILGANDA HAM ANIQ ISHLAYDI)
    function attachActionButtons() {
    // O'CHIRISH (DELETE)
    document.querySelectorAll('.btn-action-delete').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id'); 
            if (confirm('Ushbu savdoni rostdan ham o\'chirmoqchimisiz?')) {
                try { 
                    await api.delete(`/trades/${id}`); 
                    await fetchTrades(); 
                } catch (err) { alert('O\'chirishda xatolik!'); }
            }
        };
    });

    // TAHRIRLASH (EDIT)
    document.querySelectorAll('.btn-action-edit').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            try {
                const trades = await api.get('/trades');
                const trade = trades.find(t => t._id === id);
                if (trade) {
                    if (editingIdInput) editingIdInput.value = trade._id;
                    document.getElementById('trade-date').value = trade.date || '';
                    document.getElementById('trade-time').value = trade.time || '';
                    document.getElementById('pair').value = trade.pair || '';
                    document.getElementById('strategy').value = trade.strategy || '';
                    document.getElementById('trend').value = trade.trend || 'Long';
                    document.getElementById('pnl').value = trade.pnl || 0;
                    document.getElementById('trade-rr').value = trade.rr || 0; // 🟢 RR ni formaga qayta yuklaydi

                    if (formTitle) formTitle.innerText = "Savdoni Tahrirlash";
                    if (btnSaveTrade) btnSaveTrade.innerHTML = `<i data-lucide="check"></i> Yangilash`;
                    if (btnCancelEdit) btnCancelEdit.style.display = 'inline-block';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                    form.scrollIntoView({ behavior: 'smooth' });
                }
            } catch (err) { alert('Yuklashda xato!'); }
        };
    });
}function attachActionButtons() {
        // O'CHIRISH LOGIKASI
        document.querySelectorAll('.btn-action-delete').forEach(btn => {
            btn.onclick = async () => {
                // e.target o'rniga to'g'ridan-to'g'ri btn elementining data-id sini olamiz!
                const id = btn.getAttribute('data-id');
                if (confirm('Ushbu savdoni rostdan ham o\'chirmoqchimisiz?')) {
                    try {
                        await api.delete(`/trades/${id}`);
                        await fetchTrades();
                    } catch (err) {
                        alert('O\'chirishda xatolik yuz berdi!');
                    }
                }
            };
        });

        // TAHRIRLASH LOGIKASI
        document.querySelectorAll('.btn-action-edit').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.getAttribute('data-id');
                try {
                    const trades = await api.get('/trades');
                    const trade = trades.find(t => t._id === id);
                    
                    if (trade) {
                        // Formani bazadan kelgan aniq qiymatlar bilan to'ldiramir
                        if (editingIdInput) editingIdInput.value = trade._id;
                        if (document.getElementById('trade-date')) document.getElementById('trade-date').value = trade.date || '';
                        if (document.getElementById('trade-time')) document.getElementById('trade-time').value = trade.time || '';
                        if (document.getElementById('pair')) document.getElementById('pair').value = trade.pair || '';
                        if (document.getElementById('strategy')) document.getElementById('strategy').value = trade.strategy || '';
                        if (document.getElementById('trend')) document.getElementById('trend').value = trade.trend || 'Long';
                        if (document.getElementById('pnl')) document.getElementById('pnl').value = trade.pnl || 0;
                        
                        // Formani vizual tahrirlash holatiga o'tkazish
                        if (formTitle) formTitle.innerText = "Savdoni Tahrirlash";
                        if (btnSaveTrade) btnSaveTrade.innerHTML = `<i data-lucide="check"></i> Yangilash`;
                        if (btnCancelEdit) btnCancelEdit.style.display = 'inline-block';
                        
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                        form.scrollIntoView({ behavior: 'smooth' });
                    }
                } catch (err) {
                    alert('Ma\'lumot yuklashda xatolik!');
                }
            };
        });
    }

    if (btnCancelEdit) {
        btnCancelEdit.addEventListener('click', resetFormState);
    }

    function resetFormState() {
    if (form) form.reset();
    if (editingIdInput) editingIdInput.value = '';
    if (formTitle) formTitle.innerText = "Yangi Savdo Kiritish";
    if (btnSaveTrade) btnSaveTrade.innerHTML = `<i data-lucide="plus"></i> Saqlash`;
    if (btnCancelEdit) btnCancelEdit.style.display = 'none';
    if (typeof setDefaultDateTime === 'function') setDefaultDateTime();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

    // MENU NAVIGATSIYA
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    const sections = document.querySelectorAll('.dashboard-section');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            const targetSectionId = item.getAttribute('data-target');
            sections.forEach(section => {
                if (section.id === targetSectionId) {
                    section.classList.add('active-section');
                } else {
                    section.classList.remove('active-section');
                }
            });
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    });

    // LOGOUT
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user_verified');
            window.location.href = 'login.html';
        });
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();

    const targetButtons = [
        document.querySelector('.btn-add-trade'),
        document.querySelector('.link-view-all')
    ];

    targetButtons.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const journalMenuItem = document.querySelector('.sidebar-menu .menu-item[data-target="sec-journal"]');
                if (journalMenuItem) journalMenuItem.click();
            });
        }
    });
});