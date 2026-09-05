const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'tuvi_cache';

if (!uri) {
  console.error('Thiếu biến môi trường MONGODB_URI');
}

// Cache client giữa các lần gọi function trên Vercel (tránh mở kết nối mới mỗi request)
let cachedClient = global._luanhanMongoClient;
let cachedDb = global._luanhanMongoDb;

async function getDb() {
  if (cachedDb) return cachedDb;

  if (!cachedClient) {
    cachedClient = new MongoClient(uri, {
      maxPoolSize: 10,
    });
    global._luanhanMongoClient = cachedClient;
  }

  if (!cachedClient.topology || !cachedClient.topology.isConnected()) {
    await cachedClient.connect();
  }

  cachedDb = cachedClient.db(dbName);
  global._luanhanMongoDb = cachedDb;

  // Đảm bảo các index cần thiết tồn tại (idempotent, chạy nhanh nếu đã có)
  await ensureIndexes(cachedDb);

  return cachedDb;
}

let indexesEnsured = false;
async function ensureIndexes(db) {
  if (indexesEnsured) return;
  indexesEnsured = true;
  try {
    await db.collection('van_han').createIndex({ id: 1 }, { unique: true });
    await db.collection('van_han').createIndex({ status: 1, question_number: 1 });
    await db.collection('van_han').createIndex({ category: 1 });
    await db.collection('van_han').createIndex(
      { question: 'text', 'birth_info.raw': 'text' },
      { name: 'search_text' }
    );
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ username: 1 }, { unique: true });
    await db.collection('comments').createIndex({ question_id: 1, created_at: 1 });
  } catch (err) {
    console.error('Không thể tạo index (bỏ qua nếu đã tồn tại):', err.message);
  }
}

module.exports = { getDb };
