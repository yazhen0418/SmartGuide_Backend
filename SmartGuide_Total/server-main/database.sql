-- 1. 存放 AI 辨識紀錄
CREATE TABLE vision_logs (
    id SERIAL PRIMARY KEY,
    obs_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 系統自動記下時間
    obstacle_type VARCHAR(50),                     -- 障礙物名稱
    distance_cm FLOAT,                            -- 距離
    gps_location TEXT                             -- GPS 座標
);

-- 2. 存放 ESP32 硬體紀錄
CREATE TABLE hardware_logs (
    id SERIAL PRIMARY KEY,
    log_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    distance FLOAT,
    tilt_angle FLOAT
);

-- 3. 存放系統發出的語音警報紀錄 (大腦的決策紀錄)
CREATE TABLE alert_logs (
    id SERIAL PRIMARY KEY,
    alert_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    alert_text TEXT,               -- 存下語音內容（如：前方有車）
    source_type VARCHAR(20),       -- 紀錄是 AI 還是硬體觸發的
    gps_location TEXT              -- 發生警報時的地點 (如果是 AI 觸發)
);

-- 4. 存放會員資料 (組員開發：註冊/登入用)
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    role VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. 存放聯絡人綁定關係 (組員開發：盲人與照護者綁定)
CREATE TABLE connections (
    id SERIAL PRIMARY KEY,
    blind_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    caregiver_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    requester_id INT REFERENCES users(user_id),
    is_emergency BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. 存放 SOS 求救紀錄 (組員開發：緊急按鈕)
CREATE TABLE sos_events (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    latitude FLOAT,
    longitude FLOAT,
    event_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
