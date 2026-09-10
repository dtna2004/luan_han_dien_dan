const { getDb } = require('../../lib/mongodb');
const { getUserFromRequest } = require('../../lib/auth');
const { generateAiAnalysis } = require('../../lib/aiAgent/pipeline');

// Đây là function serverless MỚI DUY NHẤT được thêm cho tính năng AI Agent.
// Toàn bộ phần quản trị (cấu hình model, xem/sửa/regenerate) được gộp chung
// vào api/admin/[resource].js đã có sẵn (resource=agent) để không phát sinh
// thêm function nào nữa.
module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method không được hỗ trợ' });
        return;
    }

    try {
        const { id } = req.query;
        const db = await getDb();
        const caseDoc = await db.collection('van_han').findOne({ id: String(id) });

        if (!caseDoc) {
            res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
            return;
        }

        // Cùng quy tắc hiển thị như /api/questions/[id]: câu hỏi chưa duyệt chỉ chủ bài/admin xem được
        if (caseDoc.status !== 'approved') {
            const user = getUserFromRequest(req);
            const isOwner = user && caseDoc.submitted_by === user.uid;
            const isAdmin = user && user.role === 'admin';
            if (!isOwner && !isAdmin) {
                res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
                return;
            }
        }

        const result = await generateAiAnalysis(db, caseDoc);
        console.log(`[agent] id=${caseDoc.id} fromCache=${result.fromCache}`);
        res.status(200).json({
            id: caseDoc.id,
            answer: caseDoc.answer,
            ...result,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || 'Lỗi máy chủ, vui lòng thử lại sau.' });
    }
};