require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');

const db  = require('./db/schema');
const app = express();
const PORT = process.env.PORT || 3001;

// ── Auto-seed on first boot ───────────────────────────────────────
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount === 0) {
  console.log('🌱 Empty database — running seed automatically...');
  try { require('./scripts/seed'); } catch (e) { console.error('Seed error:', e.message); }
}

// ── Security & Middleware ─────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: '*',   // allow all origins so Netlify frontend can reach Railway backend
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('[:date[iso]] :method :url :status :response-time ms'));

// ── Rate Limiting ─────────────────────────────────────────────────
app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 300,
  message: { error: 'Too many requests, please slow down.' } }));
app.use('/api/auth/login',    rateLimit({ windowMs: 15*60*1000, max: 20 }));
app.use('/api/auth/register', rateLimit({ windowMs: 15*60*1000, max: 20 }));

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/articles',  require('./routes/articles'));
app.use('/api/articles',  require('./routes/comments'));   // handles /:id/comments
app.use('/api/bookmarks', require('./routes/bookmarks'));
app.use('/api/newsletter',require('./routes/newsletter'));
app.use('/api/admin',     require('./routes/admin'));

// ── Health Check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const u = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const a = db.prepare('SELECT COUNT(*) as c FROM articles').get().c;
  res.json({ status:'ok', uptime: process.uptime(), db:{ users:u, articles:a }, ts: new Date().toISOString() });
});

// ── 404 / Error ───────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error:`Route ${req.method} ${req.path} not found` }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error:'Internal server error' }); });

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════╗
║         NEXUS NEWS BACKEND               ║
║  Running on http://0.0.0.0:${PORT}          ║
╠══════════════════════════════════════════╣
║  GET  /api/health          Health check  ║
║  POST /api/auth/register   Register      ║
║  POST /api/auth/login      Login         ║
║  GET  /api/articles        List articles ║
║  GET  /api/bookmarks       My bookmarks  ║
╚══════════════════════════════════════════╝`);
});

module.exports = app;
