const { getDb } = require('../../lib/mongodb');
const { hashPassword, signToken, setAuthCookie, getAdminEmails } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method không được hỗ trợ' });
    return;
  }

  try {
    const { username, email, password, display_name } = req.body || {};

    if (!username || !email || !password) {
      res.status(400).json({ error: 'Vui lòng nhập đầy đủ tên đăng nhập, email và mật khẩu.' });
      return;
    }
    if (String(password).length < 6) {
      res.status(400).json({ error: 'Mật khẩu cần tối thiểu 6 ký tự.' });
      return;
    }
    const cleanUsername = String(username).trim().toLowerCase();
    const cleanEmail = String(email).trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,30}$/.test(cleanUsername)) {
      res.status(400).json({
        error: 'Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm/gạch dưới, từ 3-30 ký tự.',
      });
      return;
    }

    const db = await getDb();
    const users = db.collection('users');

    const existing = await users.findOne({
      $or: [{ email: cleanEmail }, { username: cleanUsername }],
    });
    if (existing) {
      res.status(409).json({ error: 'Email hoặc tên đăng nhập đã được sử dụng.' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const isAdmin = getAdminEmails().includes(cleanEmail);

    const doc = {
      username: cleanUsername,
      display_name: (display_name && String(display_name).trim()) || cleanUsername,
      email: cleanEmail,
      password_hash: passwordHash,
      role: isAdmin ? 'admin' : 'user',
      created_at: new Date(),
    };

    const result = await users.insertOne(doc);
    const user = { ...doc, _id: result.insertedId };

    const token = signToken(user);
    setAuthCookie(res, token);

    res.status(201).json({
      user: {
        username: user.username,
        display_name: user.display_name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ, vui lòng thử lại sau.' });
  }
};
