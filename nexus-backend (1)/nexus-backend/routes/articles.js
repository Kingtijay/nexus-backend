const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../db/schema');
const { requireAuth, optionalAuth, requireAdmin } = require('../middleware/auth');

const CATEGORIES = ['World', 'Politics', 'Business', 'Technology', 'Science', 'Health', 'Environment', 'Culture'];

// GET /api/articles — list with filters, pagination
router.get('/', optionalAuth, (req, res) => {
  const {
    category, search, page = 1, limit = 12,
    sort = 'latest', featured, breaking
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const conditions = [];
  const params = [];

  if (category && CATEGORIES.includes(category)) {
    conditions.push('a.category = ?');
    params.push(category);
  }
  if (search) {
    conditions.push('(a.title LIKE ? OR a.summary LIKE ? OR a.body LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  if (featured === 'true') { conditions.push('a.is_featured = 1'); }
  if (breaking === 'true') { conditions.push('a.is_breaking = 1'); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderMap = {
    latest: 'a.published_at DESC',
    popular: 'a.view_count DESC',
    oldest: 'a.published_at ASC'
  };
  const order = orderMap[sort] || orderMap.latest;

  const total = db.prepare(`SELECT COUNT(*) as count FROM articles a ${where}`).get(...params).count;
  const articles = db.prepare(`
    SELECT a.*, u.username as author_name,
      (SELECT COUNT(*) FROM comments c WHERE c.article_id = a.id) as comment_count
    FROM articles a
    LEFT JOIN users u ON a.author_id = u.id
    ${where}
    ORDER BY ${order}
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({
    articles: articles.map(a => ({ ...a, tags: JSON.parse(a.tags || '[]') })),
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// GET /api/articles/trending — top 5 most viewed
router.get('/trending', (req, res) => {
  const articles = db.prepare(`
    SELECT a.*, (SELECT COUNT(*) FROM comments c WHERE c.article_id = a.id) as comment_count
    FROM articles a
    ORDER BY a.view_count DESC
    LIMIT 5
  `).all();
  res.json({ articles });
});

// GET /api/articles/categories — stats per category
router.get('/categories', (req, res) => {
  const stats = db.prepare(`
    SELECT category, COUNT(*) as count, SUM(view_count) as total_views
    FROM articles GROUP BY category ORDER BY count DESC
  `).all();
  res.json({ categories: stats });
});

// POST /api/articles — create (auth required)
router.post('/', requireAuth, (req, res) => {
  const { title, category, summary, body, source, is_breaking, is_featured, read_time, tags, image_url } = req.body;

  if (!title || !category || !summary || !body || !source)
    return res.status(400).json({ error: 'title, category, summary, body, source are required' });
  if (!CATEGORIES.includes(category))
    return res.status(400).json({ error: `Category must be one of: ${CATEGORIES.join(', ')}` });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO articles (id, title, category, summary, body, source, author_id, is_breaking, is_featured, read_time, tags, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, title.trim(), category, summary.trim(), body.trim(), source.trim(),
    req.user.id,
    is_breaking ? 1 : 0,
    is_featured ? 1 : 0,
    read_time || '3 min read',
    JSON.stringify(tags || []),
    image_url || null
  );

  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
  res.status(201).json({ article: { ...article, tags: JSON.parse(article.tags) } });
});

// GET /api/articles/:id
router.get('/:id', optionalAuth, (req, res) => {
  const article = db.prepare(`
    SELECT a.*, u.username as author_name, u.bio as author_bio,
      (SELECT COUNT(*) FROM comments c WHERE c.article_id = a.id) as comment_count
    FROM articles a
    LEFT JOIN users u ON a.author_id = u.id
    WHERE a.id = ?
  `).get(req.params.id);

  if (!article) return res.status(404).json({ error: 'Article not found' });

  // Track view
  const ipHash = crypto.createHash('md5').update(req.ip || 'unknown').digest('hex');
  const recentView = db.prepare(`
    SELECT id FROM article_views
    WHERE article_id = ? AND (user_id = ? OR ip_hash = ?)
    AND viewed_at > datetime('now', '-1 hour')
  `).get(article.id, req.user?.id || null, ipHash);

  if (!recentView) {
    db.prepare('INSERT INTO article_views (id, article_id, user_id, ip_hash) VALUES (?, ?, ?, ?)').run(
      uuidv4(), article.id, req.user?.id || null, ipHash
    );
    db.prepare('UPDATE articles SET view_count = view_count + 1 WHERE id = ?').run(article.id);
  }

  // Is bookmarked by current user?
  let is_bookmarked = false;
  if (req.user) {
    const bm = db.prepare('SELECT id FROM bookmarks WHERE user_id = ? AND article_id = ?').get(req.user.id, article.id);
    is_bookmarked = !!bm;
  }

  res.json({ article: { ...article, tags: JSON.parse(article.tags || '[]'), is_bookmarked } });
});

// PATCH /api/articles/:id
router.patch('/:id', requireAuth, (req, res) => {
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  if (article.author_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Not authorized' });

  const fields = ['title', 'category', 'summary', 'body', 'source', 'is_breaking', 'is_featured', 'read_time', 'tags', 'image_url'];
  const updates = [];
  const params = [];

  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(f === 'tags' ? JSON.stringify(req.body[f]) : req.body[f]);
    }
  });

  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(req.params.id);

  db.prepare(`UPDATE articles SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const updated = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  res.json({ article: { ...updated, tags: JSON.parse(updated.tags || '[]') } });
});

// DELETE /api/articles/:id
router.delete('/:id', requireAuth, (req, res) => {
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  if (article.author_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Not authorized' });

  db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
  res.json({ message: 'Article deleted' });
});

module.exports = router;
