const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-khong-an-toan-doi-truoc-khi-deploy';
const COOKIE_NAME = 'luanhan_token';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 ngày

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(user) {
  return jwt.sign(
    {
      uid: String(user._id),
      username: user.username,
      display_name: user.display_name || user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL_SECONDS }
  );
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = decodeURIComponent(pair.slice(idx + 1).trim());
    out[key] = val;
  });
  return out;
}

function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${TOKEN_TTL_SECONDS}`,
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearAuthCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

function getUserFromRequest(req) {
  try {
    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];
    if (!token) return null;
    const payload = jwt.verify(token, JWT_SECRET);
    return payload; // { uid, username, role }
  } catch (err) {
    return null;
  }
}

function requireAuth(req, res) {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Bạn cần đăng nhập để thực hiện thao tác này.' });
    return null;
  }
  return user;
}

function requireAdmin(req, res) {
  const user = getUserFromRequest(req);
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Chỉ quản trị viên mới có quyền thực hiện thao tác này.' });
    return null;
  }
  return user;
}

// Kiểm tra người dùng còn hợp lệ (đã đăng nhập + chưa bị khoá) bằng cách tra
// thẳng vào DB - dùng cho các hành động ghi dữ liệu (đăng câu hỏi, bình luận)
// để một tài khoản vừa bị admin ban sẽ không thể tiếp tục thao tác dù token
// (cookie) vẫn còn hạn.
async function requireActiveUser(req, res, db) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    res.status(401).json({ error: 'Bạn cần đăng nhập để thực hiện thao tác này.' });
    return null;
  }
  if (!ObjectId.isValid(payload.uid)) {
    res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.' });
    return null;
  }
  const dbUser = await db.collection('users').findOne({ _id: new ObjectId(payload.uid) });
  if (!dbUser) {
    res.status(401).json({ error: 'Tài khoản không tồn tại, vui lòng đăng nhập lại.' });
    return null;
  }
  if (dbUser.banned) {
    res.status(403).json({ error: 'Tài khoản của bạn đã bị khoá, không thể thực hiện thao tác này.' });
    return null;
  }
  return {
    uid: String(dbUser._id),
    username: dbUser.username,
    display_name: dbUser.display_name || dbUser.username,
    role: dbUser.role,
  };
}

module.exports = {
  getAdminEmails,
  hashPassword,
  verifyPassword,
  signToken,
  parseCookies,
  setAuthCookie,
  clearAuthCookie,
  getUserFromRequest,
  requireAuth,
  requireAdmin,
  requireActiveUser,
};