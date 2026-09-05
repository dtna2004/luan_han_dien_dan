const { getDb } = require('../../lib/mongodb');
const { getUserFromRequest } = require('../../lib/auth');

const VALID_LETTERS = ['A', 'B', 'C', 'D'];

function validateSubmission(body) {
  const errors = [];
  const b = body || {};

  if (!b.question || !String(b.question).trim()) errors.push('Thiếu nội dung câu hỏi.');
  if (!b.category || !String(b.category).trim()) errors.push('Thiếu chuyên mục (category).');
  if (!b.answer || !VALID_LETTERS.includes(String(b.answer).toUpperCase())) {
    errors.push('Đáp án phải là một trong A, B, C, D.');
  }
  if (!Array.isArray(b.options) || b.options.length !== 4) {
    errors.push('Cần đúng 4 lựa chọn A, B, C, D.');
  } else {
    const letters = b.options.map((o) => o && String(o.letter).toUpperCase());
    for (const l of VALID_LETTERS) {
      if (!letters.includes(l)) errors.push(`Thiếu lựa chọn ${l}.`);
    }
    for (const o of b.options) {
      if (!o || !o.text || !String(o.text).trim()) errors.push('Mỗi lựa chọn cần có nội dung.');
    }
  }

  const bi = b.birth_info || {};
  if (!bi.raw || !String(bi.raw).trim()) {
    errors.push('Thiếu thông tin ngày sinh (birth_info.raw).');
  }

  return errors;
}

function generateId() {
  return `vh_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = async (req, res) => {
  const db = await getDb();
  const col = db.collection('van_han');

  if (req.method === 'GET') {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
      const category = req.query.category ? String(req.query.category) : null;
      const search = req.query.search ? String(req.query.search).trim() : null;
      const caseId = req.query.case_id ? String(req.query.case_id) : null;

      const filter = { status: 'approved' };
      if (category) filter.category = category;
      if (caseId) filter.case_id = caseId;
      if (search) {
        filter.$or = [
          { question: { $regex: search, $options: 'i' } },
          { 'birth_info.raw': { $regex: search, $options: 'i' } },
          { id: { $regex: search, $options: 'i' } },
        ];
      }

      const total = await col.countDocuments(filter);
      const items = await col
        .find(filter, {
          projection: {
            id: 1,
            question_number: 1,
            case_id: 1,
            birth_info: 1,
            question: 1,
            category: 1,
            author: 1,
            created_at: 1,
          },
        })
        .sort({ question_number: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      const categories = await col.distinct('category', { status: 'approved' });

      res.status(200).json({
        items,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        categories: categories.sort(),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi máy chủ, vui lòng thử lại sau.' });
    }
    return;
  }

  if (req.method === 'POST') {
    const user = getUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Bạn cần đăng nhập để đăng câu hỏi.' });
      return;
    }

    const errors = validateSubmission(req.body);
    if (errors.length) {
      res.status(400).json({ error: errors.join(' ') });
      return;
    }

    try {
      const b = req.body;
      const doc = {
        id: generateId(),
        case_id: b.case_id ? String(b.case_id) : `user_${user.uid}`,
        birth_info: {
          raw: String(b.birth_info.raw).trim(),
          gender: b.birth_info.gender || null,
          year: b.birth_info.year || null,
          month: b.birth_info.month || null,
          day: b.birth_info.day || null,
          hour: b.birth_info.hour ?? null,
          minute: b.birth_info.minute ?? null,
          country: b.birth_info.country || null,
          location: b.birth_info.location || null,
          calendar_type: b.birth_info.calendar_type || null,
        },
        question: String(b.question).trim(),
        options: b.options.map((o) => ({
          letter: String(o.letter).toUpperCase(),
          text: String(o.text).trim(),
        })),
        answer: String(b.answer).toUpperCase(),
        category: String(b.category).trim(),
        has_answer: true,
        status: 'pending',
        author: {
          user_id: user.uid,
          name: user.username,
        },
        submitted_by: user.uid,
        created_at: new Date(),
        updated_at: new Date(),
      };

      await col.insertOne(doc);
      res.status(201).json({
        message: 'Đã gửi câu hỏi, vui lòng chờ quản trị viên duyệt.',
        id: doc.id,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi máy chủ, vui lòng thử lại sau.' });
    }
    return;
  }

  res.status(405).json({ error: 'Method không được hỗ trợ' });
};
