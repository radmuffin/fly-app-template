# 🤖 AGENTS.md — AI Agent Guidance for `fly-app-template`

Welcome! This repository serves as the baseline starter template for single-page applications powered by **`fly-common`** running on Fly.io.

---

## 🗺️ Architecture Overview

- **Language & Runtime**: Rust (Axum 0.7, Tokio async runtime).
- **Engine Core**: `fly-common` crate handling security headers, CORS, SSRF protection, `/healthz`, and anonymous user token extraction.
- **Database**: SQLite via `rusqlite` running in WAL mode with foreign keys enabled, managed through `FlyDb`.
- **Frontend**: Zero-build vanilla ES6 modules with CSS tokens. Core UI components (`FlyToast`, `FlyTheme`, `FlyClient`) are served automatically by the engine under `/_fly/*`.

---

## ⚠️ Key Development Conventions

1. **State & Database Locking**:
   - `DbPool` is `Arc<Mutex<rusqlite::Connection>>`.
   - Keep lock guards short and avoid holding locks across `.await` points.
2. **Anonymous Device Token Auth**:
   - Use the `UserToken` extractor in Axum route handlers to scope queries per anonymous user.
3. **Database Migrations**:
   - Register new tables and schema migrations inside `FlyDb::run_migrations` on startup in `src/main.rs`.
4. **Deploying to Fly.io**:
   - Always allocate a persistent SQLite volume (`fly volumes create app_data --size 1`) before first deployment.
