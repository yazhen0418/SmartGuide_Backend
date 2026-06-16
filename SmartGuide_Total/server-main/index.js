require('dotenv').config(); // 🌟 第一行先打開保險箱 (Ella 的專業寫法)
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt'); // 組員的加密工具
const path = require ('path'); // Ella 的路徑工具
const { spawn } = require('child_process'); // Ella 的呼叫 Python 工具 

// 核心：引入你專業的資料庫模組
const db = require('./db');

const app = express();
// 結合兩人的寫法：優先讀取保險箱，讀不到才用3000
const PORT = process.env.PORT||3000;

app.use(cors());
app.use(express.json());


// ==========================================
// 0. 健康檢查路由 (Ella 開發)
// ==========================================
app.get('/', (_req, res) => {
    res.status(200).json({
        status: "success",
        message: "SmartGuide Backend Server is running.",
        developer: "Ella & Team"
    });
});

// ==========================================
// 1. 認證模組
// ==========================================
app.post('/register', async (req, res) => {
  const { full_name, username, email, password, role, phone } = req.body;
  try {
    const userCheck = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userCheck.rows.length > 0) return res.status(400).json({ success: false, message: "帳號已被註冊" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (full_name, username, password_hash, phone, email, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id, full_name, username, role`,
      [full_name, username, hashedPassword, phone, email || null, role]
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: "伺服器錯誤" }); }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]); // 改為 db.query
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: "帳號不存在" });
    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ success: false, message: "密碼錯誤" });
    res.json({ success: true, user: { id: user.user_id, username: user.username, role: user.role, full_name: user.full_name, phone: user.phone } });
  } catch (err) { res.status(500).json({ success: false, message: "伺服器錯誤" }); }
});

// ==========================================
// 2. 聯絡人模組
// ==========================================
app.post('/bind-direct', async (req, res) => {
  const { myId, targetId } = req.body;
  try {
    const checkResult = await db.query(`SELECT * FROM connections WHERE (blind_id = $1 AND caregiver_id = $2) OR (blind_id = $2 AND caregiver_id = $1)`, [myId, targetId]); // 改為 db.query
    if (checkResult.rows.length > 0) return res.status(400).json({ success: false, message: "已經綁定" });
    const userRes = await db.query("SELECT user_id, role FROM users WHERE user_id IN ($1, $2)", [myId, targetId]);
    const users = userRes.rows;
    let blind_id = users.find(u => u.role === 'blind')?.user_id;
    let caregiver_id = users.find(u => u.role === 'caregiver')?.user_id;
    await db.query(`INSERT INTO connections (blind_id, caregiver_id, status, requester_id) VALUES ($1, $2, 'accepted', $3)`, [blind_id, caregiver_id, myId]);
    res.json({ success: true, message: "綁定成功" });
  } catch (err) { res.status(500).json({ success: false, message: "資料庫錯誤" }); }
});

app.get('/contacts/:userId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.user_id as id, u.full_name as username, u.phone, u.role, c.id as connection_id, COALESCE(c.is_emergency, false) as is_emergency
       FROM connections c
       JOIN users u ON (u.user_id = c.blind_id OR u.user_id = c.caregiver_id)
       WHERE (c.blind_id = $1 OR c.caregiver_id = $1) AND u.user_id != $1 AND c.status = 'accepted'
       ORDER BY c.is_emergency DESC`, [req.params.userId]
    );
    res.json({ success: true, contacts: result.rows });
  } catch (err) { res.status(500).json({ success: false, error: "無法獲取聯絡人" }); }
});

app.post('/reject-bind', async (req, res) => {
  try {
    await db.query('DELETE FROM connections WHERE id = $1', [req.body.connectionId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/set-emergency', async (req, res) => {
  const { blindId, connectionId } = req.body;
  try {
    await db.query('UPDATE connections SET is_emergency = false WHERE blind_id = $1', [blindId]);
    if (connectionId !== -1) {
      await db.query('UPDATE connections SET is_emergency = true WHERE id = $1', [connectionId]);
    }
    res.json({ success: true });
  } catch (err) { 
    console.error("Emergency Update Error:", err);
    res.status(500).json({ success: false }); 
  }
});

// ==========================================
// 3. SOS 警報與歷史紀錄模組
// ==========================================
app.post('/sos', async (req, res) => {
  const { userId, latitude, longitude, eventType } = req.body;
  try {
    // 1. 寫入警報紀錄
    await db.query(
      `INSERT INTO sos_events (user_id, latitude, longitude, event_type) VALUES ($1, $2, $3, $4)`, 
      [userId, latitude, longitude, eventType]
    );

    // 2. 查詢該使用者的緊急聯絡人電話
    // 假設 connections 表有 is_emergency 欄位，且與 users 表關聯
    const contactRes = await db.query(`
      SELECT u.phone 
      FROM connections c
      JOIN users u ON (u.user_id = c.blind_id OR u.user_id = c.caregiver_id)
      WHERE (c.blind_id = $1 OR c.caregiver_id = $1) 
      AND u.user_id != $1 
      AND c.is_emergency = true
      LIMIT 1`, [userId]);

    const emergencyPhone = contactRes.rows.length > 0 ? contactRes.rows[0].phone : null;

    res.json({ success: true, emergencyPhone });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ success: false, message: "伺服器錯誤" }); 
  }
});

app.get('/sos-history/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query(
      `SELECT e.id, u.full_name as name, e.event_type as event, e.created_at as time, e.latitude, e.longitude 
       FROM sos_events e
       JOIN users u ON e.user_id = u.user_id
       JOIN connections c ON e.user_id = c.blind_id
       WHERE c.caregiver_id = $1 
       ORDER BY e.created_at DESC`,
      [userId]
    );
    res.json({ success: true, requests: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "資料庫查詢失敗" });
  }
});

