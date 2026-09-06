const { ObjectId } = require('mongodb');
const { getDb } = require('../../lib/mongodb');
const { getUserFromRequest, clearAuthCookie } = require('../../lib/auth');

module.exports = async (req, res) => {
  const payload = getUserFromRequest(req);
  if (!payload) {
    res.status(200).json({ user: null });
    return;
  }

  try {
    if (!ObjectId.isValid(payload.uid)) {
      clearAuthCookie(res);
      res.status(200).json({ user: null });
      return;
    }
    const db = await getDb();
    const dbUser = await db.collection('users').findOne({ _id: new ObjectId(payload.uid) });

    if (!dbUser || dbUser.banned) {
      clearAuthCookie(res);
      res.status(200).json({ user: null, banned: !!(dbUser && dbUser.banned) });
      return;
    }

    res.status(200).json({
      user: {
        username: dbUser.username,
        display_name: dbUser.display_name || dbUser.username,
        role: dbUser.role,
      },
    });
  } catch (err) {
    console.error(err);
    // Nếu DB tạm lỗi, vẫn cho dùng thông tin trong token để tránh văng người dùng ra ngoài
    res.status(200).json({
      user: { username: payload.username, display_name: payload.display_name || payload.username, role: payload.role },
    });
  }
};