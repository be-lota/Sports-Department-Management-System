const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const findUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const insertUser = db.prepare(`
  INSERT INTO users (name, email, password_hash, role)
  VALUES (?, ?, ?, ?)
`);

function toPublicUser(user) {
  const { password_hash, ...publicUser } = user;
  return publicUser;
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
}

router.post('/register', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !['student', 'officer', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Missing or invalid fields' });
  }
  if (findUserByEmail.get(email)) {
    return res.status(409).json({ success: false, message: 'Email already registered' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = insertUser.run(name, email, passwordHash, role);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json({ success: true, data: { user: toPublicUser(user) } });
});

router.post('/login', (req, res) => {
  const { email, password, role } = req.body;
  const user = findUserByEmail.get(email);

  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }
  if (role && user.role !== role) {
    return res.status(401).json({ success: false, message: 'Account is not registered under that role' });
  }

  const token = signToken(user);
  res.json({ success: true, data: { token, user: toPublicUser(user) } });
});

router.post('/logout', requireAuth, (req, res) => {
  res.json({ success: true, data: null });
});

router.get('/verify', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);
  if (!user) return res.status(401).json({ success: false, message: 'User no longer exists' });
  res.json({ success: true, data: { user: toPublicUser(user) } });
});

module.exports = router;