// ==========================================
// 4. 決策輔助與硬體接收 (Ella 開發)
// ==========================================
function startAIProcess() {
   console.log("[System] 正在啟動 Python AI 辨識模組...");
   // 使用絕對路徑，電腦就不會找錯
   const scriptPath = path.join(__dirname, 'vision_ai.py'); 
   const pythonProcess = spawn('python', [scriptPath]);

    // 🌟 加上 .toString() 解決亂碼問題
    pythonProcess.stdout.on('data', (data) => {
        console.log(`[AI 輸出]: ${data.toString().trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`[AI Error]: ${data.toString().trim()}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`[System] AI 進程已關閉，結束碼: ${code}`);
    });
}

// ==========================================
// 1. 給組員 2 (ESP32 硬體) 的專屬接收站
// ==========================================
app.post('/api/hardware', async (req, res) => {
    // 擷取 ESP32 傳來的資料
    const { distance, tilt } = req.body; 
    // 印出時間
    const time = new Date().toLocaleTimeString();
    // 專業寫法：先檢查數據是否存在
    if (distance === undefined || tilt === undefined) {
        return res.status(400).json({ 
            status: "error", 
            message: "缺少必要數據" });
    }
    console.log(`[${time}] [硬體接收] 收到距離: ${distance}cm, 傾斜數據: ${tilt}`);

    try {
        await db.query('INSERT INTO hardware_logs(distance, tilt_angle) VALUES($1, $2)', [distance, tilt]);
        console.log(`[${time}] [硬體成功] 距離: ${distance}cm`);
        res.status(200).json({ 
            status: "success", 
            message: "存檔成功" 
        });
    } catch (err) {
        console.error('[DB Error]', err.message);
        res.status(500).json({ 
            status: "error", 
            message: "資料庫寫入失敗" 
        });
    }
});

// ==========================================
// 2. 給組員 1 (AI 影像) 的專屬接收站
// ==========================================
app.post('/api/vision', async (req, res) => {
    // 擷取 AI 傳來的資料
    const { timestamp, gps, obstacle, distance } = req.body;

    // 🌟 補上這行檢查，大公司最怕收到 null
    if (!gps || !obstacle || distance === undefined) {
        return res.status(400).json({ 
            status: "error", 
            message: "AI 傳來的數據不完整" });
    }

    // 加入時間
    const time = new Date().toLocaleTimeString();

    // 🌟 核心改動：只處理文字警報
    let alertMessage = "環境安全";
    // 實作 SOP 裡的決策邏輯
    if (obstacle === '車' && distance < 100) {
        alertMessage = `警報:前方一公尺內有車輛 !`;
    }

    try {
        // 動作 1 存入影像原始紀錄
        const queries = [
            db.query('INSERT INTO vision_logs(obstacle_type, distance_cm, gps_location) VALUES($1, $2, $3)', [obstacle, distance, gps])
        ];
        // 動作 2 只要有危險，就存入警報紀錄（改用 alertMessage 判斷）
        if (alertMessage !== "環境安全") {
            queries.push(
                db.query('INSERT INTO alert_logs(alert_text, source_type, gps_location) VALUES($1, $2, $3)', [alertMessage, 'AI_VISION', gps])
            );
        }

        await Promise.all(queries);
        // 動作 3 回傳結果，APP會拿到這個alert字串，會用Expo-Speech唸出來
        res.status(200).json({
            status: "success",
            alert: alertMessage, // APP組員拿這串字去唸
            time: time
        });
    } catch (err) {
        console.error('[System Error]', err.message);
        res.status(500).json({ 
            status: "error", 
            message: "處理失敗" 
        });
    }
});

// 啟動伺服器並監聽通訊埠
app.listen(PORT, () => {
    console.log(`[Server] 伺服器已啟動於 http://localhost:${PORT}`);
});

