# 🛠️ Development & Deployment Guide for `fly-app-template`

## 💻 Local Development

```bash
# Start local development server
cargo run

# Run checks & linter
cargo check
cargo clippy --all-targets
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🚀 Fly.io Deployment

1. Initialize your Fly application:
   ```bash
   fly launch
   ```
2. Create persistent SQLite storage volume:
   ```bash
   fly volumes create app_data --size 1
   ```
3. Deploy:
   ```bash
   fly deploy
   ```
