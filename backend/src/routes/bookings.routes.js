const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { notify, notifyRole } = require('../lib/notify');

const router = express.Router();

const DEFAULT_SESSION_MINUTES = 60;

function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

router.post('/', requireAuth, requireRole('student'), (req, res) => {
  const { facility_id, facility, date, start_time, end_time, time, purpose, participants, time_slot_id } = req.body;
  const resolvedStart = start_time || time;
  if ((!facility_id && !facility) || !date || !resolvedStart) {
    return res.status(400).json({ success: false, message: 'facility (or facility_id), date, and time are required' });
  }
  const resolvedEnd = end_time || addMinutes(resolvedStart, DEFAULT_SESSION_MINUTES);

  const facilityRow = facility_id
    ? db.prepare('SELECT * FROM facilities WHERE id = ? AND is_active = 1').get(facility_id)
    : db.prepare('SELECT * FROM facilities WHERE name = ? AND is_active = 1').get(facility);
  if (!facilityRow) return res.status(404).json({ success: false, message: 'Facility not found or inactive' });

  try {
    const result = db.prepare(`
      INSERT INTO bookings (facility_id, user_id, time_slot_id, date, start_time, end_time, purpose, participants)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(facilityRow.id, req.user.sub, time_slot_id || null, date, resolvedStart, resolvedEnd, purpose || null, participants || null);

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);
    notify(req.user.sub, `Your booking for ${facilityRow.name} on ${date} is pending confirmation.`, 'booking');
    notifyRole('officer', `New booking request for ${facilityRow.name} on ${date}.`, 'booking');

    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    if (err.code === 'ERR_SQLITE_ERROR' && /UNIQUE/.test(err.message)) {
      return res.status(409).json({ success: false, message: 'That slot is already booked' });
    }
    throw err;
  }
});

router.get('/', requireAuth, (req, res) => {
  const { facility, status, date } = req.query;
  let sql = `
    SELECT b.*, f.name AS facility_name, u.name AS student_name
    FROM bookings b
    JOIN facilities f ON f.id = b.facility_id
    JOIN users u ON u.id = b.user_id
    WHERE 1=1
  `;
  const params = [];

  if (!['officer', 'admin'].includes(req.user.role)) {
    sql += ' AND b.user_id = ?';
    params.push(req.user.sub);
  }
  if (facility) { sql += ' AND b.facility_id = ?'; params.push(facility); }
  if (status) { sql += ' AND b.status = ?'; params.push(status); }
  if (date) { sql += ' AND b.date = ?'; params.push(date); }
  sql += ' ORDER BY b.date DESC, b.start_time DESC';

  const bookings = db.prepare(sql).all(...params);
  res.json({ success: true, data: bookings });
});

router.get('/:id', requireAuth, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  if (booking.user_id !== req.user.sub && !['officer', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  res.json({ success: true, data: booking });
});

router.put('/:id', requireAuth, requireRole('officer', 'admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Booking not found' });

  const status = req.body.status || existing.status;
  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, req.params.id);

  if (status !== existing.status) {
    notify(existing.user_id, `Your booking on ${existing.date} was ${status}.`, 'booking');
  }

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: booking });
});

router.post('/:id/cancel', requireAuth, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  if (booking.user_id !== req.user.sub && !['officer', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  if (!['pending', 'confirmed'].includes(booking.status)) {
    return res.status(400).json({ success: false, message: `Cannot cancel a booking with status '${booking.status}'` });
  }

  db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(req.params.id);
  const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: updated });
});

module.exports = router;
