import api from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    // Netlify va lokal uchun xavfsiz yo'naltirish funksiyasi
    function redirectTo(page) {
        const path = window.location.pathname;
        if (path.includes('/Frontend/')) {
            window.location.href = `/Frontend/${page}`;
        } else {
            window.location.href = page;
        }
    }

    // --- LOGIN QILISH LOGIKASI ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const data = await api.post('/auth/login', { email, password });
                
                if (!data || !data.token) {
                    throw new Error("Serverdan token kelmadi!");
                }
                
                localStorage.setItem('token', data.token);
                
                // Profil holatini tekshiramiz
                const userProfile = await api.get('/auth/profile');
                
                const isVerified = userProfile.isVerified ?? false; // Yangilarda false bo'ladi
                const isOnboarded = userProfile.isOnboarded ?? false;
                
                if (!isVerified) {
                    // Agar bazada verified false bo'lsa, lekin oldin lokalda o'tgan bo'lsa tozalaymiz
                    localStorage.removeItem('user_verified'); 
                    redirectTo('verify.html');
                } else if (!isOnboarded) {
                    redirectTo('onboarding.html');
                } else {
                    localStorage.setItem('user_verified', 'true'); // Har ehtimolga qarshi
                    redirectTo('dashboard.html');
                }
            } catch (err) {
                console.error("Login xatoligi:", err);
                alert(err.message || 'Login qilishda xatolik yuz berdi!');
            }
        });
    }

    // --- RO'YXATDAN O'TISH LOGIKASI ---
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const data = await api.post('/auth/register', { username, email, password });
                
                if (data && data.token) {
                    localStorage.setItem('token', data.token);
                }
                
                // Yangi ro'yxatdan o'tganda har doim verify sahifasiga yuboramiz va eski flaglarni o'chiramiz
                localStorage.removeItem('user_verified'); 
                redirectTo('verify.html'); 
            } catch (err) {
                console.error("Registratsiya xatoligi:", err);
                alert(err.message || 'Roʻyxatdan oʻtishda xatolik!');
            }
        });
    }
});