require('dotenv').config(); // 第一行一定要先打開保險箱
const express = require('express');
const cors = require('cors');
const path = require('path') // 要補這行，不然startAIProcess會當機
const db = require('./db'); // 引入剛寫好的 db.js
const { spawn } = require('child_process'); // 🌟 引入呼叫 Python 的工具


const app = express();
// 建議 PORT 也從 .env 讀取，讀取不到才用3000
const PORT = process.env.PORT||3000;


// 中介軟體 (Middleware) 設定
app.use(cors());           // 允許跨來源請求，方便之後 App 連線
app.use(express.json());   // 解析前端傳來的 JSON 格式數據

// 健康檢查路由（正式環境必備）定義根路由 (Root Route)
app.get('/', (_req, res) => {
    res.status(200).json({
        status: "success",
        message: "SmartGuide Backend Server is running.",
        developer: "Ella"
    });
});


// ==========================================
// 決策輔助：呼叫 Python AI 辨識的範例
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