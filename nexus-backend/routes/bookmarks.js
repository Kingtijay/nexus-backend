const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/schema');
const { requireAuth } = require('../middleware/auth');

// GET /api/bookmarks — get current user's bookmarks
router.get('/', requireAuth, (req, res) => {
  const { page = 1, limit = 20, category } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions = ['b.user_id = ?'];
  const params = [req.user.id];

  if (category) { conditions.push('b.article_category = ?'); params.push(category); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) as count FROM bookmarks b ${where}`).get(...params).count;

  const bookmarks = db.prepare(`
    SELECT b.*
    FROM bookmarks b
    ${where}
    ORDER BY b.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({
    bookmarks,
    pagination: {
      total, page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// POST /api/bookmarks — add bookmark
router.post('/', requireAuth, (req, res) => {
  const { article_id, article_title, article_category, article_summary, article_source } = req.body;

  if (!article_id || !article_title)
    return res.status(400).json({ error: 'article_id and article_title are required' });

  const existing = db.prepare('SELECT id FROM bookmarks WHERE user_id = ? AND article_id = ?').get(req.user.id, article_id);
  if (existing) return res.status(409).json({ error: 'Already bookmarked' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO bookmarks (id, user_id, article_id, article_title, article_category, article_summary, article_source)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, article_id, article_title, article_category || '', article_summary || '', article_source || '');

  const bookmark = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  res.status(201).json({ bookmark });
});

// DELETE /api/bookmarks/:articleId — remove bookmark
router.delete('/:articleId', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND article_id = ?').run(req.user.id, req.params.articleId);
  if (result.changes === 0) return res.status(404).json({ error: 'Bookmark not found' });
  res.json({ message: 'Bookmark removed' });
});

// GET /api/bookmarks/check/:articleId — check if bookmarked
router.get('/check/:articleId', requireAuth, (req, res) => {
  const bm = db.prepare('SELECT id FROM bookmarks WHERE user_id = ? AND article_id = ?').get(req.user.id, req.params.articleId);
  res.json({ is_bookmarked: !!bm });
});

module.exports = router;
