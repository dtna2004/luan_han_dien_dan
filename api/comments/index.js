const { ObjectId } = require('mongodb');
const { getDb } = require('../../lib/mongodb');
const { getUserFromRequest } = require('../../lib/auth');

module.exports = async (req, res) => {
  const db = await getDb();
  const col = db.collection('comments');

  if (req.method === 'GET') {
    try {
      const questionId = req.query.question_id;
      if (!questionId) {
        res.status(400).json({ error: 'Thiếu question_id.' });
        return;
      }
      const items = await col
        .find({ question_id: String(questionId) })
        .sort({ created_at: 1 })
        .toArray();
      res.status(200).json({ items });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi máy chủ.' });
    }
    return;
  }

  if (req.method === 'POST') {
    const user = getUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Bạn cần đăng nhập để bình luận.' });
      return;
    }
    try {
      const { question_id, content, parent_id } = req.body || {};
      if (!question_id || !content || !String(content).trim()) {
        res.status(400).json({ error: 'Thiếu nội dung bình luận.' });
        return;
      }

      const question = await db.collection('van_han').findOne({ id: String(question_id) });
      if (!question) {
        res.status(404).json({ error: 'Câu hỏi không tồn tại.' });
        return;
      }

      let parentObjectId = null;
      if (parent_id) {
        if (!ObjectId.isValid(parent_id)) {
          res.status(400).json({ error: 'parent_id không hợp lệ.' });
          return;
        }
        const parent = await col.findOne({ _id: new ObjectId(parent_id) });
        if (!parent || parent.question_id !== String(question_id)) {
          res.status(400).json({ error: 'Không tìm thấy bình luận cha.' });
          return;
        }
        parentObjectId = parent._id;
      }

      const doc = {
        question_id: String(question_id),
        user_id: user.uid,
        author_name: user.username,
        content: String(content).trim().slice(0, 2000),
        parent_id: parentObjectId,
        created_at: new Date(),
      };
      const result = await col.insertOne(doc);
      res.status(201).json({ item: { ...doc, _id: result.insertedId } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi máy chủ.' });
    }
    return;
  }

  if (req.method === 'DELETE') {
    const user = getUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Bạn cần đăng nhập.' });
      return;
    }
    try {
      const id = req.query.id;
      if (!id || !ObjectId.isValid(id)) {
        res.status(400).json({ error: 'id không hợp lệ.' });
        return;
      }
      const comment = await col.findOne({ _id: new ObjectId(id) });
      if (!comment) {
        res.status(404).json({ error: 'Không tìm thấy bình luận.' });
        return;
      }
      if (comment.user_id !== user.uid && user.role !== 'admin') {
        res.status(403).json({ error: 'Bạn không có quyền xoá bình luận này.' });
        return;
      }
      await col.deleteOne({ _id: new ObjectId(id) });
      // Xoá luôn các trả lời trực tiếp của bình luận này (1 cấp) để tránh mồ côi
      await col.deleteMany({ parent_id: new ObjectId(id) });
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi máy chủ.' });
    }
    return;
  }

  res.status(405).json({ error: 'Method không được hỗ trợ' });
};
