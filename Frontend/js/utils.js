// ==========================================================================
// UMUMIY YORDAMCHI FUNKSIYALAR
// ==========================================================================

/**
 * Matnni HTML ichiga xavfsiz qo'yish uchun escape qiladi.
 *
 * Nega kerak: jadval qatorlari va kartalar innerHTML orqali quriladi.
 * Foydalanuvchi "pair", "strategiya", "izoh" yoki "eslatma nomi" maydoniga
 * <img src=x onerror=...> kabi matn kiritsa, u escape'siz HTML sifatida
 * bajariladi (stored XSS). Shuning uchun innerHTML'ga ketadigan har qanday
 * foydalanuvchi matni shu funksiyadan o'tishi kerak.
 *
 * Eslatma: .textContent / .value ishlatilgan joylarda escape SHART EMAS —
 * ular matnni allaqachon matn sifatida qo'yadi.
 */
export function escapeHtml(value) {
    if (value === undefined || value === null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
