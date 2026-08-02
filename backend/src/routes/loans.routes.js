const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { notify, notifyRole } = require('../lib/notify');

const router = express.Router();

router.post('/', requireAuth, requireRole('student'), (req, res) => {
  const { equipment_id, equipment, quantity, returnDate } = req.body;
  const parsedQuantity = parseInt(quantity, 10);
  if ((!equipment_id && !equipment) || !parsedQuantity || parsedQuantity < 1) {
    return res.status(400).json({ success: false, message: 'equipment (or equipment_id) and a positive quantity are required' });
  }

  const equipmentRow = equipment_id
    ? db.prepare('SELECT * FROM equipment WHERE id = ?').get(equipment_id)
    : db.prepare('SELECT * FROM equipment WHERE name = ?').get(equipment);
  if (!equipmentRow) return res.status(404).json({ success: false, message: 'Equipment not found' });

  const result = db.prepare(`
    INSERT INTO equipment_loans (equipment_id, user_id, quantity, due_at)
    VALUES (?, ?, ?, ?)
  `).run(equipmentRow.id, req.user.sub, parsedQuantity, returnDate || null);

  notifyRole('officer', `New equipment loan request for ${equipmentRow.name}.`, 'loan');

  const loan = db.prepare('SELECT * FROM equipment_loans WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: loan });
});

router.get('/', requireAuth, (req, res) => {
  const { status } = req.query;
  let sql = `
    SELECT el.*, e.name AS equipment_name, u.name AS student_name
    FROM equipment_loans el
    JOIN equipment e ON e.id = el.equipment_id
    JOIN users u ON u.id = el.user_id
    WHERE 1=1
  `;
  const params = [];

  if (!['officer', 'admin'].includes(req.user.role)) {
    sql += ' AND el.user_id = ?';
    params.push(req.user.sub);
  }
  if (status) { sql += ' AND el.status = ?'; params.push(status); }
  sql += ' ORDER BY el.requested_at DESC';

  const loans = db.prepare(sql).all(...params);
  res.json({ success: true, data: loans });
});

router.post('/:id/approve', requireAuth, requireRole('officer', 'admin'), (req, res) => {
  try {
    const loan = db.transaction(() => {
      const loanRow = db.prepare("SELECT * FROM equipment_loans WHERE id = ? AND status = 'pending'").get(req.params.id);
      if (!loanRow) throw new HttpError(404, 'Pending loan not found');

      const equipment = db.prepare('SELECT * FROM equipment WHERE id = ?').get(loanRow.equipment_id);
      if (equipment.available_quantity < loanRow.quantity) {
        throw new HttpError(409, 'Not enough stock available to approve this loan');
      }

      db.prepare('UPDATE equipment SET available_quantity = available_quantity - ? WHERE id = ?')
        .run(loanRow.quantity, loanRow.equipment_id);
      db.prepare("UPDATE equipment_loans SET status = 'approved', approved_at = datetime('now') WHERE id = ?")
        .run(req.params.id);

      notify(loanRow.user_id, `Your loan request for ${equipment.name} was approved.`, 'loan');

      return db.prepare('SELECT * FROM equipment_loans WHERE id = ?').get(req.params.id);
    })();

    res.json({ success: true, data: loan });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ success: false, message: err.message });
    throw err;
  }
});

router.post('/:id/reject', requireAuth, requireRole('officer', 'admin'), (req, res) => {
  const { reason } = req.body;
  const loan = db.prepare("SELECT * FROM equipment_loans WHERE id = ? AND status = 'pending'").get(req.params.id);
  if (!loan) return res.status(404).json({ success: false, message: 'Pending loan not found' });

  db.prepare("UPDATE equipment_loans SET status = 'rejected', reject_reason = ? WHERE id = ?")
    .run(reason || null, req.params.id);

  const equipment = db.prepare('SELECT * FROM equipment WHERE id = ?').get(loan.equipment_id);
  notify(loan.user_id, `Your loan request for ${equipment.name} was rejected.`, 'loan');

  const updated = db.prepare('SELECT * FROM equipment_loans WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: updated });
});

router.post('/:id/return', requireAuth, requireRole('officer', 'admin'), (req, res) => {
  try {
    const loan = db.transaction(() => {
      const loanRow = db.prepare(`
        SELECT * FROM equipment_loans WHERE id = ? AND status IN ('approved', 'checked_out')
      `).get(req.params.id);
      if (!loanRow) throw new HttpError(404, 'Active loan not found');

      db.prepare('UPDATE equipment SET available_quantity = available_quantity + ? WHERE id = ?')
        .run(loanRow.quantity, loanRow.equipment_id);
      db.prepare("UPDATE equipment_loans SET status = 'returned', returned_at = datetime('now') WHERE id = ?")
        .run(req.params.id);

      const equipment = db.prepare('SELECT * FROM equipment WHERE id = ?').get(loanRow.equipment_id);
      notifyRole('officer', `${equipment.name} was checked in (returned).`, 'loan');

      return db.prepare('SELECT * FROM equipment_loans WHERE id = ?').get(req.params.id);
    })();

    res.json({ success: true, data: loan });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ success: false, message: err.message });
    throw err;
  }
});

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = router;
