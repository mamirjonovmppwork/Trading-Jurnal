const BASE_URL = 'https://trading-jurnal.onrender.com'; // Oxiridagi /api olib tashlandi, chunki pastda qo'shiladi

const api = {
    formatEndpoint(endpoint) {
        let cleanEndpoint = endpoint;
        // Agar endpoint ichida allaqachon /api bo'lsa, tozalaydi
        if (cleanEndpoint.startsWith('/api')) {
            cleanEndpoint = cleanEndpoint.replace('/api', '');
        }
        if (!cleanEndpoint.startsWith('/')) {
            cleanEndpoint = '/' + cleanEndpoint;
        }
        // Har doim so'rov /api bilan ketishini ta'minlaydi
        return '/api' + cleanEndpoint;
    },

    async get(endpoint) {
        const token = localStorage.getItem('token');
        const cleanEndpoint = this.formatEndpoint(endpoint);
        const fullUrl = `${BASE_URL}${cleanEndpoint}`;

        try {
            const res = await fetch(fullUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ message: 'Server xatolik qaytardi!' }));
                throw errorData;
            }
            return await res.json();
        } catch (err) {
            console.error(`GET ${fullUrl} so'rovida xatolik:`, err);
            throw err;
        }
    },

    async post(endpoint, data) {
        const token = localStorage.getItem('token');
        const cleanEndpoint = this.formatEndpoint(endpoint);
        const fullUrl = `${BASE_URL}${cleanEndpoint}`;

        try {
            const res = await fetch(fullUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify(data)
            });
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ message: 'Server xatolik qaytardi!' }));
                throw errorData;
            }
            return await res.json();
        } catch (err) {
            console.error(`POST ${fullUrl} so'rovida xatolik:`, err);
            throw err;
        }
    },

    // 🟢 QOLIP ASOSIDA QO'SHILDI: TAHRIRLASH UCHUN (PUT)
    async put(endpoint, data) {
        const token = localStorage.getItem('token');
        const cleanEndpoint = this.formatEndpoint(endpoint);
        const fullUrl = `${BASE_URL}${cleanEndpoint}`;

        try {
            const res = await fetch(fullUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify(data) // Tahrirlangan ma'lumotlar yuboriladi
            });
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ message: 'Server xatolik qaytardi!' }));
                throw errorData;
            }
            return await res.json();
        } catch (err) {
            console.error(`PUT ${fullUrl} so'rovida xatolik:`, err);
            throw err;
        }
    },

    // 🟢 QOLIP ASOSIDA QO'SHILDI: O'CHIRISH UCHUN (DELETE)
    async delete(endpoint) {
        const token = localStorage.getItem('token');
        const cleanEndpoint = this.formatEndpoint(endpoint);
        const fullUrl = `${BASE_URL}${cleanEndpoint}`;

        try {
            const res = await fetch(fullUrl, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                } // Delete so'rovida body bo'lmaydi
            });
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ message: 'Server xatolik qaytardi!' }));
                throw errorData;
            }
            return await res.json();
        } catch (err) {
            console.error(`DELETE ${fullUrl} so'rovida xatolik:`, err);
            throw err;
        }
    }
};

export default api;