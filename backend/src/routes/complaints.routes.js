const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/', requireAuth, (req, res) => {
  const { subject, message } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ success: false, message: 'subject and message are required' });
  }

  const result = db.prepare(`
    INSERT INTO complaints (user_id, subject, message)
    VALUES (?, ?, ?)
  `).run(req.user.sub, subject, message);

  const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: complaint });
});

router.get('/', requireAuth, (req, res) => {
  const { status } = req.query;
  let sql = `
    SELECT c.*, u.name AS student_name
    FROM complaints c
    JOIN users u ON u.id = c.user_id
    WHERE 1=1
  `;
  const params = [];

  if (!['officer', 'admin'].includes(req.user.role)) {
    sql += ' AND c.user_id = ?';
    params.push(req.user.sub);
  }
  if (status) { sql += ' AND c.status = ?'; params.push(status); }
  sql += ' ORDER BY c.created_at DESC';

  const complaints = db.prepare(sql).all(...params);
  res.json({ success: true, data: complaints });
});

router.put('/:id', requireAuth, requireRole('officer', 'admin'), (req, res) => {
  const { status } = req.body;
  if (!['open', 'in_progress', 'resolved'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const result = db.prepare('UPDATE complaints SET status = ? WHERE id = ?').run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'Complaint not found' });

  const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: complaint });
});

module.exports = router;
