-- Spawn Database Schema

-- Missions table
CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY,
    goal TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    context TEXT NOT NULL DEFAULT '{}'
);

-- Mission logs
CREATE TABLE IF NOT EXISTS mission_logs (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL,
    agent TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (mission_id) REFERENCES missions(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_mission_logs_mission ON mission_logs(mission_id);
