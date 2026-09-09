const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'luan_han_forum';

if (!uri) {
  console.error('Thiếu biến môi trường MONGODB_URI');
}

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

  await ensureIndexes(cachedDb);

  return cachedDb;
}

let indexesEnsured = false;
async function ensureIndexes(db) {
  if (indexesEnsured) return;

  const jobs = [
    () => db.collection('van_han').createIndex({ id: 1 }, { unique: true }),
    () => db.collection('van_han').createIndex({ status: 1, question_number: 1 }),
    () => db.collection('van_han').createIndex({ category: 1 }),
    () => db.collection('van_han').createIndex(
      { question: 'text', 'birth_info.raw': 'text' },
      { name: 'search_text' }
    ),
    // Chỉ ép unique với document nào THỰC SỰ có email dạng chuỗi.
    // Tránh sập khi có user cũ/khác nguồn thiếu field email (null == null với Mongo).
    () => db.collection('users').createIndex(
      { email: 1 },
      { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
    ),
    () => db.collection('users').createIndex({ username: 1 }, { unique: true }),
    () => db.collection('comments').createIndex({ question_id: 1, created_at: 1 }),
    () => db.collection('comments').createIndex({ created_at: -1 }),
    () => db.collection('stats_daily').createIndex({ date: 1 }, { unique: true }),
  ];

  // Chạy từng index độc lập: 1 cái lỗi không làm bỏ qua toàn bộ các cái còn lại,
  // và không đánh dấu "đã xong" nếu có lỗi thật sự cần chú ý.
  let allOk = true;
  for (const job of jobs) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await job();
    } catch (err) {
      allOk = false;
      console.error('Không thể tạo index (bỏ qua nếu đã tồn tại):', err.message);
    }
  }
  if (allOk) indexesEnsured = true;
}

module.exports = { getDb };