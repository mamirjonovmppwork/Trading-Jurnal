// Backend serveringizning Render'dagi aniq manzili
const BASE_URL = 'https://trading-jurnal.onrender.com/api'; 

const api = {
    /**
     * URL manzilini to'g'ri shakllantirish uchun yordamchi funksiya
     * Agar endpoint ichida adashib '/api' yozilgan bo'lsa, uni tozalaydi
     */
    formatEndpoint(endpoint) {
        let cleanEndpoint = endpoint;
        if (cleanEndpoint.startsWith('/api')) {
            cleanEndpoint = cleanEndpoint.replace('/api', '');
        }
        // Agar boshida '/' bo'lmasa, qo'shib qo'yamiz
        if (!cleanEndpoint.startsWith('/')) {
            cleanEndpoint = '/' + cleanEndpoint;
        }
        return cleanEndpoint;
    },

    // --- GET SO'ROVLARI ---
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

    // --- POST SO'ROVLARI ---
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
    }
};

// Boshqa JS fayllarda ishlatish uchun eksport qilamiz
export default api;