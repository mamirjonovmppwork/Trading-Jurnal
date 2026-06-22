import api from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

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
                
                const userProfile = await api.get('/auth/profile');
                
                const isVerified = userProfile.isVerified ?? true;
                const isOnboarded = userProfile.isOnboarded ?? true;
                
                if (!isVerified) {
                    redirectTo('verify.html');
                } else if (!isOnboarded) {
                    redirectTo('onboarding.html');
                } else {
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
                
                redirectTo('verify.html'); 
            } catch (err) {
                console.error("Registratsiya xatoligi:", err);
                alert(err.message || 'Roʻyxatdan oʻtishda xatolik!');
            }
        });
    }
});