# CLAUDE.md — Trading Jurnal V2

Bu fayl yangi sessiyada kontekstni tez tiklash uchun. **Sir saqlanmaydi** —
barcha kalitlar `Backend/.env` da (gitignore'da), namunasi `Backend/.env.example`.

---

## Stack va tuzilma

Vanilla JS SPA + Node/Express 5 + MongoDB (Mongoose 9). Build step yo'q,
framework yo'q, test freymvorki yo'q.

```
Backend/
  server.js              helmet, CORS, json limit 100kb, /health, DNS, mongoose
  models/        user.js (profil + authCode), trade.js
  routes/        authRoutes.js (11 endpoint, 3 limiter), tradeRoutes.js,
                 telegramRoutes.js, telegramWebhook.js
  middleware/    authMiddleware.js (token purpose), validate.js (validatsiya)
  services/      emailService.js (gmail/brevo/konsol), telegramService.js,
                 googleService.js
  utils/jwt.js   generateToken (access) / generateVerifyToken (verify)
  scheduler/     telegramScheduler.js (setInterval, har daqiqa)
  scripts/       setWebhook.js, resetDatabase.js (--confirm talab qiladi)

Frontend/        (statik, deploy: Netlify/Vercel)
  index · login · register · verify · reset-password · profile-setup ·
  dashboard · terms · privacy
  js/  api.js (markaziy fetch) · auth-flow.js (umumiy auth yordamchilari) ·
       code-input.js (6 katakli kod) · profile-fields.js (profil formasi) ·
       auth · register · verify · reset-password · profile-setup · settings ·
       dashboard · telegram-ui · utils (escapeHtml)
  css/ main · dashboard-advanced · media · forms
```

**Deploy:** backend Render, frontend Netlify + Vercel, baza MongoDB Atlas.

---

## Branch holati

| Branch | Holat |
|---|---|
| `main` | `9c7664a` — **tegilmagan**, 3 bosqichdagi ishlar kirmagan |
| `feat/stage-3-auth` | ishchi branch, push qilingan, `main`dan ilgarilagan |

`fix/stage-1` va `fix/stage-2` lokal branchlar — ularning commitlari
`feat/stage-3-auth` tarixida bor.

---

## Bajarilgan 3 bosqich

**1-bosqich (`8d06ebc`)** — ishlamayotgan narsalar:
- `session` enum nomuvofiqligi: kunning ~7 soatida (09–12, 21–00) savdo
  **umuman saqlanmasdi** (`LONDON_OPEN`/`OFF` enum'da yo'q edi)
- `mistake` maydoni schema'da yo'q edi → "Xatolar tahlili" abadiy bo'sh
- `onboarding`/`verify` sahifalari `api.js`ni oddiy `<script>` bilan
  yuklardi (u ESM) → so'rovlar **jimgina** ketmasdi, depozit saqlanmasdi
- "Avg R:R" aslida `wins/losses` ko'rsatardi
- `npm audit`: 3 zaiflik → 0; `Trade.userId` indeksi

**2-bosqich (`a006c7e`)** — xavfsizlik:
rate limit · validatsiya qatlami (500 → tushunarli 400) · helmet ·
`express.json({limit:'100kb'})` · `/health` DB uzilsa 503 · Telegram webhook
secret · `escapeHtml` (Telegram xabarlari + frontend `innerHTML`) ·
`localStorage` orqali verify'ni chetlab o'tish olib tashlandi · o'lik kod va
`passport`/`express-session` o'chirildi · `lucide@1.62.0` pin

**3-bosqich (`b55d813`, `b27e0c8`, `c649b7f`, `7843c61`, `8c1dbf4`, `56d4d69`)**
— yangi auth oqimi:
- User schema: `firstName`, `lastName`, `age` (16–99), `phone`,
  `phoneCountryCode`, `tradingStyles[]`, `strategies[]`, `customStrategy`,
  `markets[]`, `experience` — hammasi ixtiyoriy
- `authCode` subdocument: bcrypt hash, `purpose`, 10 daqiqa, max 5 urinish,
  60s qayta yuborish chegarasi (server tomonida)
- 11 endpoint: register, login, google, verify-code, resend-code,
  change-email, forgot-password, reset-password, GET/PUT profile, PUT password
- Sahifalar: 3 bo'limli `register`, 6 katakli `verify`, 3 qadamli
  `reset-password`, `profile-setup`, dashboard **Sozlamalar/Profil**,
  `terms`/`privacy` (huquqiy matn to'ldirilgan)
- `onboarding.html` o'chirildi (depozit register formasida)

**Testlar:** 299 avtomatik tekshiruv + 93 uchidan-uchiga (haqiqiy baza).
Brauzerda real sinov o'tkazildi. Hammasi o'tgan.

---

## Muhim texnik eslatmalar

### 1. Lokalda `mongodb+srv://` ISHLAMAYDI
Provayder/muhit DNS'i **SRV va TXT** so'rovlarini bloklaydi (A yozuvlari
ishlaydi). Shuning uchun `.env` da Atlas'ning **Legacy / non-SRV** manzili
ishlatiladi:

```
mongodb://<user>:<pass>@host1:27017,host2:27017,host3:27017/trading-jurnal-dev?ssl=true&replicaSet=<rs>&authSource=admin
```

❗ `authSource=admin` **majburiy** — SRV'da bu TXT yozuvidan kelardi, non-SRV'da
qo'lda yozish kerak. Bo'lmasa `bad auth : authentication failed`.

❗ Atlas "Connect" oynasidan ko'chirganda `<db_password>` o'rnini bosuvchi matn
qoladi — uni almashtirish esdan chiqmasin (bir marta shu tufayli `bad auth`
bo'lgan).

Render'da SRV ishlaydi — u yerda odatdagi `mongodb+srv://` qolishi mumkin.

### 2. `DNS_SERVERS`
`server.js` `mongoose.connect`dan oldin `dns.setServers()` chaqiradi, agar
`DNS_SERVERS` berilgan bo'lsa (lokalda `8.8.8.8,1.1.1.1`). **Render'da bu
o'zgaruvchi bo'lmasligi kerak** — bo'lmasa hech narsa o'zgarmaydi.

### 3. Telegram webhook fail-closed
`TELEGRAM_WEBHOOK_SECRET` sozlanmagan bo'lsa webhook **hech narsa qabul
qilmaydi** (403). Secret o'zgarsa `node scripts/setWebhook.js` ni **qayta**
ishga tushirish shart, aks holda bot javob bermaydi.

### 4. Gmail sozlanmaguncha kod KONSOLGA chiqadi
`GMAIL_USER`/`GMAIL_APP_PASSWORD` yo'q bo'lsa `emailService` konsol rejimida
ishlaydi va 6 xonali kodni server logiga chiqaradi (`EMAIL KONSOL REJIMI`
bloki). Lokal testda kodni shu yerdan oladi.

❗ `GMAIL_APP_PASSWORD` oddiy Gmail paroli **emas** — 2FA yoqilgach
`myaccount.google.com/apppasswords` dan olinadigan 16 belgili kalit.

### 5. Google login localhost'da ishlamaydi
Google Cloud Console → OAuth client → **Authorized JavaScript origins** ga
`http://localhost:5501` qo'shilmaguncha `localhost`dan Google bilan kirish
xato beradi. Client ID frontend HTML'da ochiq — bu dizayn bo'yicha normal.

### 6. Token purpose
Ikki xil JWT bor va ularni aralashtirmaslik kritik:
- `purpose:'access'` (24s) — butun API; faqat email tasdiqlangandan keyin
- `purpose:'verify'` (15daq) — faqat verify-code/resend-code/change-email

`authMiddleware` `purpose`ni majburlaydi. `purpose` claim'i yo'q eski tokenlar
rad etiladi. Frontend `verify` tokenini `sessionStorage`da, access tokenini
`localStorage`da saqlaydi.

### 7. Mongoose 9: massiv enum tuzog'i
`{ type: [String], enum: [...] }` shaklida **validator yaratilmaydi** — enum
jimgina e'tiborsiz qoladi. To'g'ri shakl:
`{ type: [{ type: String, enum: [...] }] }`

### 8. `api.js` backend manzilini o'zi tanlaydi
Sahifa `localhost`/`127.0.0.1`/`::1` da ochilsa `http://localhost:5000`,
aks holda production. Konsolga `[api] backend: ...` chiqaradi.

### 9. Lokal test qanday ishga tushadi
```
cd Backend && node server.js          # port 5000
```
Frontend uchun statik server kerak (ESM `file://` dan yuklanmaydi) — port
**5501** ishlatiladi, u CORS allowlist'da bor. So'ng
`http://localhost:5501/register.html`.

### 10. Hal qilinmagan masala
`app.set('trust proxy', 1)` tufayli backend to'g'ridan-to'g'ri (proxy'siz)
ochiq bo'lsa `X-Forwarded-For` qalbakilashtirib rate limiterni chetlab o'tish
mumkin. Render'da muammo yo'q (proxy header'ni qayta yozadi), boshqa hostingda
muhim.

---

## Ertangi reja

1. **Gmail App Password** — `.env`ga `GMAIL_USER` + `GMAIL_APP_PASSWORD`,
   haqiqiy xat yuborilishini sinash
2. **Google Console origin** — `http://localhost:5501` va production domenlar
3. **Kalitlarni yangilash** (ishlab chiqish davomida ko'rilgan/ishlatilgan):
   MongoDB foydalanuvchi paroli, Telegram bot token, `JWT_SECRET`
   (JWT almashtirilsa barcha sessiyalar tushadi — bu kutilgan)
4. **Render env** — `TELEGRAM_WEBHOOK_SECRET`, `BACKEND_URL`,
   `EMAIL_PROVIDER`, Gmail kalitlari; `DNS_SERVERS` **qo'shilmasin**
5. **`terms.html`/`privacy.html` sanasi** — hozir "2026-yil 27-oktabr",
   nashr sanasiga moslashtirish
6. **Merge → deploy** — `feat/stage-3-auth` → `main` (faqat foydalanuvchi
   aytganda), so'ng Render/Netlify deploy
7. **`node scripts/resetDatabase.js --confirm`** — eski foydalanuvchilarda
   `isVerified: false`, ular kirishda bloklanadi. Avval zaxira (`mongodump`)
8. **`node scripts/setWebhook.js`** — secret o'rnatilgandan keyin
9. **Jonli test** — production'da to'liq oqim: register → email → verify →
   savdo → Telegram bot

---

## Ish qoidalari (foydalanuvchi belgilagan)

- **Har bosqich alohida branch va alohida commit.** Katta bosqichni
  mantiqiy bo'laklarga bo'lib commit qilish (masalan 3a/3b/3c).
- **Push faqat feature branch'ga.**
- **`main`ga merge faqat foydalanuvchi aytganda.** O'z tashabbusi bilan
  merge yoki PR ochish yo'q.
- Push oldidan sirlar skani: `.env`, parol, token, vaqtinchalik fayllar
  commit'ga tushmaganini tekshirish (repo **public**).
- Katta ishdan oldin reja berib tasdiq olish.
- Ishlatilgan `.tmp-*` test fayllari commit qilinmaydi — ish tugagach
  o'chiriladi.
- Hisobotlar qisqa va aniq, o'zbek tilida. Bajarilmagan yoki sinalmagan
  narsani aytib o'tish.
