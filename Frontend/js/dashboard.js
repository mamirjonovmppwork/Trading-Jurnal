import api from './api.js';

// ==========================================================================
// TRADEJOUNAL — ASOSIY FAYL (TOZA VA TARTIBLI)
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {

    // ------------------------------------------------------------------
    // 1. GLOBAL O'ZGARUVCHILAR
    // ------------------------------------------------------------------
    let localTradesArray = [];
    let initialBalance   = 0;
    let currentEquityRange = 'all'; // 'all' | 'month' | 'week'

    // DOM elementlari
    const form           = document.getElementById('trade-form');
    const editingIdInput = document.getElementById('editing-trade-id');
    const formTitle      = document.getElementById('form-title');
    const btnSaveTrade   = document.getElementById('btn-save-trade');
    const btnCancelEdit  = document.getElementById('btn-cancel-edit');
    const btnJournalBack = document.getElementById('btn-journal-back');
    const filterDateInput = document.getElementById('filter-date');
    const btnClearFilter  = document.getElementById('btn-clear-filter');
    const usernameDisplay = document.getElementById('user-name');
    const logoutBtn       = document.getElementById('logout-btn');

    // ------------------------------------------------------------------
    // 2. AUTH TEKSHIRUV
    // ------------------------------------------------------------------
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // ------------------------------------------------------------------
    // 3. PROFIL YUKLASH
    // ------------------------------------------------------------------
    try {
        const user = await api.get('/auth/profile');
        const localVerified = localStorage.getItem('user_verified') === 'true';

        if (!user.isVerified && !localVerified) {
            window.location.href = 'verify.html';
            return;
        }

        if (usernameDisplay) {
            usernameDisplay.innerText = user.username || 'Foydalanuvchi';
        }
        initialBalance = user.initialBalance || 0;

    } catch (err) {
        console.error('Profil yuklashda xatolik:', err);
        const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        if (isLocal) {
            if (usernameDisplay) usernameDisplay.innerText = 'Muhammadaziz (Dev)';
        } else {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
            return;
        }
    }

    // Birinchi yuklash
    await fetchTrades();
    setDefaultDateTime();

    // ------------------------------------------------------------------
    // 4. YORDAMCHI FUNKSIYALAR
    // ------------------------------------------------------------------

    /** Bugungi sana va vaqtni formaga avtomatik qo'yadi */
    function setDefaultDateTime() {
        const dateInput = document.getElementById('trade-date');
        const timeInput = document.getElementById('trade-time');
        if (dateInput && timeInput) {
            const now = new Date();
            dateInput.value = now.toISOString().split('T')[0];
            timeInput.value = now.toTimeString().substring(0, 5);
        }
    }

    /**
     * Vaqtga qarab sessiyani avtomatik aniqlaydi (UZB vaqti UTC+5)
     * 00:00–09:00 → ASIAN | 09:00–12:00 → LONDON_OPEN
     * 12:00–17:00 → LONDON | 17:00–21:00 → NEW_YORK | 21:00–00:00 → OFF
     */
    function getTradingSession(timeString) {
        if (!timeString) return 'OTHER';
        const [h, m] = timeString.split(':').map(Number);
        const t = h * 60 + m;

        if (t >= 0   && t < 540)  return 'ASIAN';
        if (t >= 540 && t < 720)  return 'LONDON_OPEN';
        if (t >= 720 && t < 1020) return 'LONDON';
        if (t >= 1020 && t < 1260) return 'NEW_YORK';
        return 'OFF';
    }

    /** Sessiya nomini chiroyli ko'rsatish uchun */
    function sessionLabel(session) {
        const map = {
            ASIAN:       '🌏 Asian',
            LONDON_OPEN: '🇬🇧 London Open',
            LONDON:      '🇬🇧 London',
            NEW_YORK:    '🇺🇸 New York',
            OFF:         '🌙 Off hours',
            OTHER:       '—',
        };
        return map[session] || session || '—';
    }

    // ------------------------------------------------------------------
    // 5. API — SAVDOLARNI YUKLASH
    // ------------------------------------------------------------------
    async function fetchTrades() {
        try {
            const response = await api.get('/trades');
            localTradesArray = Array.isArray(response) ? response : (response.data || []);
            renderTrades(localTradesArray);
            renderEquityCurve(localTradesArray, currentEquityRange);
        } catch (err) {
            console.error('Savdolarni yuklashda xatolik:', err);
        }
    }

    // ------------------------------------------------------------------
    // 6. RENDER — JADVALLAR VA STATISTIKA
    // ------------------------------------------------------------------
    function renderTrades(trades) {
        const dbTbody      = document.getElementById('dashboard-trades-list');
        const journalTbody = document.getElementById('journal-trades-list');

        // Statistika hisoblash
        let wins = 0, losses = 0, totalProfit = 0;
        (trades || []).forEach(t => {
            const pnl = parseFloat(t.pnl) || 0;
            totalProfit += pnl;
            if (pnl > 0) wins++;
            else if (pnl < 0) losses++;
        });

        updateStats(trades ? trades.length : 0, wins, losses, totalProfit);
        updateFilterStats(trades || []);
        updateSessionStats(trades || []);

        // Dashboard — oxirgi 4 ta
        if (dbTbody) {
            dbTbody.innerHTML = '';
            if (!trades || trades.length === 0) {
                dbTbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:#64748b;">Hozircha savdolar yo'q.</td></tr>`;
            } else {
                trades.slice(0, 4).forEach(trade => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = buildTradeRow(trade, false);
                    dbTbody.appendChild(tr);
                });
            }
        }

        // Journal — barchasi
        if (journalTbody) {
            journalTbody.innerHTML = '';
            if (!trades || trades.length === 0) {
                journalTbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:3rem;color:#64748b;">Hozircha jurnal bo'sh.</td></tr>`;
            } else {
                trades.forEach(trade => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = buildTradeRow(trade, true);
                    journalTbody.appendChild(tr);
                });
            }
        }

        // Xato ko'zgusi — real savdolarga asoslangan ogohlantirishlar
        updateSessionAlerts(trades || []);

        if (typeof lucide !== 'undefined') lucide.createIcons();
        attachActionButtons();
    }

    // ------------------------------------------------------------------
    // 6a. EQUITY CURVE — haqiqiy savdolar asosida SVG grafik
    // ------------------------------------------------------------------

    /** Tanlangan davr bo'yicha savdolarni filtrlaydi */
    function filterTradesByRange(trades, range) {
        if (range === 'all' || !range) return trades;

        const now = new Date();
        let cutoff;

        if (range === 'month') {
            cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (range === 'week') {
            cutoff = new Date(now);
            const day = cutoff.getDay(); // 0=Yaksh, 1=Dush...
            const diffToMonday = day === 0 ? 6 : day - 1;
            cutoff.setDate(cutoff.getDate() - diffToMonday);
            cutoff.setHours(0, 0, 0, 0);
        } else {
            return trades;
        }

        return trades.filter(t => {
            if (!t.date) return false;
            const d = new Date(`${t.date}T${t.time || '00:00'}`);
            return !isNaN(d) && d >= cutoff;
        });
    }

    /** Savdolarni xronologik tartiblab, kumulyativ PnL qatorini hisoblaydi */
    function computeEquitySeries(trades) {
        const sorted = [...(trades || [])]
            .filter(t => t.date)
            .sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`));

        let cumulative = 0;
        return sorted.map(t => {
            cumulative += parseFloat(t.pnl) || 0;
            return { date: t.date, value: cumulative };
        });
    }

    /** Sanani "24 Iyun" ko'rinishida qisqa formatlaydi */
    function formatShortDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        const months = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
        return `${d.getDate()} ${months[d.getMonth()]}`;
    }

    /** Nuqtalar asosida silliq (Catmull-Rom → Bezier) SVG chizig'ini quradi */
    function buildSmoothLinePath(coords) {
        if (coords.length === 0) return '';
        if (coords.length === 1) return `M${coords[0].x},${coords[0].y} L${coords[0].x + 1},${coords[0].y}`;

        let d = `M${coords[0].x.toFixed(2)},${coords[0].y.toFixed(2)}`;
        for (let i = 0; i < coords.length - 1; i++) {
            const p0 = coords[i === 0 ? 0 : i - 1];
            const p1 = coords[i];
            const p2 = coords[i + 1];
            const p3 = coords[i + 2 < coords.length ? i + 2 : i + 1];

            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;

            d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
        }
        return d;
    }

    /** Equity Curve'ni haqiqiy savdolar asosida chizadi */
    function renderEquityCurve(allTrades, range) {
        const fillPathEl  = document.getElementById('equity-fill-path');
        const linePathEl  = document.getElementById('equity-line-path');
        const badgeEl     = document.getElementById('equity-badge');
        const labelsEl    = document.getElementById('equity-timeline-labels');
        const emptyStateEl = document.getElementById('equity-empty-state');
        if (!fillPathEl || !linePathEl) return;

        const filtered = filterTradesByRange(allTrades, range);
        const points    = computeEquitySeries(filtered);

        const width = 1000, height = 200, padTop = 20, padBottom = 20;

        // Nuqta bo'lmasa — tekis chiziq va bo'sh holat xabari
        if (points.length === 0) {
            const flatY = height / 2;
            linePathEl.setAttribute('d', `M0,${flatY} L${width},${flatY}`);
            fillPathEl.setAttribute('d', `M0,${flatY} L${width},${flatY} L${width},${height} L0,${height} Z`);
            if (badgeEl) {
                badgeEl.innerText = '+$0.00';
                badgeEl.style.color = '';
            }
            if (labelsEl) labelsEl.innerHTML = '';
            if (emptyStateEl) emptyStateEl.style.display = 'block';
            return;
        }

        if (emptyStateEl) emptyStateEl.style.display = 'none';

        // Boshlang'ich 0 nuqtasini qo'shamiz — grafik "0" dan boshlanib ko'rinadi
        const series = [{ date: points[0].date, value: 0 }, ...points];

        const values = series.map(p => p.value);
        let min = Math.min(...values);
        let max = Math.max(...values);
        if (min === max) { min -= 1; max += 1; } // tekis qiymatlarda bo'linishni oldini olish

        const n = series.length;
        const coords = series.map((p, i) => {
            const x = n === 1 ? 0 : (i / (n - 1)) * width;
            const y = height - padBottom - ((p.value - min) / (max - min)) * (height - padTop - padBottom);
            return { x, y };
        });

        const linePath = buildSmoothLinePath(coords);
        const fillPath = `${linePath} L${width},${height} L0,${height} Z`;

        linePathEl.setAttribute('d', linePath);
        fillPathEl.setAttribute('d', fillPath);

        // PnL badge
        const finalValue = points[points.length - 1].value;
        if (badgeEl) {
            const sign = finalValue >= 0 ? '+' : '-';
            badgeEl.innerText = `${sign}$${Math.abs(finalValue).toFixed(2)}`;
            badgeEl.style.color = finalValue >= 0 ? '#16a34a' : '#dc2626';
        }

        // Vaqt o'qi belgilari — nuqtalardan teng oraliqda tanlanadi
        if (labelsEl) {
            labelsEl.innerHTML = '';
            const labelCount = Math.min(7, points.length);
            const step = points.length > 1 ? (points.length - 1) / (labelCount - 1) : 0;
            const seen = new Set();
            for (let i = 0; i < labelCount; i++) {
                const idx = Math.round(i * step);
                if (seen.has(idx)) continue;
                seen.add(idx);
                const span = document.createElement('span');
                span.innerText = formatShortDate(points[idx].date);
                labelsEl.appendChild(span);
            }
        }
    }

    // ------------------------------------------------------------------
    // 6b. XATO KO'ZGUSI — ogohlantirishlar generatori
    // ------------------------------------------------------------------
    function updateSessionAlerts(trades) {
        const container  = document.getElementById('alert-list-container');
        const emptyState = document.getElementById('alert-empty-state');
        if (!container) return;

        // Kamida 3 ta savdo bo'lmasa
        if (!trades || trades.length < 3) {
            container.innerHTML = '';
            const msg = document.createElement('div');
            msg.className = 'alert-empty';
            msg.innerHTML = `<i data-lucide="inbox"></i>
                <span>Tahlil uchun kamida 3 ta savdo kerak (hozir: ${trades ? trades.length : 0} ta).</span>`;
            container.appendChild(msg);
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        // ---- MA'LUMOT YIGISH ----
        const sessions = {
            ASIAN:    { total: 0, wins: 0, label: 'Asian sessiyasi'    },
            LONDON:   { total: 0, wins: 0, label: 'London sessiyasi'   },
            NEW_YORK: { total: 0, wins: 0, label: 'New York sessiyasi' },
        };
        const moods = {
            FOMO:       { total: 0, wins: 0, label: 'FOMO holatida'      },
            Shoshilgan: { total: 0, wins: 0, label: 'Shoshilgan holatda' },
            Jahldor:    { total: 0, wins: 0, label: "G'azab holatida"    },
            Tinch:      { total: 0, wins: 0, label: 'Sokin holatda'      },
            Ishonchli:  { total: 0, wins: 0, label: 'Ishonch bilan'      },
        };
        const setupStats = {};
        const dayNames   = { 0:'Yakshanba',1:'Dushanba',2:'Seshanba',3:'Chorshanba',4:'Payshanba',5:'Juma',6:'Shanba' };
        const dayData    = {};

        trades.forEach(t => {
            const pnl   = parseFloat(t.pnl) || 0;
            const isWin = pnl > 0;

            // Sessiya
            let sKey = t.session || getTradingSession(t.time) || 'LONDON';
            if (sKey === 'LONDON_OPEN' || sKey === 'OFF') sKey = 'LONDON';
            if (sessions[sKey]) { sessions[sKey].total++; if (isWin) sessions[sKey].wins++; }

            // Kayfiyat
            const mKey = t.psychology_before;
            if (mKey && moods[mKey]) { moods[mKey].total++; if (isWin) moods[mKey].wins++; }

            // Setup
            const setup = t.strategy || 'No Setup';
            if (!setupStats[setup]) setupStats[setup] = { total: 0, wins: 0 };
            setupStats[setup].total++;
            if (isWin) setupStats[setup].wins++;

            // Kun
            if (t.date) {
                const d = new Date(t.date).getDay();
                if (!dayData[d]) dayData[d] = { total: 0, wins: 0 };
                dayData[d].total++;
                if (isWin) dayData[d].wins++;
            }
        });

        // ---- OGOHLANTIRISHLAR ----
        const alerts = [];

        // 1. Sessiya
        Object.entries(sessions).forEach(([, s]) => {
            if (s.total < 2) return;
            const wr = Math.round((s.wins / s.total) * 100);
            if (wr <= 30) {
                alerts.push({ type:'danger',  icon:'trending-down',   title:`${s.label} xavfli!`,        desc:`${s.total} savdodan ${s.wins} tasi WIN — winrate ${wr}%. Bu sessionda ehtiyot bo'ling.`, badge:'Diqqat!'     });
            } else if (wr <= 49) {
                alerts.push({ type:'warning', icon:'alert-triangle',  title:`${s.label} — past natija`,  desc:`Winrate ${wr}%. Strategiyangizni qayta ko'rib chiqing.`,                                  badge:'Tekshiring'  });
            } else if (wr >= 75 && s.total >= 3) {
                alerts.push({ type:'success', icon:'check-circle',    title:`${s.label} — kuchli zona!`, desc:`${s.total} savdodan ${s.wins} tasi WIN — winrate ${wr}%. Bu sessionda davom eting.`,      badge:"Zo'r!"       });
            }
        });

        // 2. Kayfiyat
        Object.entries(moods).forEach(([key, m]) => {
            if (m.total < 2) return;
            const wr = Math.round((m.wins / m.total) * 100);
            if (['FOMO','Shoshilgan','Jahldor'].includes(key) && wr <= 40) {
                alerts.push({ type:'danger',  icon:'brain', title:`${m.label} savdo qilmang!`,   desc:`Bu kayfiyatda ${m.total} savdo — winrate atigi ${wr}%. Kompyuterni yoping.`,     badge:'Xavfli!'  });
            } else if (['Tinch','Ishonchli'].includes(key) && wr >= 70) {
                alerts.push({ type:'success', icon:'smile', title:`${m.label} natija yaxshi!`,   desc:`Bu kayfiyatda winrate ${wr}% — savdo qilish uchun eng qulay holat.`,              badge:"Zo'r!"    });
            }
        });

        // 3. Setup
        let bestKey = '', bestWr = 0, worstKey = '', worstWr = 101;
        Object.entries(setupStats).forEach(([k, v]) => {
            if (v.total < 2) return;
            const wr = (v.wins / v.total) * 100;
            if (wr > bestWr)  { bestWr  = wr; bestKey  = k; }
            if (wr < worstWr) { worstWr = wr; worstKey = k; }
        });
        if (bestKey && Math.round(bestWr) >= 70) {
            alerts.push({ type:'info',    icon:'star',    title:`Eng kuchli setup: ${bestKey}`, desc:`${Math.round(bestWr)}% winrate — bu setup sizga eng ko'p foyda keltiradi.`,        badge:'Maslahat' });
        }
        if (worstKey && worstKey !== bestKey && Math.round(worstWr) <= 35) {
            alerts.push({ type:'warning', icon:'x-circle', title:`Zaif setup: ${worstKey}`,    desc:`${Math.round(worstWr)}% winrate — bu setupdan uzoqroq bo'ling yoki qayta o'rganing.`, badge:"Qayta o'rganing" });
        }

        // 4. Kun
        let worstDay = '', worstDayWr = 101;
        Object.entries(dayData).forEach(([d, v]) => {
            if (v.total < 2) return;
            const wr = (v.wins / v.total) * 100;
            if (wr < worstDayWr) { worstDayWr = wr; worstDay = d; }
        });
        if (worstDay !== '' && Math.round(worstDayWr) <= 35) {
            alerts.push({ type:'warning', icon:'calendar-x', title:`${dayNames[worstDay]} kuni xavfli`, desc:`Bu kunda winrate ${Math.round(worstDayWr)}% — imkon bo'lsa savdodan tiyiling.`, badge:'Diqqat' });
        }

        // ---- DOM GA CHIZISH ----
        container.innerHTML = '';

        if (alerts.length === 0) {
            container.innerHTML = `
                <div class="alert-item info">
                    <div class="alert-icon"><i data-lucide="check-circle-2"></i></div>
                    <div class="alert-body">
                        <div class="alert-title">Hamma narsa yaxshi!</div>
                        <div class="alert-desc">Hozircha alohida ogohlantirish yo'q. Savdo qilishda davom eting.</div>
                    </div>
                    <span class="alert-badge">Ajoyib</span>
                </div>`;
        } else {
            const order = { danger:0, warning:1, success:2, info:3 };
            alerts.sort((a, b) => order[a.type] - order[b.type]);
            alerts.forEach(a => {
                const div = document.createElement('div');
                div.className = `alert-item ${a.type}`;
                div.innerHTML = `
                    <div class="alert-icon"><i data-lucide="${a.icon}"></i></div>
                    <div class="alert-body">
                        <div class="alert-title">${a.title}</div>
                        <div class="alert-desc">${a.desc}</div>
                    </div>
                    <span class="alert-badge">${a.badge}</span>`;
                container.appendChild(div);
            });
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /** Bir qator HTML generatsiya */
    function buildTradeRow(trade, isJournal) {
        const pnl     = parseFloat(trade.pnl) || 0;
        const isWin   = pnl >= 0;
        const isShort = (trade.trend || '').toLowerCase().includes('short');
        const rr      = trade.rr ? parseFloat(trade.rr).toFixed(1) : '0.0';
        const session = sessionLabel(trade.session || getTradingSession(trade.time));

        let html = `
            <td class="text-muted">${trade.date || ''} ${(trade.time || '').substring(0, 5)}</td>
            <td class="font-bold">${(trade.pair || '—').toUpperCase()}</td>
            <td><span class="badge-setup">${trade.strategy || 'No Setup'}</span></td>
            <td style="white-space:nowrap;">${session}</td>
            <td>
                <span class="direction-indicator ${isShort ? 'short' : 'long'}">
                    <span class="dot"></span> ${isShort ? 'Short' : 'Long'}
                </span>
            </td>
            <td><span class="badge-result ${isWin ? 'win' : 'loss'}">${isWin ? 'Win' : 'Loss'}</span></td>
            <td class="${isWin ? 'text-green' : 'text-red'} font-semibold">${isWin ? '+' : '-'}${rr}R</td>
            <td class="${isWin ? 'text-green' : 'text-red'} font-bold">${isWin ? '+' : ''}$${pnl.toFixed(2)}</td>
        `;

        if (isJournal) {
            html += `
                <td style="text-align:center;white-space:nowrap;">
                    <button class="btn-action-edit" data-id="${trade._id}" title="Tahrirlash"
                        style="background:none;border:none;color:#2563eb;cursor:pointer;padding:4px;margin-right:6px;">
                        <i data-lucide="edit-3" style="width:18px;height:18px;"></i>
                    </button>
                    <button class="btn-action-delete" data-id="${trade._id}" title="O'chirish"
                        style="background:none;border:none;color:#dc2626;cursor:pointer;padding:4px;">
                        <i data-lucide="trash-2" style="width:18px;height:18px;"></i>
                    </button>
                </td>
            `;
        }

        return html;
    }

    // ------------------------------------------------------------------
    // 7. STATISTIKA YANGILASH
    // ------------------------------------------------------------------
    function updateStats(total, wins, losses, totalProfit) {
        const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;
        const avgRR   = losses > 0 ? (wins / losses).toFixed(2) : wins.toFixed(2);

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

        set('stat-total',   total);
        set('stat-avgrr',   avgRR);

        const winrateEl = document.getElementById('stat-winrate');
        if (winrateEl) {
            winrateEl.innerText = `${winrate}%`;
            const sub = winrateEl.nextElementSibling;
            if (sub && sub.classList.contains('stat-subtext')) {
                sub.innerHTML = `<span class="text-green">${wins} Win</span> / <span class="text-red">${losses} Loss</span>`;
            }
        }

        const profitEl = document.getElementById('stat-profit');
        if (profitEl) {
            profitEl.innerText = `${totalProfit >= 0 ? '+' : ''}$${totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            profitEl.className = `stat-number-text ${totalProfit >= 0 ? 'text-green' : 'text-red'}`;

            if (initialBalance > 0) {
                const pct = ((totalProfit / initialBalance) * 100).toFixed(1);
                const pctEl = profitEl.nextElementSibling;
                if (pctEl) {
                    pctEl.innerText = `${totalProfit >= 0 ? '+' : ''}${pct}%`;
                    pctEl.className = `stat-subtext ${totalProfit >= 0 ? 'text-green' : 'text-red'}`;
                }
            }
        }
    }

    /** Jurnal filter statistikasi (sana bo'yicha) */
    function updateFilterStats(trades) {
        const fCount = document.getElementById('f-count');
        const fPnL   = document.getElementById('f-pnl');
        const total  = trades.reduce((s, t) => s + (parseFloat(t.pnl) || 0), 0);

        if (fCount) fCount.innerText = trades.length;
        if (fPnL) {
            fPnL.innerText = `${total >= 0 ? '+' : ''}$${total.toFixed(2)}`;
            fPnL.style.color = total >= 0 ? '#34d399' : '#f43f5e';
        }
    }

    /**
     * Sessiya va Kayfiyat statistikasini hisoblab DOM ga yozadi.
     * HTML da quyidagi id lar bo'lishi kerak:
     *   Sessiya : session-count-asian | session-wr-asian | progress-asian | status-asian
     *             (asian o'rniga: london, ny)
     *   Kayfiyat: mood-rate-sokin | mood-status-sokin
     *             (sokin o'rniga: shoshilish, fomo, ishonch, jahldor)
     */
    function updateSessionStats(trades) {

        // ------ SESSIYA HISOB-KITOBI ------
        // LONDON_OPEN → LONDON ga birlashtiriladi
        const sessions = {
            ASIAN:    { total: 0, wins: 0 },
            LONDON:   { total: 0, wins: 0 },
            NEW_YORK: { total: 0, wins: 0 },
            OFF:      { total: 0, wins: 0 },
        };

        // Sessiya kaliti → DOM id xaritasi
        // LONDON_OPEN → LONDON ga birlashtiriladi (HTML da alohida element yo'q)
        const sessionDomKey = {
            ASIAN:    'asian',
            LONDON:   'london',
            NEW_YORK: 'ny',
            OFF:      'off',
        };

        // ------ KAYFIYAT HISOB-KITOBI ------
        const moods = {
            Tinch:       { total: 0, wins: 0 },
            Ishonchli:   { total: 0, wins: 0 },
            Shoshilgan:  { total: 0, wins: 0 },
            Jahldor:     { total: 0, wins: 0 },
            FOMO:        { total: 0, wins: 0 },
        };

        // Kayfiyat kaliti → DOM id xaritasi
        const moodDomKey = {
            Tinch:      'sokin',
            Ishonchli:  'ishonch',
            Shoshilgan: 'shoshilish',
            Jahldor:    'jahldor',
            FOMO:       'fomo',
        };

        // Barcha savdolarni bir marta aylanib guruhlash
        trades.forEach(t => {
            const pnl   = parseFloat(t.pnl) || 0;
            const isWin = pnl > 0;

            // Sessiya — LONDON_OPEN ni LONDON ga birlashtиramiz (HTML da alohida yo'q)
            let sKey = t.session || getTradingSession(t.time) || 'OFF';
            if (sKey === 'LONDON_OPEN') sKey = 'LONDON';
            const sess = sessions[sKey] ? sessions[sKey] : sessions.OFF;
            sess.total++;
            if (isWin) sess.wins++;

            // Kayfiyat
            const mKey = t.psychology_before;
            if (mKey && moods[mKey]) {
                moods[mKey].total++;
                if (isWin) moods[mKey].wins++;
            }
        });

        // ------ SESSIYA DOM YANGILASH ------
        Object.entries(sessions).forEach(([key, data]) => {
            const domId = sessionDomKey[key];
            const wr    = data.total > 0 ? Math.round((data.wins / data.total) * 100) : 0;
            const isGood = wr >= 50;

            const countEl    = document.getElementById(`session-count-${domId}`);
            const wrEl       = document.getElementById(`session-wr-${domId}`);
            const progressEl = document.getElementById(`progress-${domId}`);
            const statusEl   = document.getElementById(`status-${domId}`);

            if (countEl)    countEl.innerText    = `${data.total} ta savdo`;
            if (wrEl) {
                wrEl.innerText  = `Winrate ${data.total > 0 ? wr + '%' : '—'}`;
                wrEl.className  = `session-wr ${isGood ? 'text-green' : 'text-red'}`;
            }
            if (progressEl) {
                progressEl.style.width      = `${wr}%`;
                progressEl.style.background = isGood ? '#16a34a' : '#dc2626';
            }
            if (statusEl) {
                statusEl.innerText  = data.total === 0 ? '—' : (isGood ? 'Yaxshi' : 'Xavfli');
                statusEl.className  = `session-status ${isGood ? 'status-good' : 'status-bad'}`;
            }
        });

        // ------ KAYFIYAT DOM YANGILASH ------
        Object.entries(moods).forEach(([key, data]) => {
            const domId  = moodDomKey[key];
            const wr     = data.total > 0 ? Math.round((data.wins / data.total) * 100) : 0;
            const isGood = wr >= 50;

            const rateEl   = document.getElementById(`mood-rate-${domId}`);
            const statusEl = document.getElementById(`mood-status-${domId}`);

            if (rateEl)   rateEl.innerText   = data.total > 0 ? `${wr}%` : '—';
            if (statusEl) {
                statusEl.innerText = data.total === 0 ? '—' : (isGood ? 'Yaxshi' : 'Xavfli');
                statusEl.className = `mood-status ${isGood ? 'status-good' : 'status-bad'}`;
            }
        });
    }

    // ------------------------------------------------------------------
    // 8. FORM — YANGI SAVDO / TAHRIRLASH
    // ------------------------------------------------------------------
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const tradeId   = editingIdInput ? editingIdInput.value.trim() : '';
            const timeValue = document.getElementById('trade-time')?.value || '';

            const tradeData = {
                date:               document.getElementById('trade-date')?.value || '',
                time:               timeValue,
                pair:               (document.getElementById('pair')?.value || '').toUpperCase(),
                strategy:           document.getElementById('strategy')?.value || 'No Setup',
                trend:              document.getElementById('trend')?.value || 'Long',
                type:               document.getElementById('trend')?.value === 'Long' ? 'BUY' : 'SELL',
                pnl:                parseFloat(document.getElementById('pnl')?.value) || 0,
                rr:                 parseFloat(document.getElementById('trade-rr')?.value) || 0,
                session:            getTradingSession(timeValue),
                psychology_before:  document.getElementById('psychology-before')?.value || 'Tinch',
                mistake:            document.getElementById('trade-mistake')?.value || '',
                notes:              document.getElementById('notes')?.value || '',
                entryPrice:         0,
                size:               0.1,
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
            } catch (err) {
                alert(err.message || 'Xatolik yuz berdi!');
            }
        });
    }

    /** Formani boshlang'ich holatga qaytaradi */
    function resetFormState() {
        if (form)           form.reset();
        if (editingIdInput) editingIdInput.value = '';
        if (formTitle)      formTitle.innerText  = 'Yangi Savdo Kiritish';
        if (btnSaveTrade)   btnSaveTrade.innerHTML = `<i data-lucide="plus"></i> Saqlash`;
        if (btnCancelEdit)  btnCancelEdit.style.display = 'none';
        setDefaultDateTime();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /** Tahrirlash uchun formani to'ldiradi */
    function populateFormForEdit(trade) {
        if (!trade) return;
        if (editingIdInput) editingIdInput.value = trade._id;

        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        setVal('trade-date',        trade.date);
        setVal('trade-time',        trade.time);
        setVal('pair',              trade.pair);
        setVal('strategy',          trade.strategy === 'No Setup' ? '' : trade.strategy);
        setVal('trend',             trade.trend || 'Long');
        setVal('pnl',               trade.pnl);
        setVal('trade-rr',          trade.rr);
        setVal('psychology-before', trade.psychology_before || 'Tinch');
        setVal('trade-mistake',     trade.mistake || '');
        setVal('notes',             trade.notes === 'No Notes' ? '' : trade.notes);

        if (formTitle)     formTitle.innerText   = 'Savdoni Tahrirlash';
        if (btnSaveTrade)  btnSaveTrade.innerHTML = `<i data-lucide="check"></i> Yangilash`;
        if (btnCancelEdit) btnCancelEdit.style.display = 'inline-block';

        if (typeof lucide !== 'undefined') lucide.createIcons();
        if (form) form.scrollIntoView({ behavior: 'smooth' });
    }

    if (btnCancelEdit) {
        btnCancelEdit.addEventListener('click', resetFormState);
    }

    // ------------------------------------------------------------------
    // 9. TAHRIRLASH / O'CHIRISH TUGMALARI
    // ------------------------------------------------------------------
    function attachActionButtons() {
        // O'chirish
        document.querySelectorAll('.btn-action-delete').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.getAttribute('data-id');
                if (!confirm("Ushbu savdoni o'chirmoqchimisiz?")) return;
                try {
                    await api.delete(`/trades/${id}`);
                    await fetchTrades();
                } catch {
                    alert("O'chirishda xatolik!");
                }
            };
        });

        // Tahrirlash
        document.querySelectorAll('.btn-action-edit').forEach(btn => {
            btn.onclick = () => {
                const id    = btn.getAttribute('data-id');
                const trade = localTradesArray.find(t => t._id === id);
                if (trade) populateFormForEdit(trade);
                else alert("Savdo topilmadi!");
            };
        });
    }

    // ------------------------------------------------------------------
    // 10. SANA FILTRI (JURNAL)
    // ------------------------------------------------------------------
    if (filterDateInput) {
        filterDateInput.addEventListener('input', () => {
            const sel = filterDateInput.value;
            if (!sel) {
                resetDateFilter();
                return;
            }
            if (btnClearFilter) btnClearFilter.style.display = 'inline-block';

            const filtered = localTradesArray.filter(t => {
                if (!t.date) return false;
                const d = t.date.includes('-') ? t.date : new Date(t.date).toISOString().split('T')[0];
                return d === sel;
            });
            renderTrades(filtered);
        });
    }

    if (btnClearFilter) {
        btnClearFilter.addEventListener('click', resetDateFilter);
    }

    function resetDateFilter() {
        if (filterDateInput) filterDateInput.value = '';
        if (btnClearFilter)  btnClearFilter.style.display = 'none';
        renderTrades(localTradesArray);
    }

    // ------------------------------------------------------------------
    // 10b. EQUITY CURVE — davr filtri (Barcha vaqt / Shu oy / Shu hafta)
    // ------------------------------------------------------------------
    const equityRangeSelect = document.getElementById('equity-range-select');
    if (equityRangeSelect) {
        equityRangeSelect.addEventListener('change', () => {
            currentEquityRange = equityRangeSelect.value;
            renderEquityCurve(localTradesArray, currentEquityRange);
        });
    }

    // ------------------------------------------------------------------
    // 11. SIDEBAR NAVIGATSIYA (yagona, toza handler — pastdagi
    //     "SIDEBAR MENU SWITCHER" bo'limida joylashgan)
    // ------------------------------------------------------------------

    // Journal sahifasiga o'tish tugmalari (Dashboard'dagi "Barchasini ko'rish" va "+ Yangi Savdo")
    ['.btn-add-trade', '.link-view-all'].forEach(sel => {
        const btn = document.querySelector(sel);
        if (btn) {
            btn.addEventListener('click', e => {
                e.preventDefault();
                const journalMenu = document.querySelector('.sidebar-menu .menu-item[data-target="sec-journal"]');
                if (journalMenu) journalMenu.click();
            });
        }
    });

    // Jurnal "Back" tugmasi
    if (btnJournalBack) {
        btnJournalBack.addEventListener('click', () => {
            const dbMenu = document.querySelector('[data-target="sec-dashboard"]');
            if (dbMenu) dbMenu.click();
        });
    }

    // ==========================================================================
    // 11a. SIDEBAR MENU SWITCHER (SPA QOLIPI — ANALIZLAR BO'LIMI INTEGRATSIYASI)
    // ==========================================================================
    let profitChartInstance      = null; // Pair Analysis — bar chart
    let setupDonutChartInstance  = null; // Setup Analysis — donut chart
    let mistakeBarChartInstance  = null; // Mistake Analysis — gorizontal bar chart
    let showAllSetups   = false;         // Setup jadvalida "Barchasini ko'rish" holati
    let showAllMistakes = false;         // Mistake jadvalida "Barchasini ko'rish" holati
    const SETUP_VISIBLE_LIMIT   = 5;
    const MISTAKE_VISIBLE_LIMIT = 4;

    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            if (!targetId) return;

            // Aktiv menyu klasslarini almashtirish
            document.querySelectorAll('.sidebar-menu .menu-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Aktiv bo'limni (section) almashish mantiqi
            document.querySelectorAll('.dashboard-section').forEach(s => {
                if (s.id === targetId) {
                    s.classList.add('active-section');
                } else {
                    s.classList.remove('active-section');
                }
            });

            // 🟢 AGAR FOYDALANUVCHI ANALIZLAR MENYUSINI BOSSA
            if (targetId === 'sec-analiz') {
                // Agar dashboard.js yuklagan localTradesArray ichida ma'lumot bo'lsa, o'shani ishlatadi
                if (typeof localTradesArray !== 'undefined' && localTradesArray.length > 0) {
                    runAdvancedAnalysis(localTradesArray);
                } else {
                    // Agar xotira bo'sh bo'lsa, api.js orqali backend'dan qayta tortadi
                    api.get('/trades').then(res => {
                        const trades = Array.isArray(res) ? res : (res.trades || []);
                        runAdvancedAnalysis(trades);
                    }).catch(err => console.error("Analiz ma'lumotlarini yuklashda xatolik:", err));
                }
            }

            // Lucide ikonkalari mavjud bo'lsa, ularni qayta render qilish
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    });


    // ==========================================================================
    // 🟢 TOZA KLASSLAR BILAN ISHLAYDIGON ANALIZLAR ASOSIY MANTIQLARI
    // ==========================================================================
    function runAdvancedAnalysis(trades) {
        const totalTrades = trades.length;
        
        // Yangi mustaqil DOM elementlarini ushlash
        const totalTradesEl = document.getElementById('total-trades-val');
        const winrateEl = document.getElementById('winrate-val');
        const winLossRatioEl = document.getElementById('win-loss-ratio');
        const netProfitEl = document.getElementById('net-profit-val');
        const profitFactorEl = document.getElementById('profit-factor-val');
        const profitFactorStatusEl = document.getElementById('profit-factor-status');
        const expectancyEl = document.getElementById('expectancy-val');
        const pairTbody = document.getElementById('pair-analysis-tbody');
        const pairFilterSelect = document.getElementById('pair-filter-select');

        if (totalTradesEl) totalTradesEl.textContent = totalTrades;

        // Savdolar bo'lmasa interfeysni tozalash
        if (totalTrades === 0) {
            if (pairTbody) {
                pairTbody.innerHTML = `<tr><td colspan="4" class="an-table-loading">Hozircha savdolar kiritilmagan.</td></tr>`;
            }
            return;
        }

        // 1. Matematik metrikalarni hisoblash qismi
        let wins = 0, losses = 0, totalWinAmount = 0, totalLossAmount = 0, netProfit = 0;

        trades.forEach(t => {
            const pnl = parseFloat(t.pnl) || 0;
            netProfit += pnl;
            if (pnl > 0) { 
                wins++; 
                totalWinAmount += pnl; 
            } else if (pnl < 0) { 
                losses++; 
                totalLossAmount += Math.abs(pnl); 
            }
        });

        // Winrate hisoblash va rang berish
        const winrate = Math.round((wins / totalTrades) * 100);
        if (winrateEl) {
            winrateEl.textContent = `${winrate}%`;
            winrateEl.style.color = winrate >= 50 ? 'var(--accent-green)' : 'var(--accent-red)';
        }
        if (winLossRatioEl) {
            winLossRatioEl.innerHTML = `<span style="color: var(--accent-green); font-weight:700;">${wins} W</span> / <span style="color: var(--accent-red); font-weight:700;">${losses} L</span>`;
        }

        // Net Profit hisoblash va rang berish
        if (netProfitEl) {
            netProfitEl.textContent = (netProfit >= 0 ? '+ ' : '') + `$${netProfit.toFixed(2)}`;
            netProfitEl.style.color = netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
        }

        // Profit Factor hisoblash
        const profitFactor = totalLossAmount === 0 ? totalWinAmount : (totalWinAmount / totalLossAmount);
        if (profitFactorEl) profitFactorEl.textContent = profitFactor.toFixed(2);
        if (profitFactorStatusEl) {
            let statusText = 'Yomon';
            let statusColor = 'var(--accent-red)';
            if (profitFactor >= 2) { statusText = 'Zo‘r'; statusColor = 'var(--accent-green)'; }
            else if (profitFactor >= 1.5) { statusText = 'Yaxshi'; statusColor = 'var(--accent-green)'; }
            else if (profitFactor >= 1) { statusText = 'Qoniqarli'; statusColor = 'var(--accent-gold)'; }
            
            profitFactorStatusEl.textContent = statusText;
            profitFactorStatusEl.style.color = statusColor;
        }

        // Expectancy hisoblash
        if (expectancyEl) {
            const expectancy = netProfit / totalTrades;
            expectancyEl.textContent = (expectancy >= 0 ? '+ ' : '') + `$${expectancy.toFixed(2)}`;
            expectancyEl.style.color = expectancy >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
        }

        // 2. Juftliklarni (Pairs) guruhlash funksiyasi
        function processAndRenderPairs() {
            const pairData = {};
            
            trades.forEach(t => {
                const pair = (t.pair || 'NOMALUM').toUpperCase();
                const pnl = parseFloat(t.pnl) || 0;
                
                if (!pairData[pair]) {
                    pairData[pair] = { pair: pair, trades: 0, wins: 0, profit: 0 };
                }
                pairData[pair].trades++;
                pairData[pair].profit += pnl;
                if (pnl > 0) pairData[pair].wins++;
            });

            let pairList = Object.values(pairData).map(p => {
                p.winrate = Math.round((p.wins / p.trades) * 100);
                return p;
            });

            // Filtr turiga qarab saralash (Profit, Trades, Winrate)
            const filterType = pairFilterSelect ? pairFilterSelect.value : 'profit';
            if (filterType === 'profit') pairList.sort((a, b) => b.profit - a.profit);
            else if (filterType === 'trades') pairList.sort((a, b) => b.trades - a.trades);
            else if (filterType === 'winrate') pairList.sort((a, b) => b.winrate - a.winrate);

            // Jadvalni to'ldirish
            if (pairTbody) {
                pairTbody.innerHTML = '';
                pairList.forEach(p => {
                    const tr = document.createElement('tr');
                    const isProfit = p.profit >= 0;
                    tr.innerHTML = `
                        <td><span style="font-weight: 700; color: var(--text-main);">${p.pair}</span></td>
                        <td>${p.trades}</td>
                        <td><span style="font-weight: 500;">${p.winrate}%</span></td>
                        <td style="color: ${isProfit ? 'var(--accent-green)' : 'var(--accent-red)'}; font-weight: 700;">
                            ${isProfit ? '+' : ''}$${p.profit.toFixed(2)}
                        </td>
                    `;
                    pairTbody.appendChild(tr);
                });
            }

            // Grafikni chizish funksiyasini chaqirish
            renderAnalysisChart(pairList, filterType);
        }

        // 3. Chart.js grafik chizish tizimi
        function renderAnalysisChart(pairList, filterType) {
            const chartCanvas = document.getElementById('profitByPairChart');
            if (!chartCanvas) return;

            const labels = pairList.map(p => p.pair);
            let chartData = [];
            let backgroundColors = [];

            if (filterType === 'profit') {
                chartData = pairList.map(p => p.profit);
                backgroundColors = chartData.map(v => v >= 0 ? '#10b981' : '#ef4444'); // yashil / qizil
                document.getElementById('chart-dynamic-title').textContent = 'Profit by Pair ($)';
            } else if (filterType === 'trades') {
                chartData = pairList.map(p => p.trades);
                backgroundColors = pairList.map(() => '#2563eb'); // brand-blue
                document.getElementById('chart-dynamic-title').textContent = 'Trades Count by Pair';
            } else if (filterType === 'winrate') {
                chartData = pairList.map(p => p.winrate);
                backgroundColors = chartData.map(v => v >= 50 ? '#10b981' : '#f59e0b'); // yashil / oltin
                document.getElementById('chart-dynamic-title').textContent = 'Winrate by Pair (%)';
            }

            // Ustma-ust tushish xatoligini (flickering) oldini olish uchun eski grafik instansiyasini yo'qotish
            if (profitChartInstance) {
                profitChartInstance.destroy();
            }

            // Grafikni yangidan yaratish
            profitChartInstance = new Chart(chartCanvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        data: chartData,
                        backgroundColor: backgroundColors,
                        borderRadius: 4,
                        barThickness: 20
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { 
                            grid: { color: 'var(--border-color)' }, 
                            ticks: { font: { family: 'sans-serif', size: 11 }, color: 'var(--text-muted)' } 
                        },
                        x: { 
                            grid: { display: false }, 
                            ticks: { font: { family: 'sans-serif', size: 11, weight: 'bold' }, color: 'var(--text-main)' } 
                        }
                    }
                }
            });
        }

        // Select filter o'zgarganda xavfsiz tinglash va qayta chizish
        if (pairFilterSelect) {
            // Element nusxasini almashtirish orqali dublikat eventlarni oldini olamiz
            const cleanSelect = pairFilterSelect.cloneNode(true);
            pairFilterSelect.replaceWith(cleanSelect);
            cleanSelect.addEventListener('change', processAndRenderPairs);
        }

        // Ilk ishga tushirish
        processAndRenderPairs();

        // Yangi bloklar: Setup tahlili, Xatolar tahlili, AI Insights
        renderSetupAnalysis(trades);
        renderMistakeAnalysis(trades);
        renderAIInsights(trades);
    }

    // ==========================================================================
    // 13. STRATEGY / SETUP ANALYSIS — real tread'lardagi "strategy" maydoniga
    //     asoslangan samaradorlik jadvali + Profit Distribution donut chart
    // ==========================================================================

    /** Har bir setup bo'yicha trades/wins/profit hisoblab, profit bo'yicha saralaydi */
    function computeSetupStats(trades) {
        const map = {};
        (trades || []).forEach(t => {
            const key = t.strategy && t.strategy !== 'No Setup' ? t.strategy : 'No Setup';
            const pnl = parseFloat(t.pnl) || 0;
            if (!map[key]) map[key] = { setup: key, trades: 0, wins: 0, profit: 0 };
            map[key].trades++;
            map[key].profit += pnl;
            if (pnl > 0) map[key].wins++;
        });
        return Object.values(map)
            .map(s => ({ ...s, winrate: Math.round((s.wins / s.trades) * 100) }))
            .sort((a, b) => b.profit - a.profit);
    }

    function renderSetupAnalysis(trades) {
        const tbody     = document.getElementById('setup-analysis-tbody');
        const toggleBtn = document.getElementById('btn-setup-toggle');
        const legendEl  = document.getElementById('setup-donut-legend');
        const totalEl   = document.getElementById('setup-donut-total');
        const canvas    = document.getElementById('setupDonutChart');
        if (!tbody) return;

        const stats = computeSetupStats(trades);

        // Ma'lumot yo'q holati
        if (stats.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="an-table-loading">Hozircha setup ma'lumotlari yo'q.</td></tr>`;
            if (toggleBtn) toggleBtn.style.display = 'none';
            if (legendEl)  legendEl.innerHTML = '';
            if (totalEl)   totalEl.textContent = '$0.00';
            if (setupDonutChartInstance) { setupDonutChartInstance.destroy(); setupDonutChartInstance = null; }
            return;
        }

        // ---- JADVAL (toggle: qisqa / to'liq ro'yxat) ----
        const visibleStats = showAllSetups ? stats : stats.slice(0, SETUP_VISIBLE_LIMIT);
        tbody.innerHTML = '';
        visibleStats.forEach(s => {
            const tr = document.createElement('tr');
            const isProfit = s.profit >= 0;
            tr.innerHTML = `
                <td><span class="an-cell-strong">${s.setup}</span></td>
                <td>${s.trades}</td>
                <td><span class="an-cell-medium ${s.winrate >= 50 ? 'an-text-green' : 'an-text-red'}">${s.winrate}%</span></td>
                <td class="${isProfit ? 'an-text-green' : 'an-text-red'} an-cell-strong">
                    ${isProfit ? '+' : '-'}$${Math.abs(s.profit).toFixed(2)}
                </td>`;
            tbody.appendChild(tr);
        });

        if (toggleBtn) {
            if (stats.length > SETUP_VISIBLE_LIMIT) {
                toggleBtn.style.display = 'block';
                toggleBtn.textContent = showAllSetups ? "Kamroq ko'rsatish" : "Barchasini ko'rish";
            } else {
                toggleBtn.style.display = 'none';
            }
        }

        // ---- DONUT CHART (Profit Distribution) ----
        const totalAbs = stats.reduce((s, x) => s + Math.abs(x.profit), 0) || 1;
        const totalNet = stats.reduce((s, x) => s + x.profit, 0);
        const palette  = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#84cc16'];

        if (totalEl) {
            totalEl.textContent = `${totalNet >= 0 ? '+' : '-'}$${Math.abs(totalNet).toFixed(2)}`;
            totalEl.style.color = totalNet >= 0 ? '#16a34a' : '#dc2626';
        }

        if (legendEl) {
            legendEl.innerHTML = '';
            stats.forEach((s, i) => {
                const pct = ((s.profit / totalAbs) * 100).toFixed(1);
                const li = document.createElement('li');
                li.className = 'an-donut-legend-item';
                li.innerHTML = `
                    <span class="an-legend-dot" style="background:${palette[i % palette.length]}"></span>
                    <span class="an-legend-name">${s.setup}</span>
                    <span class="an-legend-percent ${s.profit >= 0 ? 'an-text-green' : 'an-text-red'}">${pct}%</span>`;
                legendEl.appendChild(li);
            });
        }

        if (canvas) {
            if (setupDonutChartInstance) setupDonutChartInstance.destroy();
            setupDonutChartInstance = new Chart(canvas.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: stats.map(s => s.setup),
                    datasets: [{
                        data: stats.map(s => Math.abs(s.profit)),
                        backgroundColor: stats.map((s, i) => palette[i % palette.length]),
                        borderWidth: 0,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    const s = stats[ctx.dataIndex];
                                    return `${s.setup}: ${s.profit >= 0 ? '+' : '-'}$${Math.abs(s.profit).toFixed(2)}`;
                                },
                            },
                        },
                    },
                },
            });
        }
    }

    const btnSetupToggle = document.getElementById('btn-setup-toggle');
    if (btnSetupToggle) {
        btnSetupToggle.addEventListener('click', () => {
            showAllSetups = !showAllSetups;
            renderSetupAnalysis(localTradesArray);
        });
    }

    // ==========================================================================
    // 14. MISTAKE ANALYSIS — real tread'lardagi "mistake" maydoniga asoslangan
    //     zarar tahlili jadvali + gorizontal bar chart + eng katta zarar ogohlantirishi
    // ==========================================================================

    /** Xato turlari ro'yxati — forma select'idagi qiymatlar bilan bir xil bo'lishi shart */
    const MISTAKE_DEFS = [
        { key: 'Revenge Trading', icon: 'flame'      },
        { key: 'FOMO',            icon: 'zap'        },
        { key: 'Late Entry',      icon: 'clock-4'    },
        { key: 'Early Exit',      icon: 'log-out'    },
        { key: 'Overtrading',     icon: 'layers-3'   },
        { key: 'No Stop Loss',    icon: 'shield-off' },
    ];

    /** Har bir xato turi bo'yicha trades soni va umumiy zararni hisoblaydi */
    function computeMistakeStats(trades) {
        const map = {};
        MISTAKE_DEFS.forEach(m => { map[m.key] = { mistake: m.key, icon: m.icon, trades: 0, totalLoss: 0 }; });

        (trades || []).forEach(t => {
            const key = t.mistake;
            if (!key || !map[key]) return; // belgilanmagan bo'lsa tahlilga kirmaydi
            const pnl = parseFloat(t.pnl) || 0;
            map[key].trades++;
            if (pnl < 0) map[key].totalLoss += Math.abs(pnl);
        });

        return Object.values(map)
            .filter(m => m.trades > 0)
            .sort((a, b) => b.totalLoss - a.totalLoss);
    }

    function renderMistakeAnalysis(trades) {
        const tbody      = document.getElementById('mistake-analysis-tbody');
        const toggleBtn  = document.getElementById('btn-mistake-toggle');
        const alertBox   = document.getElementById('mistake-alert-box');
        const alertName  = document.getElementById('mistake-alert-name');
        const canvas     = document.getElementById('mistakeBarChart');
        if (!tbody) return;

        const stats = computeMistakeStats(trades);

        // Ma'lumot yo'q holati
        if (stats.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="an-table-loading">Hozircha xato turi bo'yicha ma'lumot yo'q. Savdo qo'shishda "Xato turi"ni belgilang.</td></tr>`;
            if (toggleBtn) toggleBtn.style.display = 'none';
            if (alertBox)  alertBox.style.display = 'none';
            if (mistakeBarChartInstance) { mistakeBarChartInstance.destroy(); mistakeBarChartInstance = null; }
            return;
        }

        // ---- JADVAL (toggle: qisqa / to'liq ro'yxat) ----
        const visible = showAllMistakes ? stats : stats.slice(0, MISTAKE_VISIBLE_LIMIT);
        tbody.innerHTML = '';
        visible.forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <span class="an-mistake-name">
                        <i data-lucide="${m.icon}" class="an-mistake-icon"></i> ${m.mistake}
                    </span>
                </td>
                <td>${m.trades}</td>
                <td class="an-text-red an-cell-strong">- $${m.totalLoss.toFixed(2)}</td>`;
            tbody.appendChild(tr);
        });

        if (toggleBtn) {
            if (stats.length > MISTAKE_VISIBLE_LIMIT) {
                toggleBtn.style.display = 'block';
                toggleBtn.textContent = showAllMistakes ? "Kamroq ko'rsatish" : "Barchasini ko'rish";
            } else {
                toggleBtn.style.display = 'none';
            }
        }

        // ---- ENG KATTA ZARAR OGOHLANTIRISHI ----
        const worst = stats[0];
        if (alertBox && alertName && worst && worst.totalLoss > 0) {
            alertName.textContent = worst.mistake;
            alertBox.style.display = 'flex';
        } else if (alertBox) {
            alertBox.style.display = 'none';
        }

        // ---- GORIZONTAL BAR CHART ----
        if (canvas) {
            if (mistakeBarChartInstance) mistakeBarChartInstance.destroy();
            mistakeBarChartInstance = new Chart(canvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: stats.map(m => m.mistake),
                    datasets: [{
                        data: stats.map(m => m.totalLoss),
                        backgroundColor: '#ef4444',
                        borderRadius: 4,
                        barThickness: 16,
                    }],
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { color: 'var(--border-color)' }, ticks: { color: 'var(--text-muted)' } },
                        y: { grid: { display: false }, ticks: { color: 'var(--text-main)', font: { weight: 'bold' } } },
                    },
                },
            });
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    const btnMistakeToggle = document.getElementById('btn-mistake-toggle');
    if (btnMistakeToggle) {
        btnMistakeToggle.addEventListener('click', () => {
            showAllMistakes = !showAllMistakes;
            renderMistakeAnalysis(localTradesArray);
        });
    }

    // ==========================================================================
    // 15. AI INSIGHTS — hozircha statik "tez orada" holati.
    //     AI API ulanganda faqat fetchAIInsights() funksiyasini almashtirish kifoya.
    // ==========================================================================

    /**
     * KELAJAKDA: AI API ulanganda bu funksiyani real chaqiruvga almashtiring, masalan:
     *
     *   async function fetchAIInsights(trades) {
     *       const res = await api.post('/ai/insights', { trades });
     *       return res.insights; // [{ icon, text, type }, ...]
     *   }
     *
     * `type` qiymatlari: 'success' | 'warning' | 'danger' | 'info'
     * Hozircha API ulanmaganligi sababli har doim null qaytaradi —
     * bu holatda renderAIInsights() "tez orada" xabarini ko'rsatadi.
     */
    function fetchAIInsights(trades) {
        return null;
    }

    function renderAIInsights(trades) {
        const container = document.getElementById('ai-insights-list');
        if (!container) return;

        const insights = fetchAIInsights(trades);

        if (!insights || insights.length === 0) {
            container.innerHTML = `
                <div class="an-ai-empty">
                    <i data-lucide="sparkles" class="an-ai-empty-icon"></i>
                    <p class="an-ai-empty-title">AI tahlili tez orada faollashadi</p>
                    <p class="an-ai-empty-text">Sun'iy intellekt tez orada savdolaringizni chuqur tahlil qilib, shaxsiy tavsiyalar beradi.</p>
                </div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        container.innerHTML = '';
        insights.forEach(item => {
            const div = document.createElement('div');
            div.className = `an-ai-item an-ai-${item.type || 'info'}`;
            div.innerHTML = `
                <span class="an-ai-icon"><i data-lucide="${item.icon || 'sparkles'}"></i></span>
                <span class="an-ai-text">${item.text}</span>
                <i data-lucide="chevron-right" class="an-ai-chevron"></i>`;
            container.appendChild(div);
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // ==========================================================================
    // 16. CALCULATOR — Risk / RR / Profit Calculator
    // ==========================================================================

    /** Instrument bo'yicha pip hajmi va standart lot uchun pip qiymati */
    const CALC_INSTRUMENTS = {
        EURUSD: { pipSize: 0.0001, pipValue: 10   },
        GBPUSD: { pipSize: 0.0001, pipValue: 10   },
        AUDUSD: { pipSize: 0.0001, pipValue: 10   },
        NZDUSD: { pipSize: 0.0001, pipValue: 10   },
        USDCAD: { pipSize: 0.0001, pipValue: 10   },
        USDCHF: { pipSize: 0.0001, pipValue: 10   },
        USDJPY: { pipSize: 0.01,   pipValue: 9.3  },
        XAUUSD: { pipSize: 0.1,    pipValue: 10   },
        BTCUSD: { pipSize: 1,      pipValue: 1    },
    };

    /** Instrument konfiguratsiyasini xavfsiz oladi (topilmasa EURUSD) */
    function getInstrumentConfig(code) {
        return CALC_INSTRUMENTS[code] || CALC_INSTRUMENTS.EURUSD;
    }

    // Risk Calculator natijasi — RR Calculator shu lot hajmidan foydalanadi
    let lastRiskCalc = { instrument: 'EURUSD', lotSize: 0.2, pipSize: 0.0001, pipValue: 10 };

    /** 1) RISK CALCULATOR — Risk Amount / Pip Risk / Lot Size */
    function calculateRiskCard() {
        const balanceEl    = document.getElementById('risk-balance');
        const riskPctEl    = document.getElementById('risk-percent');
        const entryEl      = document.getElementById('risk-entry');
        const stopEl       = document.getElementById('risk-stop');
        const instrumentEl = document.getElementById('risk-instrument');
        if (!balanceEl || !riskPctEl || !entryEl || !stopEl || !instrumentEl) return;

        const balance    = parseFloat(balanceEl.value) || 0;
        const riskPct    = parseFloat(riskPctEl.value) || 0;
        const entry      = parseFloat(entryEl.value) || 0;
        const stop       = parseFloat(stopEl.value) || 0;
        const instrument = instrumentEl.value;
        const cfg         = getInstrumentConfig(instrument);

        const riskAmount = balance * (riskPct / 100);
        const priceDiff  = Math.abs(entry - stop);
        const pipsRisk   = cfg.pipSize > 0 ? Math.round(priceDiff / cfg.pipSize) : 0;
        const lotSize    = (pipsRisk > 0 && cfg.pipValue > 0) ? riskAmount / (pipsRisk * cfg.pipValue) : 0;

        const amountEl = document.getElementById('risk-result-amount');
        const pipsEl   = document.getElementById('risk-result-pips');
        const lotEl    = document.getElementById('risk-result-lot');
        if (amountEl) amountEl.innerText = `$${riskAmount.toFixed(2)}`;
        if (pipsEl)   pipsEl.innerText   = `${pipsRisk} pips`;
        if (lotEl)    lotEl.innerText    = lotSize.toFixed(2);

        // RR Calculator shu natijadan foydalanishi uchun saqlab qo'yamiz
        lastRiskCalc = {
            instrument,
            lotSize:  lotSize > 0 ? lotSize : 0,
            pipSize:  cfg.pipSize,
            pipValue: cfg.pipValue,
        };
    }

    /** 2) RR CALCULATOR — Risk:Reward nisbati (Risk Calculator lot hajmiga asoslanadi) */
    function calculateRRCard() {
        const entryEl = document.getElementById('rr-entry');
        const stopEl  = document.getElementById('rr-stop');
        const tpEl    = document.getElementById('rr-tp');
        if (!entryEl || !stopEl || !tpEl) return;

        const entry = parseFloat(entryEl.value) || 0;
        const stop  = parseFloat(stopEl.value) || 0;
        const tp    = parseFloat(tpEl.value) || 0;

        const pipSize  = lastRiskCalc.pipSize  || 0.0001;
        const pipValue = lastRiskCalc.pipValue || 10;
        const lot      = lastRiskCalc.lotSize > 0 ? lastRiskCalc.lotSize : 1;

        const riskPips   = pipSize > 0 ? Math.round(Math.abs(entry - stop) / pipSize) : 0;
        const rewardPips = pipSize > 0 ? Math.round(Math.abs(tp - entry) / pipSize) : 0;
        const ratio       = riskPips > 0 ? (rewardPips / riskPips) : 0;

        const riskAmount   = riskPips   * lot * pipValue;
        const rewardAmount = rewardPips * lot * pipValue;

        const ratioEl        = document.getElementById('rr-result-ratio');
        const riskLabelEl    = document.getElementById('rr-result-risk-label');
        const riskAmountEl   = document.getElementById('rr-result-risk-amount');
        const rewardLabelEl  = document.getElementById('rr-result-reward-label');
        const rewardAmountEl = document.getElementById('rr-result-reward-amount');

        if (ratioEl)        ratioEl.innerText        = `1 : ${ratio.toFixed(2)}`;
        if (riskLabelEl)    riskLabelEl.innerText     = `Risk (${riskPips} pips)`;
        if (riskAmountEl)   riskAmountEl.innerText    = `-$${riskAmount.toFixed(2)}`;
        if (rewardLabelEl)  rewardLabelEl.innerText   = `Reward (${rewardPips} pips)`;
        if (rewardAmountEl) rewardAmountEl.innerText  = `+$${rewardAmount.toFixed(2)}`;
    }

    /** 3) PROFIT CALCULATOR — Kirish/chiqish narxi va lot hajmi bo'yicha foyda */
    function calculateProfitCard() {
        const instrumentEl = document.getElementById('profit-instrument');
        const entryEl      = document.getElementById('profit-entry');
        const exitEl       = document.getElementById('profit-exit');
        const lotEl        = document.getElementById('profit-lot');
        if (!instrumentEl || !entryEl || !exitEl || !lotEl) return;

        const instrument = instrumentEl.value;
        const entry      = parseFloat(entryEl.value) || 0;
        const exitPrice  = parseFloat(exitEl.value) || 0;
        const lot        = parseFloat(lotEl.value) || 0;
        const cfg         = getInstrumentConfig(instrument);

        const pips   = cfg.pipSize > 0 ? Math.round(Math.abs(exitPrice - entry) / cfg.pipSize) : 0;
        const isLong = exitPrice >= entry;
        const profit = pips * lot * cfg.pipValue;

        const pipsResEl   = document.getElementById('profit-result-pips');
        const profitResEl = document.getElementById('profit-result-amount');
        const dirResEl    = document.getElementById('profit-result-direction');

        if (pipsResEl) pipsResEl.innerText = `${pips} pips`;
        if (profitResEl) {
            profitResEl.innerText = `${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`;
            profitResEl.className = `calc-result-value ${profit >= 0 ? 'calc-text-green' : 'calc-text-red'}`;
        }
        if (dirResEl) {
            dirResEl.innerHTML = isLong
                ? `Long <i data-lucide="arrow-up-right"></i>`
                : `Short <i data-lucide="arrow-down-right"></i>`;
            dirResEl.className = `calc-result-value ${isLong ? 'calc-text-blue' : 'calc-text-orange'}`;
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Tugmalarni ulash
    const btnCalcRisk   = document.getElementById('btn-calc-risk');
    const btnCalcRR     = document.getElementById('btn-calc-rr');
    const btnCalcProfit = document.getElementById('btn-calc-profit');

    if (btnCalcRisk)   btnCalcRisk.addEventListener('click', calculateRiskCard);
    if (btnCalcRR)     btnCalcRR.addEventListener('click', calculateRRCard);
    if (btnCalcProfit) btnCalcProfit.addEventListener('click', calculateProfitCard);

    // Sahifa ochilganda default qiymatlar bilan bir marta hisoblab qo'yamiz
    if (btnCalcRisk || btnCalcRR || btnCalcProfit) {
        calculateRiskCard();
        calculateRRCard();
        calculateProfitCard();
    }

    // ------------------------------------------------------------------
    // 17. LOGOUT
    // ------------------------------------------------------------------
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user_verified');
            window.location.href = 'login.html';
        });
    }

    // Lucide ikonkalarini ishga tushirish
    if (typeof lucide !== 'undefined') lucide.createIcons();
});