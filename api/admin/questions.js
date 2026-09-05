const { getDb } = require('../../lib/mongodb');
const { requireAdmin } = require('../../lib/auth');

const VALID_LETTERS = ['A', 'B', 'C', 'D'];

function generateId() {
  return `vh_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function nextQuestionNumber(col) {
  const last = await col
    .find({ question_number: { $ne: null } })
    .sort({ question_number: -1 })
    .limit(1)
    .toArray();
  return last.length ? (last[0].question_number || 0) + 1 : 1;
}

function validateFull(b) {
  const errors = [];
  if (!b.question || !String(b.question).trim()) errors.push('Thiếu nội dung câu hỏi.');
  if (!b.category || !String(b.category).trim()) errors.push('Thiếu chuyên mục.');
  if (!b.answer || !VALID_LETTERS.includes(String(b.answer).toUpperCase())) {
    errors.push('Đáp án phải là A, B, C hoặc D.');
  }
  if (!Array.isArray(b.options) || b.options.length !== 4) {
    errors.push('Cần đúng 4 lựa chọn A, B, C, D.');
  }
  if (!b.birth_info || !b.birth_info.raw) errors.push('Thiếu thông tin ngày sinh.');
  return errors;
}

module.exports = async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const db = await getDb();
  const col = db.collection('van_han');

  if (req.method === 'GET') {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const status = req.query.status ? String(req.query.status) : null;
      const search = req.query.search ? String(req.query.search).trim() : null;

      const filter = {};
      if (status) filter.status = status;
      if (search) {
        filter.$or = [
          { question: { $regex: search, $options: 'i' } },
          { id: { $regex: search, $options: 'i' } },
          { 'author.name': { $regex: search, $options: 'i' } },
        ];
      }

      const total = await col.countDocuments(filter);
      const items = await col
        .find(filter)
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

  if (req.method === 'POST') {
    // Admin tạo trực tiếp một câu hỏi mới, duyệt luôn
    const errors = validateFull(req.body || {});
    if (errors.length) {
      res.status(400).json({ error: errors.join(' ') });
      return;
    }
    try {
      const b = req.body;
      const qNumber = await nextQuestionNumber(col);
      const doc = {
        id: b.id ? String(b.id) : generateId(),
        question_number: qNumber,
        original_number: b.original_number ?? qNumber,
        case_id: b.case_id ? String(b.case_id) : `case_admin_${qNumber}`,
        birth_info: b.birth_info,
        question: String(b.question).trim(),
        options: b.options.map((o) => ({
          letter: String(o.letter).toUpperCase(),
          text: String(o.text).trim(),
        })),
        answer: String(b.answer).toUpperCase(),
        category: String(b.category).trim(),
        has_answer: true,
        status: 'approved',
        author: { user_id: null, name: b.author_name ? String(b.author_name) : 'Quản trị viên' },
        submitted_by: null,
        created_at: new Date(),
        updated_at: new Date(),
        reviewed_by: admin.username,
        reviewed_at: new Date(),
      };
      await col.insertOne(doc);
      res.status(201).json({ item: doc });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi máy chủ.' });
    }
    return;
  }

  if (req.method === 'PUT') {
    // Sửa câu hỏi bất kỳ, hoặc duyệt (status: pending -> approved) / từ chối (-> rejected)
    try {
      const { id, ...fields } = req.body || {};
      if (!id) {
        res.status(400).json({ error: 'Thiếu id câu hỏi cần sửa.' });
        return;
      }
      const existing = await col.findOne({ id: String(id) });
      if (!existing) {
        res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
        return;
      }

      const update = { updated_at: new Date() };
      const allowed = [
        'question',
        'options',
        'answer',
        'category',
        'birth_info',
        'status',
        'case_id',
      ];
      for (const key of allowed) {
        if (fields[key] !== undefined) update[key] = fields[key];
      }
      if (update.answer) update.answer = String(update.answer).toUpperCase();
      if (update.options) {
        update.options = update.options.map((o) => ({
          letter: String(o.letter).toUpperCase(),
          text: String(o.text).trim(),
        }));
      }

      // Nếu chuyển từ pending sang approved và chưa có số thứ tự thì cấp số mới
      if (update.status === 'approved' && !existing.question_number) {
        update.question_number = await nextQuestionNumber(col);
        update.original_number = existing.original_number ?? update.question_number;
      }
      if (update.status && update.status !== existing.status) {
        update.reviewed_by = admin.username;
        update.reviewed_at = new Date();
      }

      await col.updateOne({ id: String(id) }, { $set: update });
      const updated = await col.findOne({ id: String(id) });
      res.status(200).json({ item: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi máy chủ.' });
    }
    return;
  }

  if (req.method === 'DELETE') {
    try {
      const id = req.query.id;
      if (!id) {
        res.status(400).json({ error: 'Thiếu id câu hỏi cần xoá.' });
        return;
      }
      const result = await col.deleteOne({ id: String(id) });
      if (!result.deletedCount) {
        res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
        return;
      }
      await db.collection('comments').deleteMany({ question_id: String(id) });
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi máy chủ.' });
    }
    return;
  }

  res.status(405).json({ error: 'Method không được hỗ trợ' });
};
