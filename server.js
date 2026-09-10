/**
 * server.js
 * MỘT function Vercel duy nhất cho toàn bộ API của tính năng AI Agent luận giải Bát Tự
 * (và có thể gộp thêm các route cũ của bạn vào đây nếu cũng đang tốn nhiều function).
 *
 * vercel.json cần rewrite mọi "/api/*" về file này, xem ví dụ ở cuối file.
 */

const express = require('express');
const { MongoClient } = require('mongodb');

const pipeline = require('./lib/aiAgent/pipeline');
const modelRegistry = require('./lib/aiAgent/modelRegistry');
const keyRotator = require('./lib/aiAgent/keyRotator');

const app = express();
app.use(express.json());

// --- Kết nối Mongo, tái sử dụng client giữa các lần gọi (warm start) ---
let cachedClient = null;
async function getDb() {
    if (cachedClient && cachedClient.topology && cachedClient.topology.isConnected()) {
        return cachedClient.db(); // dùng db mặc định trong connection string
    }
    cachedClient = new MongoClient(process.env.MONGODB_URI);
    await cachedClient.connect();
    return cachedClient.db();
}

function asyncHandler(fn) {
    return (req, res, next) => fn(req, res, next).catch(next);
}

// ================= ROUTES CHO NGƯỜI DÙNG (cau-hoi.html) =================

// Lấy (hoặc tạo mới nếu chưa có) phần luận giải AI cho 1 case khi bấm "Xem đáp án"
app.get('/api/agent/case/:id', asyncHandler(async (req, res) => {
    const db = await getDb();
    const caseDoc = await db.collection('cases').findOne({ id: req.params.id });
    if (!caseDoc) return res.status(404).json({ error: 'Không tìm thấy case' });

    const result = await pipeline.generateAiAnalysis(db, caseDoc);
    res.json({
        id: caseDoc.id,
        answer: caseDoc.answer,
        ...result,
    });
}));

// ================= ROUTES CHO ADMIN (admin_van_han.html) =================

// Ép tính lại (khi admin muốn regenerate, có thể chỉ định model khác)
app.post('/api/admin/agent/case/:id/regenerate', asyncHandler(async (req, res) => {
    const db = await getDb();
    const caseDoc = await db.collection('cases').findOne({ id: req.params.id });
    if (!caseDoc) return res.status(404).json({ error: 'Không tìm thấy case' });

    const { modelExtract, modelExplain, modelEmbedding } = req.body || {};
    const result = await pipeline.generateAiAnalysis(db, caseDoc, {
        forceRegenerate: true,
        modelOverrides: { extract: modelExtract, explain: modelExplain, embedding: modelEmbedding },
    });
    res.json(result);
}));

// Admin sửa tay phần bát tự / luận giải
app.put('/api/admin/agent/case/:id', asyncHandler(async (req, res) => {
    const db = await getDb();
    const { ai_bazi, ai_explanation } = req.body || {};
    const update = { updated_at: new Date(), 'ai_meta.editedByAdmin': true };
    if (ai_bazi !== undefined) update.ai_bazi = ai_bazi;
    if (ai_explanation !== undefined) update.ai_explanation = ai_explanation;

    const result = await db.collection('cases').findOneAndUpdate(
        { id: req.params.id },
        { $set: update },
        { returnDocument: 'after' },
    );
    if (!result.value) return res.status(404).json({ error: 'Không tìm thấy case' });
    res.json(result.value);
}));

// Cấu hình model — xem
app.get('/api/admin/agent/settings', asyncHandler(async (req, res) => {
    const db = await getDb();
    const settings = await modelRegistry.getSettings(db);
    res.json({ settings, availableModels: modelRegistry.AVAILABLE_MODELS });
}));

// Cấu hình model — sửa (admin chọn model mặc định cho từng bước)
app.put('/api/admin/agent/settings', asyncHandler(async (req, res) => {
    const db = await getDb();
    const { modelExtract, modelExplain, modelEmbedding, updatedBy } = req.body || {};
    const settings = await modelRegistry.updateSettings(db, {
        modelExtract, modelExplain, modelEmbedding, updatedBy,
    });
    res.json(settings);
}));

// Thống kê xoay vòng API key (để kiểm tra key có bị lệch tải không)
app.get('/api/admin/agent/key-usage', asyncHandler(async (req, res) => {
    const db = await getDb();
    const stats = await keyRotator.getUsageStats(db);
    res.json(stats);
}));

// ================= error handler =================
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Lỗi máy chủ' });
});

// Export thẳng app cho Vercel (Vercel tự wrap Express app thành handler)
module.exports = app;

/*
=== vercel.json (đặt ở gốc repo) ===
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/index.js" }
  ]
}

=== Cấu trúc file cần đặt ===
/api/index.js        -> chỉ 1 dòng: module.exports = require('../server');
/server.js            -> file này
/lib/aiAgent/*.js      -> các module ở trên

=== .env ===
MONGODB_URI=mongodb+srv://...
API_GEMINI_KEY=key1,key2,key3
*/