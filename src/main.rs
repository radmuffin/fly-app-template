use axum::{extract::State, http::StatusCode, routing::get, Json, Router};
use fly_common::prelude::*;
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Clone)]
struct AppState {
    db: DbPool,
}

#[derive(Debug, Serialize, Deserialize)]
struct Note {
    id: i64,
    content: String,
    created_at: String,
}

#[derive(Debug, Deserialize)]
struct CreateNoteRequest {
    content: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Initialize SQLite connection with WAL mode & production pragmas
    let db_path = std::env::var("DATABASE_PATH").unwrap_or_else(|_| "app.db".into());
    let db = FlyDb::open_shared(&db_path)?;

    // 2. Run initial schema migrations
    {
        let mut conn = db.lock().unwrap();
        FlyDb::run_migrations(
            &mut conn,
            &[r#"
                CREATE TABLE IF NOT EXISTS notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_token TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_token);
            "#],
        )?;
    }

    let state = AppState { db };

    // 3. Define custom application routes
    let api = Router::new()
        .route("/notes", get(list_notes).post(create_note))
        .with_state(state);

    // 4. Start FlyServer
    FlyServer::builder()
        .with_app_info("Fly App Template", "0.1.0")
        .nest("/api", api)
        .with_static_dir("static")
        .serve()
        .await
}

async fn list_notes(
    user: UserToken,
    State(state): State<AppState>,
) -> (StatusCode, Json<ApiResponse<Vec<Note>>>) {
    let conn = state.db.lock().unwrap();
    let mut stmt = match conn
        .prepare("SELECT id, content, created_at FROM notes WHERE user_token = ? ORDER BY id DESC")
    {
        Ok(stmt) => stmt,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::err(e.to_string())),
            )
        }
    };

    let notes = stmt
        .query_map(params![user.as_str()], |row| {
            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                created_at: row.get(2)?,
            })
        })
        .map(|rows| rows.filter_map(Result::ok).collect::<Vec<_>>())
        .unwrap_or_default();

    (StatusCode::OK, Json(ApiResponse::ok(notes)))
}

async fn create_note(
    user: UserToken,
    State(state): State<AppState>,
    Json(payload): Json<CreateNoteRequest>,
) -> (StatusCode, Json<ApiResponse<Note>>) {
    if payload.content.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err("Content cannot be empty")),
        );
    }

    let now = chrono::Utc::now().to_rfc3339();
    let conn = state.db.lock().unwrap();

    let res = conn.execute(
        "INSERT INTO notes (user_token, content, created_at) VALUES (?, ?, ?)",
        params![user.as_str(), payload.content.trim(), now],
    );

    match res {
        Ok(_) => {
            let id = conn.last_insert_rowid();
            (
                StatusCode::CREATED,
                Json(ApiResponse::ok(Note {
                    id,
                    content: payload.content,
                    created_at: now,
                })),
            )
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(e.to_string())),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_notes_crud_lifecycle() {
        let db = FlyDb::open_shared(":memory:").expect("open in-memory db");
        {
            let mut conn = db.lock().unwrap();
            FlyDb::run_migrations(
                &mut conn,
                &[r#"
                    CREATE TABLE IF NOT EXISTS notes (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_token TEXT NOT NULL,
                        content TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_token);
                "#],
            )
            .expect("migrations");
        }

        let state = AppState { db };
        let user = UserToken::new("test_user_token_123");

        // 1. Create note
        let (status, Json(created)) = create_note(
            user.clone(),
            State(state.clone()),
            Json(CreateNoteRequest {
                content: "Remember to explore Kyoto back alleys".to_string(),
            }),
        )
        .await;
        assert_eq!(status, StatusCode::CREATED);
        assert!(created.success);
        let note = created.data.expect("created note");
        assert_eq!(note.content, "Remember to explore Kyoto back alleys");

        // 2. List notes for user
        let (status_list, Json(listed)) = list_notes(user.clone(), State(state.clone())).await;
        assert_eq!(status_list, StatusCode::OK);
        let notes = listed.data.expect("notes list");
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].id, note.id);

        // 3. Reject empty note
        let (status_bad, Json(bad_res)) = create_note(
            user.clone(),
            State(state.clone()),
            Json(CreateNoteRequest {
                content: "   ".to_string(),
            }),
        )
        .await;
        assert_eq!(status_bad, StatusCode::BAD_REQUEST);
        assert!(!bad_res.success);
    }
}
