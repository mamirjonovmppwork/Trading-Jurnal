import api from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const dbTbody = document.getElementById('dashboard-trades-list');    // Dashboard jadvali
    const journalTbody = document.getElementById('journal-trades-list'); // Jurnal jadvali // Journal to'liq jadvali
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

   // ==========================================================================
// VAQT BO'YICHA TRADING SESSIYASINI AVTOMATIK ANIQLASH (UZB VAQTI UTC+5)
// ==========================================================================
function getTradingSession(timeString) {
    if (!timeString) return "OTHER";
    const [hours, minutes] = timeString.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;

    const asianStart = 0 * 60;   // 00:00
    const asianEnd = 9 * 60;     // 09:00
    const londonStart = 12 * 60; // 12:00
    const nyStart = 17 * 60;     // 17:00
    const nyEnd = 24 * 60;       // 00:00 gacha

    if (totalMinutes >= asianStart && totalMinutes < asianEnd) {
        return "ASIAN";
    } else if (totalMinutes >= londonStart && totalMinutes < nyStart) {
        return "LONDON";
    } else if (totalMinutes >= nyStart && totalMinutes < nyEnd) {
        return "NEW_YORK";
    } else {
        return "OTHER";
    }
}

// ==========================================================================
// ASOSIY SAVDOLARNI BACKENDDAN OLISH VA JADVALGA CHIZISH TIZIMI
// ==========================================================================

async function fetchTrades() {
    try {
        const response = await api.get('/trades'); 
        const trades = response.data || response;

        // Ma'lumotlarni ikkala jadvalga yuboramiz
        renderTrades(trades);
    } catch (err) {
        console.error("Savdolarni yuklashda xatolik:", err);
    }
}

function renderTrades(trades) {
    // 1. Ikkala alohida jadval tanasini DOM'dan toza qidiramiz
    const dbTbody = document.getElementById('dashboard-trades-list');    // Dashboard mini jadvali
    const journalTbody = document.getElementById('journal-trades-list'); // Jurnal to'liq jadvali
    
    // Global statistika hisoblagichlari
    let totalTrades = trades ? trades.length : 0;
    let wins = 0; let losses = 0; let totalProfit = 0;

    if (trades && trades.length > 0) {
        trades.forEach(trade => {
            const tradePnL = parseFloat(trade.pnl) || 0;
            totalProfit += tradePnL;
            if (tradePnL > 0) wins++; else if (tradePnL < 0) losses++;
        });
    }

    // Global statistika panellarini yangilash (agar funksiya mavjud bo'lsa)
    if (typeof updateStats === 'function') {
        updateStats(totalTrades, wins, losses, totalProfit);
    }

    // 2. DASHBOARD MINI-JADVALINI TO'LDIRISH (Faqat oxirgi 3-4 ta trade)
    if (dbTbody) {
        dbTbody.innerHTML = '';
        if (!trades || trades.length === 0) {
            dbTbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:#64748b;">Hozircha savdolar yo'q.</td></tr>`;
        } else {
            const dashboardTrades = trades.slice(0, 4); 
            dashboardTrades.forEach((trade) => {
                const trDb = document.createElement('tr');
                trDb.innerHTML = generateTradeRowHTML(trade, false); 
                dbTbody.appendChild(trDb);
            });
        }
    }

    // 3. JURNAL TO'LIQ JADVALINI TO'LDIRISH (Barcha tradelar cheklovsiz)
    if (journalTbody) {
        journalTbody.innerHTML = '';
        if (!trades || trades.length === 0) {
            journalTbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:3rem; color:#64748b;">Hozircha jurnal bo'sh.</td></tr>`;
        } else {
            trades.forEach((trade) => {
                const trJournal = document.createElement('tr');
                trJournal.innerHTML = generateTradeRowHTML(trade, true); 
                journalTbody.appendChild(trJournal);
            });
        }
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (typeof attachActionButtons === 'function') attachActionButtons(); 
}

// 🟢 JADVAL QATORI UCHUN TOZA HTML GENERATORI
function generateTradeRowHTML(trade, isJournal = false) {
    const tradePnL = parseFloat(trade.pnl) || 0;
    const displayDate = trade.date || '';
    const displayTime = trade.time ? trade.time.substring(0, 5) : '';
    const isShort = trade.trend && trade.trend.toLowerCase().includes('short');
    const isWin = tradePnL >= 0;
    const pnlClass = isWin ? 'text-green' : 'text-red';
    
    const realRR = trade.rr ? parseFloat(trade.rr).toFixed(1) : '0.0';
    const rrDisplay = `${isWin ? '+' : '-'}${realRR}R`;

    let html = `
        <td class="text-muted">${displayDate} ${displayTime}</td>
        <td class="font-bold">${trade.pair ? trade.pair.toUpperCase() : '—'}</td>
        <td><span class="badge-setup">${trade.strategy || 'No Setup'}</span></td>
        <td><span class="direction-indicator ${isShort ? 'short' : 'long'}"><span class="dot"></span> ${isShort ? 'Short' : 'Long'}</span></td>
        <td><span class="badge-result ${isWin ? 'win' : 'loss'}">${isWin ? 'Win' : 'Loss'}</span></td>
        <td class="${pnlClass} font-semibold">${rrDisplay}</td>
        <td class="${pnlClass} font-bold">${isWin ? '+' : ''}$${tradePnL.toFixed(2)}</td>
    `;

    if (isJournal) {
        html += `
            <td style="text-align: center; white-space: nowrap;">
                <button class="btn-action-edit" data-id="${trade._id}" title="Tahrirlash" style="background: none; border: none; color: #2563eb; cursor: pointer; padding: 4px; margin-right: 8px;">
                    <i data-lucide="edit-3" style="width: 18px; height: 18px;"></i>
                </button>
                <button class="btn-action-delete" data-id="${trade._id}" title="O'chirish" style="background: none; border: none; color: #dc2626; cursor: pointer; padding: 4px;">
                    <i data-lucide="trash-2" style="width: 18px; height: 18px;"></i>
                </button>
            </td>
        `;
    } 

    return html;
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
        if (percentEl && typeof initialBalance !== 'undefined' && initialBalance > 0) {
            const percentChange = ((totalProfit / initialBalance) * 100).toFixed(1);
            percentEl.innerText = `${totalProfit >= 0 ? '+' : ''}${percentChange}%`;
            percentEl.className = totalProfit >= 0 ? 'stat-subtext text-green' : 'stat-subtext text-red';
        }
    }
}

