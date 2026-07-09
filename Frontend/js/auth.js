import api from './api.js';

// Tugmani "yuklanmoqda" holatiga o'tkazish/qaytarish uchun yordamchi funksiya
function setButtonLoading(button, isLoading, loadingText = 'Yuklanmoqda...') {
    if (isLoading) {
        button.dataset.originalHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `<span class="btn-spinner"></span> <span>${loadingText}</span>`;
    } else {
        button.disabled = false;
        if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml;
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
    }
}

// Netlify va lokal uchun xavfsiz yo'naltirish funksiyasi
function redirectTo(page) {
    const path = window.location.pathname;
    if (path.includes('/Frontend/')) {
        window.location.href = `/Frontend/${page}`;
    } else {
        window.location.href = page;
    }
}

// Login/Google — ikkalasi ham shu logikadan foydalanadi:
async function finishLoginFlow(token) {
    localStorage.setItem('token', token);

    try {
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
    } catch (err) {
        console.error("Profil tekshirishda xatolik:", err);
        // Agar backendda hali onboarding bo'lmasa, srazu dashboardga o'tkazib yuboramiz
        localStorage.setItem('user_verified', 'true');
        redirectTo('dashboard.html');
    }
}

// --- GOOGLE BILAN KIRISH MANTIQI (GLOBAL WINDOW OBYEKTIGA BOG'LANDI) ---
window.handleGoogleLogin = function(response) {
    const credential = response.credential;
    if (!credential) return;

    fetch('https://trading-jurnal.onrender.com/api/auth/google', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ credential })
    })
    .then(res => {
        if (!res.ok) throw new Error("Google auth server xatosi");
        return res.json();
    })
    .then(async (data) => {
        if (data.token) {
            localStorage.setItem('username', data.username);
            // Kodingizdagi umumiy login oqimi (finishLoginFlow) orqali o'tkazamiz
            await finishLoginFlow(data.token);
        } else {
            alert(data.message || "Tizimga kirishda xatolik yuz berdi");
        }
    })
    .catch(err => {
        console.error('Google login xatoligi:', err);
        alert('Google orqali kirishda xatolik yuz berdi!');
    });
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
                
                localStorage.removeItem('user_verified'); 
                redirectTo('verify.html'); 
            } catch (err) {
                console.error("Registratsiya xatoligi:", err);
                alert(err.message || 'Roʻyxatdan oʻtishda xatolik!');
                setButtonLoading(submitBtn, false);
            }
        });
    }
});