// Chạy: node scripts/seed.js [đường-dẫn-file-json]
// Mặc định đọc data/van_han_seed.json và nạp vào collection van_han
// với status "approved" và tác giả "Vô danh khách" (theo yêu cầu:
// dữ liệu có sẵn ban đầu ghi tác giả là vô danh khách).

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Thiếu MONGODB_URI trong biến môi trường (.env).');
    process.exit(1);
  }
  const dbName = process.env.MONGODB_DB || 'luan_han_forum';

  const filePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, '..', 'data', 'van_han_seed.json');

  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  const questions = Array.isArray(parsed) ? parsed : parsed.questions;

  if (!Array.isArray(questions) || !questions.length) {
    console.error('Không tìm thấy mảng "questions" trong file JSON.');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const col = db.collection('van_han');

  await col.createIndex({ id: 1 }, { unique: true });

  let inserted = 0;
  let skipped = 0;

  for (const q of questions) {
    const doc = {
      ...q,
      status: 'approved',
      author: { user_id: null, name: 'Vô danh khách' },
      submitted_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await col.updateOne(
      { id: q.id },
      { $setOnInsert: doc },
      { upsert: true }
    );

    if (result.upsertedCount) inserted++;
    else skipped++;
  }

  console.log(`Đã nạp xong: ${inserted} câu hỏi mới, bỏ qua ${skipped} câu đã tồn tại.`);
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
