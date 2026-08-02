const express = require('express');
const { db } = require('../db');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, (req, res) => {
  const { category, search } = req.query;
  const canSeeInactive = req.user && ['officer', 'admin'].includes(req.user.role);
  let sql = canSeeInactive ? 'SELECT * FROM facilities WHERE 1=1' : 'SELECT * FROM facilities WHERE is_active = 1';
  const params = [];

  if (category && category !== 'all') {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (search) {
    sql += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }
  sql += ' ORDER BY name';

  const facilities = db.prepare(sql).all(...params);
  res.json({ success: true, data: facilities });
});

router.get('/:id', (req, res) => {
  const facility = db.prepare('SELECT * FROM facilities WHERE id = ?').get(req.params.id);
  if (!facility) return res.status(404).json({ success: false, message: 'Facility not found' });
  res.json({ success: true, data: facility });
});

router.post('/', requireAuth, requireRole('officer', 'admin'), (req, res) => {
  const { name, category, description, image, capacity } = req.body;
  if (!name || !category) {
    return res.status(400).json({ success: false, message: 'name and category are required' });
  }
  const result = db.prepare(`
    INSERT INTO facilities (name, category, description, image, capacity)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, category, description || null, image || null, capacity || null);

  const facility = db.prepare('SELECT * FROM facilities WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: facility });
});

router.put('/:id', requireAuth, requireRole('officer', 'admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM facilities WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Facility not found' });

  const merged = { ...existing, ...req.body };
  db.prepare(`
    UPDATE facilities SET name = ?, category = ?, description = ?, image = ?, capacity = ?, is_active = ?
    WHERE id = ?
  `).run(merged.name, merged.category, merged.description, merged.image, merged.capacity, merged.is_active, req.params.id);

  const facility = db.prepare('SELECT * FROM facilities WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: facility });
});

router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const result = db.prepare('DELETE FROM facilities WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'Facility not found' });
  res.json({ success: true, data: null });
});

module.exports = router;
