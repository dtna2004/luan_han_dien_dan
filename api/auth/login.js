const { getDb } = require('../../lib/mongodb');
const { verifyPassword, signToken, setAuthCookie, getAdminEmails } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method không được hỗ trợ' });
    return;
  }

  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập/email và mật khẩu.' });
      return;
    }

    const clean = String(identifier).trim().toLowerCase();
    const db = await getDb();
    const users = db.collection('users');

    const user = await users.findOne({ $or: [{ email: clean }, { username: clean }] });
    if (!user) {
      res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không đúng.' });
      return;
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không đúng.' });
      return;
    }

    // Nếu email nằm trong danh sách admin mà tài khoản chưa có quyền admin thì nâng cấp
    if (user.role !== 'admin' && getAdminEmails().includes(user.email)) {
      await users.updateOne({ _id: user._id }, { $set: { role: 'admin' } });
      user.role = 'admin';
    }

    const token = signToken(user);
    setAuthCookie(res, token);

    res.status(200).json({
      user: {
        username: user.username,
        display_name: user.display_name || user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ, vui lòng thử lại sau.' });
  }
};
