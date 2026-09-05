const { getDb } = require('../../lib/mongodb');
const { getUserFromRequest } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method không được hỗ trợ' });
    return;
  }

  try {
    const { id } = req.query;
    const db = await getDb();
    const doc = await db.collection('van_han').findOne({ id: String(id) });

    if (!doc) {
      res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
      return;
    }

    if (doc.status !== 'approved') {
      const user = getUserFromRequest(req);
      const isOwner = user && doc.submitted_by === user.uid;
      const isAdmin = user && user.role === 'admin';
      if (!isOwner && !isAdmin) {
        res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
        return;
      }
    }

    res.status(200).json({ item: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ, vui lòng thử lại sau.' });
  }
};
