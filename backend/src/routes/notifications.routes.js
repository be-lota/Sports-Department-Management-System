const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { notify, notifyRole } = require('../lib/notify');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC
  `).all(req.user.sub);
  res.json({ success: true, data: notifications });
});

router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const { audience, message } = req.body;
  if (!message || !['all', 'students', 'officers'].includes(audience)) {
    return res.status(400).json({ success: false, message: 'audience (all|students|officers) and message are required' });
  }

  if (audience === 'all') {
    const users = db.prepare('SELECT id FROM users').all();
    for (const u of users) notify(u.id, message, 'system');
  } else {
    notifyRole(audience === 'students' ? 'student' : 'officer', message, 'system');
  }

  res.status(201).json({ success: true, data: null });
});

router.post('/:id/read', requireAuth, (req, res) => {
  const result = db.prepare(`
    UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?
  `).run(req.params.id, req.user.sub);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'Notification not found' });
  res.json({ success: true, data: null });
});

router.post('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.sub);
  res.json({ success: true, data: null });
});

module.exports = router;
