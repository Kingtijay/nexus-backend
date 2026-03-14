const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// On Railway and most cloud platforms, only /tmp is writable at runtime.
// Locally we keep it in the db/ folder as before.
const isCloud = process.env.RAILWAY_ENVIRONMENT || process.env.RENDER || process.env.FLY_APP_NAME;
const DB_DIR  = isCloud ? '/tmp' : path.join(__dirname);
const DB_PATH = path.join(DB_DIR, 'nexus.db');

if (isCloud && !fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar TEXT DEFAULT NULL,
    bio TEXT DEFAULT NULL,
    role TEXT DEFAULT 'reader' CHECK(role IN ('reader', 'editor', 'admin')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME DEFAULT NULL,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    summary TEXT NOT NULL,
    body TEXT NOT NULL,
    source TEXT NOT NULL,
    author_id TEXT REFERENCES users(id),
    is_breaking INTEGER DEFAULT 0,
    is_featured INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    read_time TEXT DEFAULT '3 min read',
    tags TEXT DEFAULT '[]',
    image_url TEXT DEFAULT NULL,
    video_url TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id TEXT NOT NULL,
    article_title TEXT NOT NULL,
    article_category TEXT NOT NULL,
    article_summary TEXT NOT NULL,
    article_source TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, article_id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    is_edited INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS comment_likes (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    PRIMARY KEY(user_id, comment_id)
  );

  CREATE TABLE IF NOT EXISTS subscribers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    categories TEXT DEFAULT '["all"]',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS article_views (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    ip_hash TEXT,
    viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS search_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_articles_category   ON articles(category);
  CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_comments_article_id ON comments(article_id);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id   ON bookmarks(user_id);
  CREATE INDEX IF NOT EXISTS idx_article_views_id    ON article_views(article_id);
`);

console.log('✅ Database initialized at', DB_PATH);

module.exports = db;
