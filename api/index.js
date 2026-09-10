// Đây là function serverless DUY NHẤT trên Vercel cho toàn bộ API (tránh vượt giới hạn 12 function).
// Toàn bộ route thật nằm trong /server.js (Express app), file này chỉ export lại.
module.exports = require('../server');