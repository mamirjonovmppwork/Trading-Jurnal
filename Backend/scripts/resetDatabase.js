// ==========================================================================
// BAZANI TOZALASH SKRIPTI — users va trades kolleksiyalarini O'CHIRADI.
//
// ⚠️  BU AMAL QAYTARILMAYDI. Avval zaxira oling:
//        mongodump --uri="<MONGO_URI>" --out=./backup
//
// Ishga tushirish (--confirm BO'LMASA hech narsa qilmaydi):
//        node scripts/resetDatabase.js --confirm
//
// Faqat tanlangan kolleksiyani tozalash:
//        node scripts/resetDatabase.js --confirm --only=trades
// ==========================================================================

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/user');
const Trade = require('../models/trade');

const COLLECTIONS = {
    users: User,
    trades: Trade,
};

function parseArgs(argv) {
    const confirmed = argv.includes('--confirm');
    const onlyArg = argv.find(a => a.startsWith('--only='));
    const only = onlyArg ? onlyArg.split('=')[1] : null;
    return { confirmed, only };
}

async function main() {
    const { confirmed, only } = parseArgs(process.argv.slice(2));

    if (!confirmed) {
        console.log('');
        console.log('='.repeat(64));
        console.log('  BAZA TOZALASH SKRIPTI — HOZIR HECH NARSA O\'CHIRILMADI');
        console.log('='.repeat(64));
        console.log('');
        console.log('  Bu skript quyidagi kolleksiyalarni butunlay bo\'shatadi:');
        console.log('    - users   (barcha foydalanuvchilar)');
        console.log('    - trades  (barcha savdolar)');
        console.log('');
        console.log('  Amal QAYTARILMAYDI. Avval zaxira oling:');
        console.log('    mongodump --uri="<MONGO_URI>" --out=./backup');
        console.log('');
        console.log('  Davom etish uchun --confirm flagini qo\'shing:');
        console.log('    node scripts/resetDatabase.js --confirm');
        console.log('');
        process.exit(1);
    }

    if (only && !COLLECTIONS[only]) {
        console.error(`Noto'g'ri --only qiymati: "${only}". Ruxsat etilgan: ${Object.keys(COLLECTIONS).join(', ')}`);
        process.exit(1);
    }

    if (!process.env.MONGO_URI) {
        console.error('MONGO_URI .env faylida topilmadi!');
        process.exit(1);
    }

    const targets = only ? [only] : Object.keys(COLLECTIONS);

    try {
        console.log('MongoDB ga ulanmoqda...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`Ulandi: ${mongoose.connection.name}\n`);

        // Avval nima o'chirilayotganini ko'rsatamiz
        for (const name of targets) {
            const count = await COLLECTIONS[name].countDocuments();
            console.log(`  ${name.padEnd(8)} — ${count} ta hujjat topildi`);
        }
        console.log('');

        for (const name of targets) {
            const result = await COLLECTIONS[name].deleteMany({});
            console.log(`  ${name.padEnd(8)} — ${result.deletedCount} ta hujjat o'chirildi`);
        }

        console.log('\nTozalash yakunlandi.');
    } catch (err) {
        console.error('\nXatolik:', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log('Ulanish yopildi.');
    }
}

main();
