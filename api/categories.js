const { getDb } = require('../lib/mongodb');

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method không được hỗ trợ' });
        return;
    }
    try {
        const db = await getDb();
        // Lấy tên chuyên mục xuất hiện ở bất kỳ trạng thái nào (chỉ là nhãn phân loại,
        // không phải nội dung riêng tư) để gợi ý, tránh người dùng tạo trùng lặp
        // do khác cách viết hoa/khoảng trắng.
        const categories = await db.collection('van_han').distinct('category');
        const cleaned = Array.from(
            new Set(categories.filter(Boolean).map((c) => String(c).trim()))
        ).sort((a, b) => a.localeCompare(b, 'vi'));
        res.status(200).json({ categories: cleaned });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi máy chủ.' });
    }
};