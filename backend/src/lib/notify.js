const { db } = require('../db');

const insertNotification = db.prepare(`
  INSERT INTO notifications (user_id, message, type)
  VALUES (?, ?, ?)
`);

function notify(userId, message, type = 'system') {
  insertNotification.run(userId, message, type);
}

function notifyRole(role, message, type = 'system') {
  const users = db.prepare('SELECT id FROM users WHERE role = ?').all(role);
  for (const u of users) insertNotification.run(u.id, message, type);
}

module.exports = { notify, notifyRole };
