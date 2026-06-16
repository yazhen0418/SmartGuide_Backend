require('dotenv').config();
const { Pool } = require('pg');

// 建立連線池
const pool = new Pool ({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const now = new Date().toLocaleTimeString();
// 加入簡單的測試，確保檔案被讀取時保險箱式打開的
console.log(`[${now}] [DB Config] 嘗試讀取帳號：`, process.env.DB_USER || '失敗');

// 匯出 pool 讓其他檔案可以使用

module.exports = {
    query: (text, params) => pool.query(text, params),
};