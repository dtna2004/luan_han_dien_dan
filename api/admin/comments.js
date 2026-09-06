const { getDb } = require('../../lib/mongodb');
const { requireAdmin } = require('../../lib/auth');

module.exports = async (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method không được hỗ trợ' });
        return;
    }

    try {
        const db = await getDb();
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
};