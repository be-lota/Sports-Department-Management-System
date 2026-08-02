require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { migrate } = require('./db');

migrate();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/facilities', require('./routes/facilities.routes'));
app.use('/api/time-slots', require('./routes/timeSlots.routes'));
app.use('/api/bookings', require('./routes/bookings.routes'));
app.use('/api/equipment', require('./routes/equipment.routes'));
app.use('/api/loans', require('./routes/loans.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/notifications', require('./routes/notifications.routes'));
app.use('/api/analytics', require('./routes/analytics.routes'));
app.use('/api/reports', require('./routes/reports.routes'));
app.use('/api/complaints', require('./routes/complaints.routes'));

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Sports Department backend listening on http://localhost:${PORT}`);
});
