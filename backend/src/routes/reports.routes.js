const express = require('express');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const QUERIES = {
  bookings: `
    SELECT b.id, b.date, b.start_time, b.end_time, b.status, b.purpose,
           f.name AS facility_name, u.name AS user_name
    FROM bookings b
    JOIN facilities f ON f.id = b.facility_id
    JOIN users u ON u.id = b.user_id
    WHERE b.date BETWEEN ? AND ?
    ORDER BY b.date DESC
  `,
  equipment: `
    SELECT el.id, el.quantity, el.status, el.requested_at, el.returned_at,
           e.name AS equipment_name, u.name AS user_name
    FROM equipment_loans el
    JOIN equipment e ON e.id = el.equipment_id
    JOIN users u ON u.id = el.user_id
    WHERE date(el.requested_at) BETWEEN ? AND ?
    ORDER BY el.requested_at DESC
  `,
  users: `
    SELECT id, name, email, role, created_at
    FROM users
    WHERE date(created_at) BETWEEN ? AND ?
    ORDER BY created_at DESC
  `,
};

function runReport(type, from, to) {
  const query = QUERIES[type];
  if (!query) return null;
  return db.prepare(query).all(from || '0000-01-01', to || '9999-12-31');
}

function toCsv(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map(h => escape(row[h])).join(','));
  return lines.join('\n');
}

router.post('/generate', requireAuth, requireRole('officer', 'admin'), (req, res) => {
  const { type, from, to } = req.body;
  const rows = runReport(type, from, to);
  if (!rows) return res.status(400).json({ success: false, message: 'type must be bookings, equipment, or users' });
  res.json({ success: true, data: rows });
});

router.get('/export', requireAuth, requireRole('officer', 'admin'), async (req, res) => {
  const { type, format = 'csv', from, to } = req.query;
  const rows = runReport(type, from, to);
  if (!rows) return res.status(400).json({ success: false, message: 'type must be bookings, equipment, or users' });

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-report.csv`);
    return res.send(toCsv(rows));
  }

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(type);
    if (rows.length) {
      sheet.columns = Object.keys(rows[0]).map(key => ({ header: key, key, width: 20 }));
      sheet.addRows(rows);
      sheet.getRow(1).font = { bold: true };
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-report.xlsx`);
    await workbook.xlsx.write(res);
    return res.end();
  }

  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-report.pdf`);

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    doc.pipe(res);

    doc.fontSize(16).text(`${type[0].toUpperCase()}${type.slice(1)} Report`, { align: 'center' });
    doc.moveDown();

    if (rows.length) {
      const headers = Object.keys(rows[0]);
      const colWidth = (doc.page.width - 80) / headers.length;

      doc.fontSize(9).font('Helvetica-Bold');
      headers.forEach((h, i) => doc.text(h, 40 + i * colWidth, doc.y, { width: colWidth, continued: false }));
      doc.moveDown(0.5);

      doc.font('Helvetica');
      rows.forEach(row => {
        const y = doc.y;
        headers.forEach((h, i) => doc.text(String(row[h] ?? ''), 40 + i * colWidth, y, { width: colWidth }));
        doc.moveDown(0.5);
        if (doc.y > doc.page.height - 60) doc.addPage();
      });
    } else {
      doc.fontSize(11).text('No data for the selected range.');
    }

    doc.end();
    return;
  }

  res.status(400).json({ success: false, message: 'format must be csv, xlsx, or pdf' });
});

module.exports = router;
