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
