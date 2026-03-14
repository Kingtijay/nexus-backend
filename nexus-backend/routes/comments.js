const express = require('express');
const router = express.Router({ mergeParams: true });
const { v4: uuidv4 } = require('uuid');
const db = require('../db/schema');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// GET /api/articles/:articleId/comments
router.get('/', optionalAuth, (req, res) => {
  const { articleId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const total = db.prepare('SELECT COUNT(*) as count FROM comments WHERE article_id = ? AND parent_id IS NULL').get(articleId).count;

  // Get top-level comments with author info
  const comments = db.prepare(`
    SELECT c.*, u.username, u.avatar,
      (SELECT COUNT(*) FROM comments r WHERE r.parent_id = c.id) as reply_count,
      (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id) as like_count
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.article_id = ? AND c.parent_id IS NULL
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(articleId, parseInt(limit), offset);

  // Get replies for each comment
  const withReplies = comments.map(comment => {
    const replies = db.prepare(`
      SELECT c.*, u.username, u.avatar,
        (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id) as like_count
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.parent_id = ?
      ORDER BY c.created_at ASC
    `).all(comment.id);

    // Check if current user liked these
    if (req.user) {
      const userLikes = db.prepare(`
        SELECT comment_id FROM comment_likes WHERE user_id = ? AND comment_id IN (${[comment.id, ...replies.map(r => r.id)].map(() => '?').join(',')})
      `).all(req.user.id, comment.id, ...replies.map(r => r.id));
      const likedSet = new Set(userLikes.map(l => l.comment_id));
      comment.is_liked = likedSet.has(comment.id);
      replies.forEach(r => r.is_liked = likedSet.has(r.id));
    }

    return { ...comment, replies };
  });

  res.json({
    comments: withReplies,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// POST /api/articles/:articleId/comments
router.post('/', requireAuth, (req, res) => {
  const { articleId } = req.params;
  const { body, parent_id } = req.body;

  if (!body || body.trim().length < 1)
    return res.status(400).json({ error: 'Comment body is required' });
  if (body.length > 2000)
    return res.status(400).json({ error: 'Comment too long (max 2000 chars)' });

  // Validate parent comment if replying
  if (parent_id) {
    const parent = db.prepare('SELECT id FROM comments WHERE id = ? AND article_id = ?').get(parent_id, articleId);
    if (!parent) return res.status(404).json({ error: 'Parent comment not found' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO comments (id, article_id, user_id, parent_id, body)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, articleId, req.user.id, parent_id || null, body.trim());

  const comment = db.prepare(`
    SELECT c.*, u.username, u.avatar, 0 as like_count, 0 as reply_count
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `).get(id);

  res.status(201).json({ comment: { ...comment, replies: [], is_liked: false } });
});

// PATCH /api/articles/:articleId/comments/:commentId
router.patch('/:commentId', requireAuth, (req, res) => {
  const { commentId } = req.params;
  const { body } = req.body;

  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.user_id !== req.user.id)
    return res.status(403).json({ error: 'Not your comment' });
  if (!body || body.trim().length < 1)
    return res.status(400).json({ error: 'Body is required' });

  db.prepare('UPDATE comments SET body = ?, is_edited = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(body.trim(), commentId);
  const updated = db.prepare(`
    SELECT c.*, u.username, u.avatar,
      (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id) as like_count
    FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?
  `).get(commentId);

  res.json({ comment: updated });
});

// DELETE /api/articles/:articleId/comments/:commentId
router.delete('/:commentId', requireAuth, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.commentId);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Not authorized' });

  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.commentId);
  res.json({ message: 'Comment deleted' });
});

// POST /api/articles/:articleId/comments/:commentId/like
router.post('/:commentId/like', requireAuth, (req, res) => {
  const { commentId } = req.params;
  const comment = db.prepare('SELECT id FROM comments WHERE id = ?').get(commentId);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  const existing = db.prepare('SELECT * FROM comment_likes WHERE user_id = ? AND comment_id = ?').get(req.user.id, commentId);

  if (existing) {
    db.prepare('DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?').run(req.user.id, commentId);
    db.prepare('UPDATE comments SET likes = likes - 1 WHERE id = ? AND likes > 0').run(commentId);
    res.json({ liked: false });
  } else {
    db.prepare('INSERT INTO comment_likes (user_id, comment_id) VALUES (?, ?)').run(req.user.id, commentId);
    db.prepare('UPDATE comments SET likes = likes + 1 WHERE id = ?').run(commentId);
    res.json({ liked: true });
  }
});

module.exports = router;