// ==========================================================================
// FORM SUBMIT HOZIRGI YANGI PARAMETRLAR BILAN (KAYFIYAT VA AVTO SESSIYA)
// ==========================================================================
const form = document.getElementById('trade-form');
const editingIdInput = document.getElementById('editing-trade-id');

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tradeId = editingIdInput ? editingIdInput.value : '';
        const trendValue = document.getElementById('trend').value;
        const timeValue = document.getElementById('trade-time').value;

        // Vaqt o'zgarishi bilan fonda avtomatik sessiya aniqlanadi
        const computedSession = getTradingSession(timeValue);

        const tradeData = {
            date: document.getElementById('trade-date').value,
            time: timeValue,
            pair: document.getElementById('pair').value.toUpperCase(),
            strategy: document.getElementById('strategy').value || 'No Setup',
            trend: trendValue,
            type: trendValue === 'Long' ? 'BUY' : 'SELL',
            pnl: parseFloat(document.getElementById('pnl').value) || 0,
            rr: parseFloat(document.getElementById('trade-rr').value) || 0,
            psychology_before: document.getElementById('psychology-before').value, // 🟢 Yangi maydon
            notes: document.getElementById('notes').value || 'No Notes',           // 🟢 Yangi maydon
            session: computedSession,                                             // 🟢 Avto-sessiya
            entryPrice: 0, 
            size: 0.1
        };

        try {
            if (tradeId) {
                await api.put(`/trades/${tradeId}`, tradeData);
                alert('Savdo tahrirlandi!');
            } else {
                await api.post('/trades', tradeData);
                alert('Savdo saqlandi!');
            }
            if (typeof resetFormState === 'function') resetFormState();
            await fetchTrades();
        } catch (err) { 
            alert(err.message || 'Xatolik!'); 
        }
    });
}

