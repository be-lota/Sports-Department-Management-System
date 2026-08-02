const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { requireAuth, requireRole, selfOrRole } = require('../middleware/auth');

const router = express.Router();

function toPublicUser(user) {
  const { password_hash, ...publicUser } = user;
  return publicUser;
}

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);
  res.json({ success: true, data: toPublicUser(user) });
});

router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const { role } = req.query;
  const users = role
    ? db.prepare('SELECT * FROM users WHERE role = ? ORDER BY name').all(role)
    : db.prepare('SELECT * FROM users ORDER BY name').all();
  res.json({ success: true, data: users.map(toPublicUser) });
});

router.get('/:id', requireAuth, selfOrRole('officer', 'admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: toPublicUser(user) });
});

router.put('/:id', requireAuth, selfOrRole('admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'User not found' });

  const merged = { ...existing, ...req.body };
  db.prepare('UPDATE users SET name = ?, profile_image = ? WHERE id = ?')
    .run(merged.name, merged.profile_image, req.params.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: toPublicUser(user) });
});

router.put('/:id/role', requireAuth, requireRole('admin'), (req, res) => {
  const { role } = req.body;
  if (!['student', 'officer', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, message: 'role must be student, officer, or admin' });
  }

  const result = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'User not found' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: toPublicUser(user) });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);

  if (!bcrypt.compareSync(currentPassword || '', user.password_hash)) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.sub);
  res.json({ success: true, data: null });
});

module.exports = router;
