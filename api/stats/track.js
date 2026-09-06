const { getDb } = require('../../lib/mongodb');
const { parseCookies } = require('../../lib/auth');

const VISITOR_COOKIE = 'luanhan_vid';
const VISITOR_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 năm

function makeVisitorId() {
    return `v_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function setVisitorCookie(res, vid) {
    const isProd = process.env.NODE_ENV === 'production';
    const parts = [
        `${VISITOR_COOKIE}=${vid}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${VISITOR_TTL_SECONDS}`,
    ];
    if (isProd) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
}

function todayStr() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (giờ UTC)
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method không được hỗ trợ' });
        return;
    }
    try {
        const cookies = parseCookies(req);
        let vid = cookies[VISITOR_COOKIE];
        let isNewVisitor = false;
        if (!vid) {
            vid = makeVisitorId();
            isNewVisitor = true;
            setVisitorCookie(res, vid);
        }

        const db = await getDb();
        await db.collection('stats').updateOne(
            { _id: 'site_counters' },
            {
                $inc: { total_visits: 1, unique_visitors: isNewVisitor ? 1 : 0 },
                $setOnInsert: { created_at: new Date() },
                $set: { updated_at: new Date() },
            },
            { upsert: true }
        );

        await db.collection('stats_daily').updateOne(
            { date: todayStr() },
            { $inc: { visits: 1, uniques: isNewVisitor ? 1 : 0 } },
            { upsert: true }
        );

        res.status(200).json({ ok: true });
    } catch (err) {
        console.error(err);
        // Lỗi thống kê không nên ảnh hưởng trải nghiệm người dùng
        res.status(200).json({ ok: false });
    }
};