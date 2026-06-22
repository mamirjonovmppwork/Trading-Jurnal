document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    // --- LOGIN QILISH LOGIKASI ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                // 1. Tizimga kirish va tokenni olish
                const data = await api.post('/auth/login', { email, password });
                localStorage.setItem('token', data.token);
                
                // 2. Foydalanuvchi holatini (verify va onboarding) tekshirish
                const userProfile = await api.get('/auth/profile');
                
                if (!userProfile.isVerified) {
                    // Agar email tasdiqlanmagan bo'lsa
                    window.location.href = 'verify.html';
                } else if (!userProfile.isOnboarded) {
                    // Agar ilk sozlamalar (balans) kiritilmagan bo'lsa
                    window.location.href = 'onboarding.html';
                } else {
                    // Hammasi joyida bo'lsa, to'g'ri Dashboardga
                    window.location.href = 'dashboard.html';
                }
            } catch (err) {
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
                // 1. Ro'yxatdan o'tish va tokenni saqlash
                const data = await api.post('/auth/register', { username, email, password });
                localStorage.setItem('token', data.token);
                
                // 2. Ro'yxatdan o'tishi bilan srazu Email Verify sahifasiga yo'naltirish
                window.location.href = 'verify.html'; 
            } catch (err) {
                alert(err.message || 'Roʻyxatdan oʻtishda xatolik!');
            }
        });
    }
});