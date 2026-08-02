const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireRole('officer', 'admin'), (req, res) => {
  const { from = '0000-01-01', to = '9999-12-31' } = req.query;

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM bookings WHERE date BETWEEN ? AND ?) AS total_bookings,
      (SELECT COUNT(*) FROM bookings WHERE status = 'pending') AS pending_bookings,
      (SELECT COUNT(*) FROM equipment_loans WHERE status = 'pending') AS pending_loans,
      (SELECT COUNT(*) FROM equipment_loans WHERE status IN ('approved', 'checked_out')) AS active_loans,
      (SELECT COUNT(*) FROM users WHERE role = 'student') AS total_students,
      (SELECT COUNT(*) FROM complaints WHERE status = 'open') AS open_complaints
  `).get(from, to);

  res.json({ success: true, data: stats });
});

module.exports = router;
