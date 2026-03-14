# NEXUS News — Backend API

Node.js + Express + SQLite backend for the NEXUS News website.

## Local Development

```bash
npm install
npm run seed    # populate sample data
npm start       # runs on http://localhost:3001
```

## Deploy to Railway (Free Hosting)

1. Push this folder to a GitHub repository
2. Go to railway.app → New Project → Deploy from GitHub
3. Select your repository
4. Add one environment variable in Railway dashboard:
   - `JWT_SECRET` → any long random string (e.g. `openssl rand -hex 32`)
5. Railway auto-detects Node.js and deploys
6. Copy your Railway URL (e.g. `https://nexus-backend-xyz.up.railway.app`)
7. Open nexus-news.html → Settings → paste the Railway URL

The database auto-seeds with sample users on first boot.

## Test Credentials
- Admin:  admin@nexus.com  / admin123
- Editor: sarah@nexus.com  / editor123
- Reader: john@example.com / password123

## API Endpoints
- GET  /api/health
- POST /api/auth/register
- POST /api/auth/login
- GET  /api/auth/me
- GET  /api/articles
- GET  /api/articles/:id
- GET  /api/articles/:id/comments
- POST /api/articles/:id/comments
- GET  /api/bookmarks
- POST /api/bookmarks
- DELETE /api/bookmarks/:id
