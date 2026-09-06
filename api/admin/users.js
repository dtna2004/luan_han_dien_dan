const { ObjectId } = require('mongodb');
const { getDb } = require('../../lib/mongodb');
const { requireAdmin } = require('../../lib/auth');

module.exports = async (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    const db = await getDb();
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
};