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
    // 11. SIDEBAR NAVIGATSIYA
    // ------------------------------------------------------------------
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    const sections  = document.querySelectorAll('.dashboard-section');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const target = item.getAttribute('data-target');
            sections.forEach(s => s.id === target
                ? s.classList.add('active-section')
                : s.classList.remove('active-section')
            );
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    });

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

    // ------------------------------------------------------------------
    // 12. LOGOUT
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