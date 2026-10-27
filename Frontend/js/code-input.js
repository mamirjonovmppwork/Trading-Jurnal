// ==========================================================================
// 6 KATAKLI KOD KIRITISH — UMUMIY KOMPONENT
// verify.html va reset-password.html ikkisi ham shu moduldan foydalanadi.
//
// Qo'llab-quvvatlaydi: avtomatik keyingi katakka o'tish, Backspace bilan
// orqaga, strelkalar, va PASTE (qaysi katakka tashlansa ham kod bo'linadi).
// ==========================================================================

/**
 * @param {string} wrapperId  .code-boxes elementining id'si
 * @param {object} opts
 * @param {function} opts.onComplete  kod to'liq kiritilganda chaqiriladi
 * @param {function} opts.onInput     har qanday o'zgarishda chaqiriladi
 */
export function initCodeInput(wrapperId, opts = {}) {
    const wrap = document.getElementById(wrapperId);
    if (!wrap) return null;

    const boxes = [...wrap.querySelectorAll('.code-box')];
    if (!boxes.length) return null;

    const read = () => boxes.map(b => b.value.trim()).join('');

    const clear = () => {
        boxes.forEach(b => {
            b.value = '';
            b.classList.remove('filled');
        });
        wrap.classList.remove('has-error');
        boxes[0]?.focus();
    };

    const setError = (on = true) => wrap.classList.toggle('has-error', on);

    const focus = () => boxes[0]?.focus();

    /** Kodni kataklarga taqsimlaydi (paste uchun) */
    const distribute = (raw) => {
        const clean = String(raw).replace(/\D/g, '').slice(0, boxes.length);
        boxes.forEach((b, i) => {
            b.value = clean[i] || '';
            b.classList.toggle('filled', !!clean[i]);
        });
        boxes[Math.min(clean.length, boxes.length - 1)]?.focus();
        return clean;
    };

    boxes.forEach((box, i) => {
        box.addEventListener('input', () => {
            const digit = box.value.replace(/\D/g, '').slice(-1);
            box.value = digit;
            box.classList.toggle('filled', !!digit);
            wrap.classList.remove('has-error');
            opts.onInput?.();

            if (digit && i < boxes.length - 1) {
                boxes[i + 1].focus();
            }
            if (digit && i === boxes.length - 1 && read().length === boxes.length) {
                opts.onComplete?.(read());
            }
        });

        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !box.value && i > 0) {
                e.preventDefault();
                boxes[i - 1].focus();
                boxes[i - 1].value = '';
                boxes[i - 1].classList.remove('filled');
            } else if (e.key === 'ArrowLeft' && i > 0) {
                e.preventDefault();
                boxes[i - 1].focus();
            } else if (e.key === 'ArrowRight' && i < boxes.length - 1) {
                e.preventDefault();
                boxes[i + 1].focus();
            }
        });

        box.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
            const filled = distribute(text);
            opts.onInput?.();
            if (filled.length === boxes.length) {
                opts.onComplete?.(read());
            }
        });
    });

    return { read, clear, setError, focus, length: boxes.length };
}

/**
 * "Qayta yuborish" tugmasi uchun sanoqli taymer.
 * Server ham 60s chegarasini majburlaydi — bu faqat UI qulayligi.
 */
export function createResendTimer(button, defaultSeconds = 60, idleLabel = 'Kodni qayta yuborish') {
    let timerId = null;

    function stop() {
        if (timerId) clearInterval(timerId);
        timerId = null;
        if (button) {
            button.disabled = false;
            button.textContent = idleLabel;
        }
    }

    function start(seconds = defaultSeconds) {
        if (!button) return;
        if (timerId) clearInterval(timerId);

        let left = Math.max(0, Math.ceil(seconds));
        button.disabled = true;

        const tick = () => {
            if (left <= 0) {
                stop();
                return;
            }
            button.textContent = `Qayta yuborish (${left}s)`;
            left--;
        };

        tick();
        timerId = setInterval(tick, 1000);
    }

    return { start, stop };
}
