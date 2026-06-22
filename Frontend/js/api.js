// Backend server porti va manzili
const BASE_URL = 'http://localhost:5000/api'; 

const api = {
    // --- GET SO'ROVLARI ---
    async get(endpoint) {
        const token = localStorage.getItem('token');
        const res = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });
        
        if (!res.ok) {
            // Agar backend xatolik qaytarsa va u JSON bo'lmasa, qulab tushmaslik chorasi
            const errorData = await res.json().catch(() => ({ message: 'Server bilan ulanishda xatolik yuz berdi!' }));
            throw errorData;
        }
        return res.json();
    },

    // --- POST SO'ROVLARI ---
    async post(endpoint, data) {
        const token = localStorage.getItem('token');
        const res = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify(data)
        });
        
        if (!res.ok) {
            // Xatolikni xavfsiz ushlash
            const errorData = await res.json().catch(() => ({ message: 'Server bilan ulanishda xatolik yuz berdi!' }));
            throw errorData;
        }
        return res.json();
    }
};