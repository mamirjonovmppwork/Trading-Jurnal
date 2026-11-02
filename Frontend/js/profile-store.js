// ==========================================================================
// PROFIL KESHI
//
// Muammo: dashboard.js va settings.js ikkisi ham mustaqil ravishda
// `GET /auth/profile` chaqirardi va dashboard ochilganda so'rov IKKI
// MARTA ketardi (4-bosqich auditi: 546 ms + 320 ms). Render'da sovuq
// startda bu ikki baravar kutish degani.
//
// Yechim: so'rovning o'zi emas, PROMISE keshlanadi. Shu sababli ikki
// modul bir vaqtda chaqirsa ham tarmoqqa bitta so'rov ketadi —
// ikkinchisi o'sha promise'ni kutadi.
// ==========================================================================

import api from './api.js';

let profilePromise = null;

/**
 * Profilni qaytaradi. Birinchi chaqiruv so'rov yuboradi, keyingilari
 * o'sha natijani oladi.
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.force] true — keshni chetlab o'tib qayta so'raydi
 * @returns {Promise<object>} publicUser() qaytargan profil
 */
export function getProfile({ force = false } = {}) {
    if (force || !profilePromise) {
        profilePromise = api.get('/auth/profile').catch(err => {
            // ❗ Xato keshlanib qolmasligi kerak — aks holda bitta
            //    muvaffaqiyatsiz so'rovdan keyin sahifa butunlay
            //    tiqilib qolardi. Keshni bo'shatib, xatoni uzatamiz.
            profilePromise = null;
            throw err;
        });
    }
    return profilePromise;
}

/**
 * Keshni serverdan kelgan yangi profil bilan almashtiradi.
 * Profil saqlangandan keyin chaqiriladi — qayta so'rov shart emas.
 */
export function setProfile(user) {
    if (user) profilePromise = Promise.resolve(user);
}

/** Keshni bo'shatadi (chiqishda yoki foydalanuvchi almashganda) */
export function clearProfile() {
    profilePromise = null;
}
