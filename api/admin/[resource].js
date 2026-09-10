const { ObjectId } = require('mongodb');
const { getDb } = require('../../lib/mongodb');
const { requireAdmin } = require('../../lib/auth');
const { generateAiAnalysis } = require('../../lib/aiAgent/pipeline');
const modelRegistry = require('../../lib/aiAgent/modelRegistry');
const keyRotator = require('../../lib/aiAgent/keyRotator');

const VALID_LETTERS = ['A', 'B', 'C', 'D'];

function generateId() {
    return `vh_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function nextQuestionNumber(col) {
    const last = await col
        .find({ question_number: { $ne: null } })
        .sort({ question_number: -1 })
        .limit(1)
        .toArray();
    return last.length ? (last[0].question_number || 0) + 1 : 1;
}

function validateFull(b) {
    const errors = [];
    if (!b.question || !String(b.question).trim()) errors.push('Thiếu nội dung câu hỏi.');
    if (!b.category || !String(b.category).trim()) errors.push('Thiếu chuyên mục.');
    if (!b.answer || !VALID_LETTERS.includes(String(b.answer).toUpperCase())) {
        errors.push('Đáp án phải là A, B, C hoặc D.');
    }
    if (!Array.isArray(b.options) || b.options.length !== 4) {
        errors.push('Cần đúng 4 lựa chọn A, B, C, D.');
    }
    if (!b.birth_info || !b.birth_info.raw) errors.push('Thiếu thông tin ngày sinh.');
    return errors;
}

async function handleComments(req, res, db, admin) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method không được hỗ trợ' });
        return;
    }

    try {
        const col = db.collection('comments');

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const search = req.query.search ? String(req.query.search).trim() : null;

        const filter = {};
        if (search) {
            filter.$or = [
                { content: { $regex: search, $options: 'i' } },
                { author_name: { $regex: search, $options: 'i' } },
            ];
        }

        const total = await col.countDocuments(filter);
        const items = await col
            .aggregate([
                { $match: filter },
                { $sort: { created_at: -1 } },
                { $skip: (page - 1) * limit },
                { $limit: limit },
                {
                    $lookup: {
                        from: 'van_han',
                        localField: 'question_id',
                        foreignField: 'id',
                        as: 'question',
                    },
                },
                { $unwind: { path: '$question', preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        content: 1,
                        author_name: 1,
                        user_id: 1,
                        parent_id: 1,
                        created_at: 1,
                        question_id: 1,
                        'question.question': 1,
                        'question.question_number': 1,
                    },
                },
            ])
            .toArray();

        res.status(200).json({
            items,
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi máy chủ.' });
    }
}

async function handleQuestions(req, res, db, admin) {
    const col = db.collection('van_han');

    if (req.method === 'GET') {
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
            const status = req.query.status ? String(req.query.status) : null;
            const search = req.query.search ? String(req.query.search).trim() : null;

            const filter = {};
            if (status) filter.status = status;
            if (search) {
                filter.$or = [
                    { question: { $regex: search, $options: 'i' } },
                    { id: { $regex: search, $options: 'i' } },
                    { 'author.name': { $regex: search, $options: 'i' } },
                ];
            }

            const total = await col.countDocuments(filter);
            const items = await col
                .find(filter)
                .sort({ created_at: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .toArray();

            res.status(200).json({
                items,
                total,
                page,
                limit,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Lỗi máy chủ.' });
        }
        return;
    }

    if (req.method === 'POST') {
        const errors = validateFull(req.body || {});
        if (errors.length) {
            res.status(400).json({ error: errors.join(' ') });
            return;
        }
        try {
            const b = req.body;
            const qNumber = await nextQuestionNumber(col);
            const doc = {
                id: b.id ? String(b.id) : generateId(),
                question_number: qNumber,
                original_number: b.original_number ?? qNumber,
                case_id: b.case_id ? String(b.case_id) : `case_admin_${qNumber}`,
                birth_info: b.birth_info,
                question: String(b.question).trim(),
                options: b.options.map((o) => ({
                    letter: String(o.letter).toUpperCase(),
                    text: String(o.text).trim(),
                })),
                answer: String(b.answer).toUpperCase(),
                category: String(b.category).trim(),
                has_answer: true,
                status: 'approved',
                author: { user_id: null, name: b.author_name ? String(b.author_name) : 'Quản trị viên' },
                submitted_by: null,
                created_at: new Date(),
                updated_at: new Date(),
                reviewed_by: admin.username,
                reviewed_at: new Date(),
            };
            await col.insertOne(doc);
            res.status(201).json({ item: doc });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Lỗi máy chủ.' });
        }
        return;
    }

    if (req.method === 'PUT') {
        try {
            const { id, ...fields } = req.body || {};
            if (!id) {
                res.status(400).json({ error: 'Thiếu id câu hỏi cần sửa.' });
                return;
            }
            const existing = await col.findOne({ id: String(id) });
            if (!existing) {
                res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
                return;
            }

            const update = { updated_at: new Date() };
            const allowed = [
                'question',
                'options',
                'answer',
                'category',
                'birth_info',
                'status',
                'case_id',
            ];
            for (const key of allowed) {
                if (fields[key] !== undefined) update[key] = fields[key];
            }
            if (update.answer) update.answer = String(update.answer).toUpperCase();
            if (update.options) {
                update.options = update.options.map((o) => ({
                    letter: String(o.letter).toUpperCase(),
                    text: String(o.text).trim(),
                }));
            }

            if (update.status === 'approved' && !existing.question_number) {
                update.question_number = await nextQuestionNumber(col);
                update.original_number = existing.original_number ?? update.question_number;
            }
            if (update.status && update.status !== existing.status) {
                update.reviewed_by = admin.username;
                update.reviewed_at = new Date();
            }

            await col.updateOne({ id: String(id) }, { $set: update });
            const updated = await col.findOne({ id: String(id) });
            res.status(200).json({ item: updated });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Lỗi máy chủ.' });
        }
        return;
    }

    if (req.method === 'DELETE') {
        try {
            const id = req.query.id;
            if (!id) {
                res.status(400).json({ error: 'Thiếu id câu hỏi cần xoá.' });
                return;
            }
            const result = await col.deleteOne({ id: String(id) });
            if (!result.deletedCount) {
                res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
                return;
            }
            await db.collection('comments').deleteMany({ question_id: String(id) });
            res.status(200).json({ ok: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Lỗi máy chủ.' });
        }
        return;
    }

    res.status(405).json({ error: 'Method không được hỗ trợ' });
}

async function handleStats(req, res, db, admin) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method không được hỗ trợ' });
        return;
    }

    try {
        const [
            siteCounters,
            dailyRaw,
            totalUsers,
            bannedUsers,
            pendingCount,
            approvedCount,
            rejectedCount,
            commentsCount,
            categoryAgg,
        ] = await Promise.all([
            db.collection('stats').findOne({ _id: 'site_counters' }),
            db.collection('stats_daily').find().sort({ date: -1 }).limit(14).toArray(),
            db.collection('users').countDocuments({}),
            db.collection('users').countDocuments({ banned: true }),
            db.collection('van_han').countDocuments({ status: 'pending' }),
            db.collection('van_han').countDocuments({ status: 'approved' }),
            db.collection('van_han').countDocuments({ status: 'rejected' }),
            db.collection('comments').countDocuments({}),
            db
                .collection('van_han')
                .aggregate([
                    { $match: { status: 'approved' } },
                    { $group: { _id: '$category', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                ])
                .toArray(),
        ]);

        const daily = dailyRaw
            .slice()
            .reverse()
            .map((d) => ({ date: d.date, visits: d.visits || 0, uniques: d.uniques || 0 }));

        res.status(200).json({
            site: {
                total_visits: (siteCounters && siteCounters.total_visits) || 0,
                unique_visitors: (siteCounters && siteCounters.unique_visitors) || 0,
            },
            daily,
            users: { total: totalUsers, banned: bannedUsers },
            questions: {
                pending: pendingCount,
                approved: approvedCount,
                rejected: rejectedCount,
                total: pendingCount + approvedCount + rejectedCount,
            },
            comments_count: commentsCount,
            categories: categoryAgg.map((c) => ({ category: c._id || '(không tên)', count: c.count })),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi máy chủ.' });
    }
}

async function handleUsers(req, res, db, admin) {
    const users = db.collection('users');

    if (req.method === 'GET') {
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
            const search = req.query.search ? String(req.query.search).trim() : null;

            const filter = {};
            if (search) {
                filter.$or = [
                    { username: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { display_name: { $regex: search, $options: 'i' } },
                ];
            }

            const total = await users.countDocuments(filter);
            const items = await users
                .find(filter, { projection: { password_hash: 0 } })
                .sort({ created_at: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .toArray();

            res.status(200).json({
                items,
                total,
                page,
                limit,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Lỗi máy chủ.' });
        }
        return;
    }

    if (req.method === 'PUT') {
        try {
            const { id, banned, reason } = req.body || {};
            if (!id || !ObjectId.isValid(id)) {
                res.status(400).json({ error: 'id người dùng không hợp lệ.' });
                return;
            }
            if (typeof banned !== 'boolean') {
                res.status(400).json({ error: 'Thiếu trạng thái banned (true/false).' });
                return;
            }

            const target = await users.findOne({ _id: new ObjectId(id) });
            if (!target) {
                res.status(404).json({ error: 'Không tìm thấy người dùng.' });
                return;
            }
            if (String(target._id) === admin.uid) {
                res.status(400).json({ error: 'Không thể tự khoá tài khoản của chính mình.' });
                return;
            }
            if (target.role === 'admin' && banned) {
                res.status(400).json({ error: 'Không thể khoá tài khoản quản trị viên khác.' });
                return;
            }

            const update = {
                banned,
                banned_reason: banned ? (reason ? String(reason).trim() : null) : null,
                banned_at: banned ? new Date() : null,
                banned_by: banned ? admin.username : null,
            };
            await users.updateOne({ _id: new ObjectId(id) }, { $set: update });
            const updated = await users.findOne(
                { _id: new ObjectId(id) },
                { projection: { password_hash: 0 } }
            );
            res.status(200).json({ item: updated });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Lỗi máy chủ.' });
        }
        return;
    }

    res.status(405).json({ error: 'Method không được hỗ trợ' });
}

// resource=agent — mọi thao tác quản trị của tính năng AI Agent luận giải Bát Tự,
// gộp chung vào đây (dựa theo query "action") để không phát sinh thêm function nào.
async function handleAgent(req, res, db, admin) {
    const { action, id } = req.query || {};

    if (action === 'settings') {
        if (req.method === 'GET') {
            const settings = await modelRegistry.getSettings(db);
            res.status(200).json({ settings, availableModels: modelRegistry.AVAILABLE_MODELS });
            return;
        }
        if (req.method === 'PUT') {
            const { modelExtract, modelExplain, modelEmbedding } = req.body || {};
            const settings = await modelRegistry.updateSettings(db, {
                modelExtract, modelExplain, modelEmbedding, updatedBy: admin.username,
            });
            res.status(200).json({ settings });
            return;
        }
        res.status(405).json({ error: 'Method không được hỗ trợ' });
        return;
    }

    if (action === 'key-usage') {
        if (req.method !== 'GET') {
            res.status(405).json({ error: 'Method không được hỗ trợ' });
            return;
        }
        const stats = await keyRotator.getUsageStats(db);
        res.status(200).json(stats);
        return;
    }

    if (action === 'regenerate') {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method không được hỗ trợ' });
            return;
        }
        if (!id) {
            res.status(400).json({ error: 'Thiếu id câu hỏi cần tính lại.' });
            return;
        }
        try {
            const caseDoc = await db.collection('van_han').findOne({ id: String(id) });
            if (!caseDoc) {
                res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
                return;
            }
            const { modelExtract, modelExplain, modelEmbedding } = req.body || {};
            const result = await generateAiAnalysis(db, caseDoc, {
                forceRegenerate: true,
                modelOverrides: { extract: modelExtract, explain: modelExplain, embedding: modelEmbedding },
            });
            res.status(200).json(result);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message || 'Lỗi máy chủ.' });
        }
        return;
    }

    if (action === 'case') {
        if (req.method !== 'PUT') {
            res.status(405).json({ error: 'Method không được hỗ trợ' });
            return;
        }
        if (!id) {
            res.status(400).json({ error: 'Thiếu id câu hỏi cần sửa.' });
            return;
        }
        try {
            const { ai_bazi, ai_explanation } = req.body || {};
            const update = { updated_at: new Date(), 'ai_meta.editedByAdmin': true };
            if (ai_bazi !== undefined) update.ai_bazi = ai_bazi;
            if (ai_explanation !== undefined) update.ai_explanation = ai_explanation;

            const col = db.collection('van_han');
            const existing = await col.findOne({ id: String(id) });
            if (!existing) {
                res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
                return;
            }
            await col.updateOne({ id: String(id) }, { $set: update });
            const updated = await col.findOne({ id: String(id) });
            res.status(200).json({ item: updated });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message || 'Lỗi máy chủ.' });
        }
        return;
    }

    res.status(404).json({ error: 'Không tìm thấy hành động (action) cho resource agent.' });
}

module.exports = async (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    const { resource } = req.query || {};
    const db = await getDb();

    switch (resource) {
        case 'comments':
            return handleComments(req, res, db, admin);
        case 'questions':
            return handleQuestions(req, res, db, admin);
        case 'stats':
            return handleStats(req, res, db, admin);
        case 'users':
            return handleUsers(req, res, db, admin);
        case 'agent':
            return handleAgent(req, res, db, admin);
        default:
            res.status(404).json({ error: 'Không tìm thấy endpoint.' });
    }
};