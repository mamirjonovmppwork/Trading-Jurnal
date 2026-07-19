// ==========================================================================
// TELEGRAM BO'LIMI — BACKEND BILAN TO'LIQ ULANGAN VERSIYA
// ⚠️ Bu fayl endi ES MODULE sifatida yuklanishi kerak, chunki api.js'ni import qiladi.
// dashboard.html da script tegini shunga almashtiring:
//   <script type="module" src="js/telegram-ui.js"></script>
// ("defer" kerak emas — type="module" bilan skript avtomatik defer bo'lib ishlaydi)
// ==========================================================================

import api from './api.js';

document.addEventListener('DOMContentLoaded', () => {

    const section = document.getElementById('sec-telegram');
    if (!section) return; // sahifada Telegram bo'limi yo'q bo'lsa, hech narsa qilmaydi

    // ------------------------------------------------------------------
    // 1. BOTGA ULANISH / UZISH — HAQIQIY BACKEND ORQALI
    // ------------------------------------------------------------------
    const connectionCard = document.getElementById('tg-connection-card');
    const btnConnect      = document.getElementById('tg-btn-connect');
    const btnDisconnect   = document.getElementById('tg-btn-disconnect');
    const statusDot       = document.getElementById('tg-status-dot');
    const statusText      = document.getElementById('tg-status-text');
    const botUsernameEl   = document.getElementById('tg-bot-username');
    const syncText        = document.getElementById('tg-sync-text');
    const syncValue       = document.getElementById('tg-sync-value');
    const connectionHint  = document.getElementById('tg-connection-hint');

    let statusPollTimer = null;

    function setConnected(isConnected, botUsername) {
        connectionCard.dataset.connected = isConnected ? 'true' : 'false';

        statusDot.classList.toggle('on', isConnected);
        statusDot.classList.toggle('off', !isConnected);
        statusText.classList.toggle('on', isConnected);
        statusText.classList.toggle('off', !isConnected);
        statusText.textContent = isConnected ? 'Ulangan' : 'Ulanmagan';

        if (botUsername && botUsernameEl) {
            botUsernameEl.href = `https://t.me/${botUsername}`;
            botUsernameEl.textContent = `@${botUsername}`;
        }

        botUsernameEl.style.display = isConnected ? 'block' : 'none';
        syncText.style.display      = isConnected ? 'flex' : 'none';
        if (isConnected) syncValue.textContent = 'hozirgina';

        connectionHint.style.display = isConnected ? 'none' : 'block';

        btnConnect.classList.toggle('is-connected', isConnected);
        btnConnect.querySelector('span').textContent = isConnected ? 'Qayta ulanish' : 'Botga ulanish';
        btnDisconnect.style.display = isConnected ? 'inline-flex' : 'none';

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /** Sahifa ochilganda joriy ulanish holatini backend'dan olib keladi */
    async function loadTelegramStatus() {
        try {
            const data = await api.get('/telegram/settings');
            setConnected(data.connected, data.botUsername);
            applyLoadedSettings(data.settings);
            renderRemindersFromServer(data.reminders || []);
        } catch (err) {
            console.error('Telegram holatini yuklashda xatolik:', err);
        }
    }

    /** Ulanish tugmasi bosilganda: token olib, Telegram'ni ochadi va holatni kuzatadi */
    if (btnConnect) {
        btnConnect.addEventListener('click', async () => {
            try {
                btnConnect.disabled = true;
                const { deepLink, botUsername } = await api.post('/telegram/connect-token');

                window.open(deepLink, '_blank');

                // Telegram'da /start bosilishini kutamiz — har 3 soniyada tekshiramiz
                if (statusPollTimer) clearInterval(statusPollTimer);
                let attempts = 0;
                statusPollTimer = setInterval(async () => {
                    attempts++;
                    try {
                        const status = await api.get('/telegram/status');
                        if (status.connected) {
                            clearInterval(statusPollTimer);
                            setConnected(true, botUsername);
                            btnConnect.disabled = false;
                        }
                    } catch { /* keyingi urinishda qayta tekshiramiz */ }

                    if (attempts >= 40) { // ~2 daqiqa
                        clearInterval(statusPollTimer);
                        btnConnect.disabled = false;
                    }
                }, 3000);
            } catch (err) {
                alert(err.message || "Ulanishda xatolik yuz berdi");
                btnConnect.disabled = false;
            }
        });
    }

    if (btnDisconnect) {
        btnDisconnect.addEventListener('click', async () => {
            if (!confirm("Telegram botini uzmoqchimisiz? Bildirishnomalar to'xtaydi.")) return;
            try {
                await api.post('/telegram/disconnect');
                setConnected(false);
            } catch (err) {
                alert(err.message || "Uzishda xatolik yuz berdi");
            }
        });
    }

    // ------------------------------------------------------------------
    // 2. BILDIRISHNOMALAR — "X faol" hisoblagichi + backendga saqlash
    // ------------------------------------------------------------------
    const activeBadge   = document.getElementById('tg-active-badge');
    const notifToggles  = document.querySelectorAll('.tg-notif-toggle');
    const NOTIF_KEY_MAP = [
        'notifTradeSaved', 'notifRiskAlert', 'notifDailyReport',
        'notifGoalProgress', 'notifWeeklyReport', 'notifSessionReminder',
    ];

    function updateActiveBadge() {
        const activeCount = Array.from(notifToggles).filter(t => t.checked).length;
        if (activeBadge) activeBadge.textContent = `${activeCount} faol`;
    }

    notifToggles.forEach((toggle, index) => {
        toggle.addEventListener('change', async () => {
            updateActiveBadge();
            const key = NOTIF_KEY_MAP[index];
            if (!key) return;
            try {
                await api.put('/telegram/report-settings', { [key]: toggle.checked });
            } catch (err) {
                console.error('Bildirishnoma sozlamasini saqlashda xatolik:', err);
            }
        });
    });
    updateActiveBadge();

    // ------------------------------------------------------------------
    // 3. SAVDO ESLATMALARI — backend bilan to'liq CRUD
    // ------------------------------------------------------------------
    const btnAddReminder  = document.getElementById('tg-btn-add-reminder');
    const reminderForm    = document.getElementById('tg-reminder-form');
    const btnSaveReminder = document.getElementById('tg-btn-save-reminder');
    const btnCancelReminder = document.getElementById('tg-btn-cancel-reminder');
    const reminderTimeInput  = document.getElementById('tg-reminder-time');
    const reminderTitleInput = document.getElementById('tg-reminder-title');
    const reminderFreqSelect = document.getElementById('tg-reminder-freq');
    const reminderList    = document.getElementById('tg-reminder-list');

    function toggleReminderForm(show) {
        reminderForm.style.display = show ? 'flex' : 'none';
        if (show) reminderTitleInput.focus();
    }

    function buildReminderRow(reminder) {
        const row = document.createElement('div');
        row.className = 'tg-reminder-row';
        row.dataset.id = reminder._id;
        row.dataset.active = reminder.active ? 'true' : 'false';
        row.innerHTML = `
            <span class="tg-reminder-time">${reminder.time}</span>
            <div class="tg-reminder-text">
                <strong>${reminder.title}</strong>
                <span>${reminder.freq}</span>
            </div>
            <span class="tg-reminder-freq">${reminder.freq}</span>
            <span class="tg-toggle"><input type="checkbox" class="tg-reminder-toggle" ${reminder.active ? 'checked' : ''}><span class="tg-toggle-slider"></span></span>
            <button type="button" class="tg-reminder-delete" title="O'chirish"><i data-lucide="trash-2"></i></button>
        `;
        attachReminderRowEvents(row);
        return row;
    }

    /** Backenddan kelgan eslatmalar ro'yxatini jadvalga chizadi */
    function renderRemindersFromServer(reminders) {
        if (!reminderList) return;
        reminderList.innerHTML = '';
        reminders.forEach(r => reminderList.appendChild(buildReminderRow(r)));
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function attachReminderRowEvents(row) {
        const deleteBtn = row.querySelector('.tg-reminder-delete');
        const toggleInput = row.querySelector('.tg-reminder-toggle');
        const id = row.dataset.id;

        deleteBtn.addEventListener('click', async () => {
            if (!confirm("Ushbu eslatmani o'chirmoqchimisiz?")) return;
            try {
                if (id) await api.delete(`/telegram/reminders/${id}`);
                row.remove();
            } catch (err) {
                alert(err.message || "O'chirishda xatolik");
            }
        });

        toggleInput.addEventListener('change', async () => {
            row.dataset.active = toggleInput.checked ? 'true' : 'false';
            try {
                if (id) await api.put(`/telegram/reminders/${id}`, { active: toggleInput.checked });
            } catch (err) {
                console.error('Eslatmani yangilashda xatolik:', err);
            }
        });
    }

    if (btnAddReminder)    btnAddReminder.addEventListener('click', () => toggleReminderForm(true));
    if (btnCancelReminder) btnCancelReminder.addEventListener('click', () => toggleReminderForm(false));

    if (btnSaveReminder) {
        btnSaveReminder.addEventListener('click', async () => {
            const time  = reminderTimeInput.value;
            const title = reminderTitleInput.value.trim();
            const freq  = reminderFreqSelect.value;

            if (!time || !title) {
                alert("Vaqt va eslatma nomini kiriting.");
                return;
            }

            try {
                const saved = await api.post('/telegram/reminders', { time, title, freq });
                reminderList.appendChild(buildReminderRow(saved));
                if (typeof lucide !== 'undefined') lucide.createIcons();

                reminderTitleInput.value = '';
                toggleReminderForm(false);
            } catch (err) {
                alert(err.message || "Eslatma qo'shishda xatolik");
            }
        });
    }

    // ------------------------------------------------------------------
    // 4. KUNLIK HISOBOT — "Hisobotga kiritilsin" chiplar + avto-yuborish/vaqt
    // ------------------------------------------------------------------
    function getActiveChipKeys() {
        return Array.from(document.querySelectorAll('.tg-chip.active')).map(c => c.dataset.chip);
    }

    document.querySelectorAll('.tg-chip').forEach(chip => {
        chip.addEventListener('click', async () => {
            chip.classList.toggle('active');
            try {
                await api.put('/telegram/report-settings', { reportIncludes: getActiveChipKeys() });
            } catch (err) {
                console.error("Hisobot tarkibini saqlashda xatolik:", err);
            }
        });
    });

    const autoSendToggle = document.getElementById('tg-report-autosend');
    if (autoSendToggle) {
        autoSendToggle.addEventListener('change', async () => {
            try {
                await api.put('/telegram/report-settings', { reportAutoSend: autoSendToggle.checked });
            } catch (err) {
                console.error("Avto-yuborish sozlamasini saqlashda xatolik:", err);
            }
        });
    }

    const reportTimeInput = document.getElementById('tg-report-time');
    if (reportTimeInput) {
        reportTimeInput.addEventListener('change', async () => {
            try {
                await api.put('/telegram/report-settings', { reportTime: reportTimeInput.value });
                const bubbleTime = document.getElementById('tg-bubble-time');
                if (bubbleTime) bubbleTime.textContent = `${reportTimeInput.value} ✓✓`;
            } catch (err) {
                console.error("Yuborish vaqtini saqlashda xatolik:", err);
            }
        });
    }

    /** Backenddan kelgan sozlamalarni forma elementlariga tarqatadi */
    function applyLoadedSettings(settings) {
        if (!settings) return;

        notifToggles.forEach((toggle, index) => {
            const key = NOTIF_KEY_MAP[index];
            if (key && settings[key] !== undefined) toggle.checked = settings[key];
        });
        updateActiveBadge();

        if (autoSendToggle && settings.reportAutoSend !== undefined) {
            autoSendToggle.checked = settings.reportAutoSend;
        }
        if (reportTimeInput && settings.reportTime) {
            reportTimeInput.value = settings.reportTime;
        }
        if (Array.isArray(settings.reportIncludes)) {
            document.querySelectorAll('.tg-chip').forEach(chip => {
                chip.classList.toggle('active', settings.reportIncludes.includes(chip.dataset.chip));
            });
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // ------------------------------------------------------------------
    // 5. TEST XABAR YUBORISH — HAQIQIY BACKEND ORQALI
    // ------------------------------------------------------------------
    const btnTest = document.getElementById('tg-btn-test');
    if (btnTest) {
        btnTest.addEventListener('click', async () => {
            if (connectionCard.dataset.connected !== 'true') {
                alert("Avval Telegram botiga ulaning.");
                return;
            }

            const label = btnTest.querySelector('span');
            const original = label.textContent;

            try {
                btnTest.disabled = true;
                await api.post('/telegram/send-test');

                btnTest.classList.add('is-sent');
                label.textContent = 'Yuborildi ✓';

                setTimeout(() => {
                    btnTest.classList.remove('is-sent');
                    label.textContent = original;
                    btnTest.disabled = false;
                }, 2000);
            } catch (err) {
                alert(err.message || "Xabar yuborishda xatolik");
                label.textContent = original;
                btnTest.disabled = false;
            }
        });
    }

    // ------------------------------------------------------------------
    // ISHGA TUSHIRISH
    // ------------------------------------------------------------------
    loadTelegramStatus();
});