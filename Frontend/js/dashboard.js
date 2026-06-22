document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    
    // 1. Agar foydalanuvchi umuman login qilmagan bo'lsa, srazu loginga haydaydi
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const tbody = document.getElementById('trades-tbody');
    const form = document.getElementById('trade-form');
    const usernameDisplay = document.getElementById('username-display');
    
    // Onboarding balansini saqlash uchun o'zgaruvchi
    let initialBalance = 0;

    // 2. Foydalanuvchi profilini va SaaS qadamlarini tekshirish
    try {
        const user = await api.get('/auth/profile');
        
        // Agar email tasdiqlanmagan bo'lsa, verify sahifasiga qaytaradi
        if (!user.isVerified) {
            window.location.href = 'verify.html';
            return;
        }
        
        // Agar ilk sozlamalar kiritilmagan bo'lsa, onboarding sahifasiga qaytaradi
        if (!user.isOnboarded) {
            window.location.href = 'onboarding.html';
            return;
        }

        // Ma'lumotlarni o'rnatish
        if (usernameDisplay && user) {
            usernameDisplay.innerText = user.username;
        }
        
        // Boshlang'ich balansni saqlab qo'yamiz
        initialBalance = user.initialBalance || 0;

        // Profil muvaffaqiyatli tekshirilgach, savdolarni yuklaymiz
        await fetchTrades();

    } catch (err) {
        console.error('Profil yuklanishida xato yoki token eskirgan:', err);
        localStorage.removeItem('token');
        window.location.href = 'login.html';
        return;
    }

    // Savdolarni bazadan tortib kelish funksiyasi
    async function fetchTrades() {
        try {
            const trades = await api.get('/trades');
            renderTrades(trades);
        } catch (err) {
            console.error('Savdolarni yuklashda xatolik:', err);
        }
    }

    // Ma'lumotlarni jadvalga chizish
    function renderTrades(trades) {
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

    // Statistikani yangilash
    function updateStats(totalPnL, openCount, closedCount) {
        // PnL o'zgarishi
        const pnlEl = document.getElementById('total-pnl');
        if (pnlEl) {
            pnlEl.innerText = `$${totalPnL.toFixed(2)}`;
            pnlEl.className = totalPnL >= 0 ? 'text-green' : 'text-red';
        }

        // Yangi: Real vaqtdagi joriy balans (Boshlang'ich balans + PnL)
        const currentBalanceEl = document.getElementById('current-balance');
        if (currentBalanceEl) {
            const currentBalance = initialBalance + totalPnL;
            currentBalanceEl.innerText = `$${currentBalance.toFixed(2)}`;
        }

        // Yangi: Boshlang'ich balansni ko'rsatish
        const initialBalanceEl = document.getElementById('initial-balance');
        if (initialBalanceEl) {
            initialBalanceEl.innerText = `$${initialBalance.toFixed(2)}`;
        }

        if (document.getElementById('open-count')) document.getElementById('open-count').innerText = `${openCount} ta`;
        if (document.getElementById('closed-count')) document.getElementById('closed-count').innerText = `${closedCount} ta`;
    }

    // Yangi Savdo Qo'shish formasi yuborilganda
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
                fetchTrades(); // Ro'yxatni bazadan qayta yangilaydi
            } catch (err) {
                alert(err.message || 'Savdo qoʻshishda xatolik!');
            }
        });
    }

    // Tizimdan chiqish tugmasi
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
        });
    }
});