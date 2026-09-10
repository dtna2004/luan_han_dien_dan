/**
 * keyRotator.js
 * Xoay vòng nhiều API key Gemini để chia đều số lần gọi.
 * .env: API_GEMINI_KEY=apikey1,apikey2,apikey3
 *
 * Vì Vercel serverless function không giữ state giữa các lần cold start,
 * con trỏ round-robin được lưu trong MongoDB (atomic $inc) để xoay đều
 * thật sự qua nhiều lần gọi / nhiều instance chạy song song.
 */

function getKeyList() {
    const raw = process.env.API_GEMINI_KEY || '';
    const keys = raw.split(',').map((k) => k.trim()).filter(Boolean);
    if (keys.length === 0) {
        throw new Error('Chưa cấu hình API_GEMINI_KEY trong .env (dạng key1,key2,key3)');
    }
    return keys;
}

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<{ key: string, index: number, total: number }>}
 */
async function getNextKey(db) {
    const keys = getKeyList();
    const col = db.collection('api_key_state');
    const doc = await col.findOneAndUpdate(
        { _id: 'gemini' },
        { $inc: { lastIndex: 1 }, $set: { updatedAt: new Date() } },
        { upsert: true, returnDocument: 'after' },
    );
    const idx = ((doc.value && doc.value.lastIndex) || 0) % keys.length;
    return { key: keys[idx], index: idx, total: keys.length };
}

/** Thống kê nhanh cho admin xem key đang xoay đến đâu */
async function getUsageStats(db) {
    const keys = getKeyList();
    const doc = await db.collection('api_key_state').findOne({ _id: 'gemini' });
    return {
        totalKeys: keys.length,
        lastIndex: doc ? doc.lastIndex % keys.length : null,
        totalCallsSoFar: doc ? doc.lastIndex : 0,
        updatedAt: doc ? doc.updatedAt : null,
    };
}

module.exports = { getKeyList, getNextKey, getUsageStats };