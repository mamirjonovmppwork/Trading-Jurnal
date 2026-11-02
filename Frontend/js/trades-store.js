// ==========================================================================
// SAVDOLAR KESHI
//
// dashboard.js va telegram-ui.js (Telegram ko'rinishi namunasi) ikkisi ham
// savdolar ro'yxatiga muhtoj. Har biri mustaqil `GET /trades` chaqirsa
// sahifa ochilganda so'rov ikki marta ketadi — profil bilan bo'lgan
// holatning aynan o'zi (profile-store.js izohiga qarang).
//
// Shu sababli PROMISE keshlanadi: bir vaqtda chaqirilsa tarmoqqa bitta
// so'rov ketadi. Savdo qo'shilgan/tahrirlangan/o'chirilganda dashboard.js
// `force: true` bilan yangilaydi va `trades:updated` hodisasini yuboradi —
// unga ulangan bloklar (namuna) o'zini qayta chizadi.
// ==========================================================================

import api from './api.js';

export const TRADES_UPDATED = 'trades:updated';

let tradesPromise = null;

/**
 * Savdolar ro'yxatini qaytaradi.
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.force] true — keshni chetlab o'tib qayta so'raydi
 * @returns {Promise<Array>}
 */
export function getTrades({ force = false } = {}) {
    if (force || !tradesPromise) {
        tradesPromise = api.get('/trades')
            .then(res => (Array.isArray(res) ? res : (res?.trades || [])))
            .catch(err => {
                // Xato keshlanib qolmasin — keyingi chaqiruv qayta urinadi
                tradesPromise = null;
                throw err;
            });
    }
    return tradesPromise;
}

/** Keshni yangilab, tinglovchilarga xabar beradi */
export async function refreshTrades() {
    const trades = await getTrades({ force: true });
    window.dispatchEvent(new CustomEvent(TRADES_UPDATED, { detail: trades }));
    return trades;
}

/** Keshni bo'shatadi (chiqishda) */
export function clearTrades() {
    tradesPromise = null;
}
