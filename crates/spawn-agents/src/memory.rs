//! Database layer for persistent memory

use spawn_core::{Mission, MissionStatus, Result};
use sqlx::SqlitePool;
use tracing::info;

pub struct Database {
    pool: SqlitePool,
}

impl Database {
    /// Connect to SQLite database
    pub async fn connect(url: &str) -> Result<Self> {
        info!(url = url, "Connecting to database");
        let pool = SqlitePool::connect(url).await?;
        
        // Run migrations
        sqlx::migrate!("../../migrations")
            .run(&pool)
            .await?;
        
        Ok(Self { pool })
    }
    
    /// Create a new mission
    pub async fn create_mission(&self, mission: &Mission) -> Result<()> {
        let status = serde_json::to_string(&mission.status)?;
        let context = serde_json::to_string(&mission.context)?;
        
        sqlx::query(
            r#"
            INSERT INTO missions (id, goal, status, created_at, updated_at, context)
            VALUES (?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&mission.id)
        .bind(&mission.goal)
        .bind(&status)
        .bind(mission.created_at)
        .bind(mission.updated_at)
        .bind(&context)
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }
    
    /// Get mission by ID
    pub async fn get_mission(&self, id: &str) -> Result<Option<Mission>> {
        let row = sqlx::query_as::<_, MissionRow>(
            "SELECT id, goal, status, created_at, updated_at, context FROM missions WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;
        
        Ok(row.map(|r| r.into_mission()))
    }
    
    /// Update mission status
    pub async fn update_mission_status(&self, id: &str, status: MissionStatus) -> Result<()> {
        let status_str = serde_json::to_string(&status)?;
        let now = chrono::Utc::now();
        
        sqlx::query("UPDATE missions SET status = ?, updated_at = ? WHERE id = ?")
            .bind(&status_str)
            .bind(now)
            .bind(id)
            .execute(&self.pool)
            .await?;
        
        Ok(())
    }
    
    /// List all missions
    pub async fn list_missions(&self) -> Result<Vec<Mission>> {
        let rows = sqlx::query_as::<_, MissionRow>(
            "SELECT id, goal, status, created_at, updated_at, context FROM missions ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await?;
        
        Ok(rows.into_iter().map(|r| r.into_mission()).collect())
    }
    
    /// Log a step in mission execution
    pub async fn log_step(&self, mission_id: &str, agent: &str, content: &str) -> Result<()> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now();
        
        sqlx::query(
            "INSERT INTO mission_logs (id, mission_id, agent, content, created_at) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(mission_id)
        .bind(agent)
        .bind(content)
        .bind(now)
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }
}

// Internal row type for SQLx
#[derive(sqlx::FromRow)]
struct MissionRow {
    id: String,
    goal: String,
    status: String,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
    context: String,
}

impl MissionRow {
    fn into_mission(self) -> Mission {
        Mission {
            id: self.id,
            goal: self.goal,
            status: serde_json::from_str(&self.status).unwrap_or(MissionStatus::Pending),
            created_at: self.created_at,
            updated_at: self.updated_at,
            context: serde_json::from_str(&self.context).unwrap_or(serde_json::json!({})),
        }
    }
}
