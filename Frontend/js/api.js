const BACKEND_URL = 'https://trading-jurnal.onrender.com';

/** Endpointni har doim to'g'ri "/api/..." ko'rinishiga keltiradi */
function formatEndpoint(endpoint) {
    let cleanEndpoint = endpoint;
    if (cleanEndpoint.startsWith('/api')) {
        cleanEndpoint = cleanEndpoint.replace('/api', '');
    }
    if (!cleanEndpoint.startsWith('/')) {
        cleanEndpoint = '/' + cleanEndpoint;
    }
    return '/api' + cleanEndpoint;
}

/**
 * Barcha so'rovlar uchun yagona markaziy funksiya.
 *
 * opts.token  — localStorage'dagi access token o'rniga shu token ishlatiladi.
 *               Tasdiqlash oqimida kerak: u yerda purpose:'verify' tokeni
 *               sessionStorage'da turadi va API tokeni bilan aralashmasligi
 *               kerak.
 * opts.noAuth — hech qanday Authorization header yuborilmaydi.
 */
async function request(method, endpoint, data, opts = {}) {
    const token = opts.noAuth ? null : (opts.token ?? localStorage.getItem('token'));
    const url = `${BACKEND_URL}${formatEndpoint(endpoint)}`;

    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    };

    if (data !== undefined) {
        options.body = JSON.stringify(data);
    }

    let res;
    try {
        res = await fetch(url, options);
    } catch (networkErr) {
        // Server ishlamayapti, internet yo'q yoki CORS bloklagan holat
        console.error(`${method} ${url} — tarmoq xatoligi:`, networkErr);
        throw { message: 'Serverga ulanib bo\'lmadi. Internetni yoki serverni tekshiring.' };
    }

    let body = null;
    try {
        body = await res.json();
    } catch {
        // Javob JSON bo'lmasligi mumkin (masalan bo'sh 204 javob)
    }

    if (!res.ok) {
        // Access token muddati tugagan / yaroqsiz bo'lsa — avtomatik chiqarib
        // yuboramiz. Tasdiqlash oqimidagi 401/403 bunga kirmaydi: u yerda
        // o'z tokeni ishlatiladi va chaqiruvchi o'zi hal qiladi.
        if (res.status === 401 && !opts.token && !opts.noAuth) {
            localStorage.removeItem('token');
        }
        const message = body?.message || `Server xatolik qaytardi (${res.status})`;
        console.error(`${method} ${url} so'rovida xatolik:`, message);
        throw { message, status: res.status, body };
    }

    return body;
}

const api = {
    get:    (endpoint, opts) => request('GET', endpoint, undefined, opts),
    post:   (endpoint, data, opts) => request('POST', endpoint, data, opts),
    put:    (endpoint, data, opts) => request('PUT', endpoint, data, opts),
    delete: (endpoint, opts) => request('DELETE', endpoint, undefined, opts),
};

export default api;
