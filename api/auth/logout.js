const { clearAuthCookie } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method không được hỗ trợ' });
    return;
  }
  clearAuthCookie(res);
  res.status(200).json({ ok: true });
};
