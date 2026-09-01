# 🚀 Fly.io App Template (Powered by `fly-common`)

Minimal, ultra-fast starter template for fullstack web applications deployed on Fly.io using Axum, SQLite (WAL mode), anonymous device tokens, and zero-build vanilla JS/CSS.

---

## 🛠️ Quick Start

### 1. Run Locally
```bash
cargo run
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Deploy to Fly.io
```bash
# Create Fly app
fly launch

# Create persistent storage volume for SQLite
fly volumes create app_data --size 1

# Deploy
fly deploy
```

---

## 🧩 Built-in Features
* **Zero-config Backend**: Preconfigured with `FlyServer` (Axum), security headers, CORS, and `/healthz`.
* **Anonymous Multi-Device Auth**: Uses `UserToken` and `FlyClient` for frictionless state persistence.
* **Embedded UI Core**: Includes toast notifications (`FlyToast`), dark mode (`FlyTheme`), and CSS design tokens.
