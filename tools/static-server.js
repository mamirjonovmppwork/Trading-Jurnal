// ==========================================================================
// LOKAL STATIK SERVER (faqat ishlab chiqish uchun)
//
//   node tools/static-server.js Frontend 5501
//
// Nega kerak: `python -m http.server` hech qanday Cache-Control yubormaydi,
// shuning uchun brauzer HTML/JS/CSS ni evristik keshlaydi va faylni
// o'zgartirgandan keyin ham eski versiyani ko'rsatib turadi. Bu ishlab
// chiqishda juda chalg'ituvchi.
//
// Bu server har bir javobga `Cache-Control: no-store` qo'yadi — har safar
// yangi fayl keladi. Production'ga aloqasi yo'q (frontend Netlify/Vercel'da).
// ==========================================================================

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(process.argv[2] || 'Frontend');
const PORT = Number(process.argv[3] || 5501);

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'text/javascript; charset=utf-8',
    '.mjs':  'text/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg':  'image/svg+xml',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico':  'image/x-icon',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.txt':  'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
    // Query va hash'ni tashlab, faqat yo'lni olamiz
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
    if (urlPath.endsWith('/')) urlPath += 'index.html';

    // 🔒 Papkadan chiqib ketishni (../) to'sish
    const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403).end('Taqiqlangan');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Topilmadi: ' + urlPath);
            return;
        }
        res.writeHead(200, {
            'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
            // ❗ Asosiy maqsad — brauzer keshini butunlay o'chirish
            'Cache-Control': 'no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`Statik server: http://localhost:${PORT}  (papka: ${ROOT})`);
    console.log('Cache-Control: no-store — fayl o\'zgarishi darhol ko\'rinadi');
});
