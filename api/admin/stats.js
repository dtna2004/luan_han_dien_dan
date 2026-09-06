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
};