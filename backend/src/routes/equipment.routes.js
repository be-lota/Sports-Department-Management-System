const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function withStatus(row) {
  let status = 'in_stock';
  if (row.available_quantity <= 0) status = 'out_of_stock';
  else if (row.available_quantity <= row.total_quantity * 0.2) status = 'low_stock';
  return { ...row, status };
}

router.get('/', (req, res) => {
  const { category, search } = req.query;
  let sql = 'SELECT * FROM equipment WHERE 1=1';
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

  const equipment = db.prepare(sql).all(...params).map(withStatus);
  res.json({ success: true, data: equipment });
});

router.get('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Equipment not found' });
  res.json({ success: true, data: withStatus(item) });
});

router.post('/', requireAuth, requireRole('officer', 'admin'), (req, res) => {
  const { name, category, image, total_quantity } = req.body;
  if (!name || !category || total_quantity == null) {
    return res.status(400).json({ success: false, message: 'name, category, total_quantity are required' });
  }

  const result = db.prepare(`
    INSERT INTO equipment (name, category, image, total_quantity, available_quantity)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, category, image || null, total_quantity, total_quantity);

  const item = db.prepare('SELECT * FROM equipment WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: withStatus(item) });
});

router.put('/:id', requireAuth, requireRole('officer', 'admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Equipment not found' });

  const merged = { ...existing, ...req.body };
  db.prepare(`
    UPDATE equipment SET name = ?, category = ?, image = ?, total_quantity = ?, available_quantity = ?
    WHERE id = ?
  `).run(merged.name, merged.category, merged.image, merged.total_quantity, merged.available_quantity, req.params.id);

  const item = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: withStatus(item) });
});

module.exports = router;
