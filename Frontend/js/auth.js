import api from './api.js';

// Tugmani "yuklanmoqda" holatiga o'tkazish/qaytarish uchun yordamchi funksiya
function setButtonLoading(button, isLoading, loadingText = 'Yuklanmoqda...') {
    if (isLoading) {
        // Asl matnni tugmaning o'zida saqlab qo'yamiz, keyin qaytarish uchun
        button.dataset.originalHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `<span class="btn-spinner"></span> <span>${loadingText}</span>`;
    } else {
        button.disabled = false;
        if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml;
            // Ikonkalar (lucide) qaytarilgan matn ichida bo'lsa, qayta chizamiz
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
    }
}

// Netlify va lokal uchun xavfsiz yo'naltirish funksiyasi
// (top-level qildik, chunki Google callback ham shu funksiyadan foydalanadi)
function redirectTo(page) {
    const path = window.location.pathname;
    if (path.includes('/Frontend/')) {
        window.location.href = `/Frontend/${page}`;
    } else {
        window.location.href = page;
    }
}

// Login/Google — ikkalasi ham shu logikadan foydalanadi:
// tokenni saqlaydi, profilni tekshiradi va kerakli sahifaga yo'naltiradi
async function finishLoginFlow(token) {
    localStorage.setItem('token', token);

    const userProfile = await api.get('/auth/profile');

    const isVerified = userProfile.isVerified ?? false;
    const isOnboarded = userProfile.isOnboarded ?? false;

    if (!isVerified) {
        localStorage.removeItem('user_verified');
        redirectTo('verify.html');
    } else if (!isOnboarded) {
        redirectTo('onboarding.html');
    } else {
        localStorage.setItem('user_verified', 'true');
        redirectTo('dashboard.html');
    }
}

// Google "Continue with Google" tugmasi bosilganda shu funksiya chaqiriladi.
// Google skripti buni GLOBAL funksiya sifatida chaqiradi, shuning uchun window'ga bog'laymiz.
window.handleGoogleCredential = async function (response) {
    try {
        if (!response || !response.credential) {
            throw new Error('Google javobi noto\'g\'ri keldi');
        }

        const data = await api.post('/auth/google', { credential: response.credential });

        if (!data || !data.token) {
            throw new Error('Serverdan token kelmadi!');
        }

        await finishLoginFlow(data.token);
    } catch (err) {
        console.error('Google orqali kirish xatoligi:', err);
        alert(err.message || 'Google orqali kirishda xatolik yuz berdi!');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    // --- LOGIN QILISH LOGIKASI ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const submitBtn = loginForm.querySelector('.submit-btn');

            setButtonLoading(submitBtn, true, 'Kirilmoqda...');

            try {
                const data = await api.post('/auth/login', { email, password });
                
                if (!data || !data.token) {
                    throw new Error("Serverdan token kelmadi!");
                }

                await finishLoginFlow(data.token);
                // Muvaffaqiyatli bo'lsa, sahifa o'zgaradi — tugmani qayta yoqish shart emas
            } catch (err) {
                console.error("Login xatoligi:", err);
                alert(err.message || 'Login qilishda xatolik yuz berdi!');
                setButtonLoading(submitBtn, false);
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
            const submitBtn = registerForm.querySelector('.submit-btn');

            setButtonLoading(submitBtn, true, 'Roʻyxatdan oʻtilmoqda...');

            try {
                const data = await api.post('/auth/register', { username, email, password });
                
                if (data && data.token) {
                    localStorage.setItem('token', data.token);
                }
                
                // Yangi ro'yxatdan o'tganda har doim verify sahifasiga yuboramiz va eski flaglarni o'chiramiz
                localStorage.removeItem('user_verified'); 
                redirectTo('verify.html'); 
                // Muvaffaqiyatli bo'lsa, sahifa o'zgaradi — tugmani qayta yoqish shart emas
            } catch (err) {
                console.error("Registratsiya xatoligi:", err);
                alert(err.message || 'Roʻyxatdan oʻtishda xatolik!');
                setButtonLoading(submitBtn, false);
            }
        });
    }
});