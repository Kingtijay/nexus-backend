const express = require('express');
const router = express.Router();
const db = require('../db/schema');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

// GET /api/admin/stats — dashboard stats
router.get('/stats', (req, res) => {
  const stats = {
    users: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
    articles: db.prepare('SELECT COUNT(*) as count FROM articles').get().count,
    comments: db.prepare('SELECT COUNT(*) as count FROM comments').get().count,
    bookmarks: db.prepare('SELECT COUNT(*) as count FROM bookmarks').get().count,
    subscribers: db.prepare('SELECT COUNT(*) as count FROM subscribers WHERE is_active = 1').get().count,
    total_views: db.prepare('SELECT SUM(view_count) as total FROM articles').get().total || 0,
    articles_by_category: db.prepare('SELECT category, COUNT(*) as count FROM articles GROUP BY category').all(),
    recent_users: db.prepare('SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5').all(),
    top_articles: db.prepare('SELECT id, title, view_count, category FROM articles ORDER BY view_count DESC LIMIT 5').all(),
    daily_views: db.prepare(`
      SELECT DATE(viewed_at) as date, COUNT(*) as views
      FROM article_views
      WHERE viewed_at > datetime('now', '-7 days')
      GROUP BY DATE(viewed_at)
      ORDER BY date ASC
    `).all()
  };
  res.json({ stats });
});

// GET /api/admin/users
router.get('/users', (req, res) => {
  const { page = 1, limit = 20, search, role } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push('(username LIKE ? OR email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (role) { conditions.push('role = ?'); params.push(role); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) as count FROM users ${where}`).get(...params).count;
  const users = db.prepare(`
    SELECT id, username, email, role, is_active, created_at, last_login
    FROM users ${where}
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ users, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', (req, res) => {
  const { role, is_active } = req.body;
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot modify your own account' });

  const updates = [];
  const params = [];
  if (role) { updates.push('role = ?'); params.push(role); }
  if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

  params.push(req.params.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ message: 'User updated' });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'User deleted' });
});

// DELETE /api/admin/articles/:id — hard delete any article
router.delete('/articles/:id', (req, res) => {
  db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
  res.json({ message: 'Article deleted' });
});

// PATCH /api/admin/articles/:id/feature
router.patch('/articles/:id/feature', (req, res) => {
  const { is_featured, is_breaking } = req.body;
  const updates = [];
  const params = [];
  if (is_featured !== undefined) { updates.push('is_featured = ?'); params.push(is_featured ? 1 : 0); }
  if (is_breaking !== undefined) { updates.push('is_breaking = ?'); params.push(is_breaking ? 1 : 0); }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(req.params.id);
  db.prepare(`UPDATE articles SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ message: 'Article updated' });
});

module.exports = router;