// 🟢 AGAR SIZDA TAHRIRLASH TUGMASI BOSILGANDA ELEMENTLARNI FORMAGA YUKLASH FUNKSIYASI BO'LSA
// Shu qismiga yangi maydonlarni ham kiritib ketishingiz kerak:
function populateFormForEdit(trade) {
    if (!trade) return;
    if (editingIdInput) editingIdInput.value = trade._id;
    
    if (document.getElementById('trade-date')) document.getElementById('trade-date').value = trade.date || '';
    if (document.getElementById('trade-time')) document.getElementById('trade-time').value = trade.time || '';
    if (document.getElementById('pair')) document.getElementById('pair').value = trade.pair || '';
    if (document.getElementById('strategy')) document.getElementById('strategy').value = trade.strategy === 'No Setup' ? '' : (trade.strategy || '');
    if (document.getElementById('trend')) document.getElementById('trend').value = trade.trend || 'Long';
    if (document.getElementById('pnl')) document.getElementById('pnl').value = trade.pnl || '';
    if (document.getElementById('trade-rr')) document.getElementById('trade-rr').value = trade.rr || '';
    
    // Tahrirlash rejimida yangi maydonlarni to'ldirish
    if (document.getElementById('psychology-before')) document.getElementById('psychology-before').value = trade.psychology_before || 'Tinch';
    if (document.getElementById('notes')) document.getElementById('notes').value = trade.notes === 'No Notes' ? '' : (trade.notes || '');

    const btnSave = document.getElementById('btn-save-trade');
    const btnCancel = document.getElementById('btn-cancel-edit');
    
    if (btnSave) btnSave.innerHTML = `<i data-lucide="edit-3"></i> Yangilash`;
    if (btnCancel) btnCancel.style.display = 'inline-block';
    if (typeof lucide !== 'undefined') lucide.createIcons();
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
    // Global o'zgaruvchi (barcha yuklangan trades ma'lumotlarini eslab qolish uchun)
let localTradesArray = [];

// Eski fetchTrades funksiyang bo'lsa, uni bazadan ma'lumot olganda o'zgaruvchiga ham yozadigan qilamiz
const originalFetchTrades = fetchTrades;
fetchTrades = async function() {
    try {
        const trades = await api.get('/trades');
        localTradesArray = trades || [];
        
        // Dastlabki yuklanganda statistika oynasiga umumiy ma'lumotni chiqarib qo'yamiz
        updateFilterStats(localTradesArray);
        
        if (typeof originalFetchTrades === 'function') {
            await originalFetchTrades();
        } else {
            renderTrades(localTradesArray);
        }
    } catch (err) {
        console.error("Trades yuklashda xato:", err);
    }
};

// 🔙 BACK (ORQAGA) TUGMASI BOSILGANDA
const btnJournalBack = document.getElementById('btn-journal-back');
if (btnJournalBack) {
    btnJournalBack.addEventListener('click', () => {
        const secJournal = document.getElementById('sec-journal');
        const secDashboard = document.getElementById('sec-dashboard');
        
        if (secJournal) secJournal.style.display = 'none';
        if (secDashboard) secDashboard.style.display = 'block';
        
        // Sidebar menyusidagi faollikni (active) Dashboardga qaytaradi
        document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
        const dbMenu = document.querySelector('[data-target="sec-dashboard"]');
        if (dbMenu) dbMenu.classList.add('active');
    });
}

// 📅 SANA FILTRI LOGIKASI
const filterDateInput = document.getElementById('filter-date');
const btnClearFilter = document.getElementById('btn-clear-filter');

if (filterDateInput) {
    filterDateInput.addEventListener('input', () => {
        const selectedDate = filterDateInput.value; // Format: YYYY-MM-DD
        if (!selectedDate) {
            resetJournalFilter();
            return;
        }

        if (btnClearFilter) btnClearFilter.style.display = 'inline-block';

        // Tanlangan sanaga teng bo'lgan trades'ni ajratib olish
        const filtered = localTradesArray.filter(trade => {
            if (!trade.date) return false;
            // Bazadan kelgan sanani formatini normallashtirish (YYYY-MM-DD shakliga)
            const tradeDateNorm = trade.date.includes('-') ? trade.date : new Date(trade.date).toISOString().split('T')[0];
            return tradeDateNorm === selectedDate;
        });

        // Jurnal jadvaliga faqat filterlanganlarini chizish
        renderTrades(filtered);
        // Statistika oynasini o'sha kunnikiga yangilash
        updateFilterStats(filtered);
    });
}

// FILTRNI TOZALASH BOSILGANDA
if (btnClearFilter) {
    btnClearFilter.addEventListener('click', () => {
        if (filterDateInput) filterDateInput.value = '';
        resetJournalFilter();
    });
}

function resetJournalFilter() {
    if (btnClearFilter) btnClearFilter.style.display = 'none';
    renderTrades(localTradesArray);
    updateFilterStats(localTradesArray);
}

// KUNLIK STATISTIKANI HISOB-KITOB QILISH FUNKSIYASI
function updateFilterStats(tradesList) {
    const fCountEl = document.getElementById('f-count');
    const fPnLEl = document.getElementById('f-pnl');
    
    let totalPnL = 0;
    tradesList.forEach(t => totalPnL += (parseFloat(t.pnl) || 0));

    if (fCountEl) fCountEl.innerText = tradesList.length;
    if (fPnLEl) {
        fPnLEl.innerText = `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`;
        fPnLEl.style.color = totalPnL >= 0 ? '#34d399' : '#f43f5e'; // Foyda yashil, zarar qizil
    }
}
});