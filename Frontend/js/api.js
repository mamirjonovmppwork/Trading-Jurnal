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

/** Barcha so'rovlar uchun yagona markaziy funksiya */
async function request(method, endpoint, data) {
    const token = localStorage.getItem('token');
    const url = `${BASE_URL}${formatEndpoint(endpoint)}`;

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
        // Token muddati tugagan / yaroqsiz bo'lsa — avtomatik chiqarib yuboramiz
        if (res.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user_verified');
        }
        const message = body?.message || `Server xatolik qaytardi (${res.status})`;
        console.error(`${method} ${url} so'rovida xatolik:`, message);
        throw { message, status: res.status };
    }

    return body;
}

const api = {
    get: (endpoint) => request('GET', endpoint),
    post: (endpoint, data) => request('POST', endpoint, data),
    put: (endpoint, data) => request('PUT', endpoint, data),
    delete: (endpoint) => request('DELETE', endpoint),
};

export default api;