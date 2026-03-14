const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/schema');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// POST /api/newsletter/subscribe
router.post('/subscribe', optionalAuth, (req, res) => {
  const { email, categories } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Valid email required' });

  const existing = db.prepare('SELECT * FROM subscribers WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    if (existing.is_active) return res.status(409).json({ error: 'Already subscribed' });
    db.prepare('UPDATE subscribers SET is_active = 1, categories = ? WHERE email = ?').run(
      JSON.stringify(categories || ['all']), email.toLowerCase()
    );
    return res.json({ message: 'Subscription reactivated' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO subscribers (id, email, user_id, categories)
    VALUES (?, ?, ?, ?)
  `).run(id, email.toLowerCase(), req.user?.id || null, JSON.stringify(categories || ['all']));

  res.status(201).json({ message: 'Subscribed successfully' });
});

// DELETE /api/newsletter/unsubscribe
router.post('/unsubscribe', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  db.prepare('UPDATE subscribers SET is_active = 0 WHERE email = ?').run(email.toLowerCase());
  res.json({ message: 'Unsubscribed successfully' });
});

module.exports = router;
