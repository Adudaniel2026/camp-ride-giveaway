'use strict';
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const app = express();

app.set('trust proxy', 1);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const adminPassword = process.env.ADMIN_PASSWORD;
const sessionSecret = process.env.SESSION_SECRET;

if (!adminPassword || !sessionSecret) {
  console.error('Set ADMIN_PASSWORD and SESSION_SECRET in your .env file.');
  process.exit(1);
}
if (isProduction && sessionSecret.length < 32) {
  console.error('In production, SESSION_SECRET must be at least 32 characters.');
  process.exit(1);
}

const dbFile = process.env.DATABASE_FILE || './data/camp-ride.sqlite';
fs.mkdirSync(path.dirname(path.resolve(dbFile)), { recursive: true });
const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    student_id TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const passwordHash = bcrypt.hashSync(adminPassword, 12);
app.use(helmet());
app.use(express.json({ limit: '20kb' }));
app.use(session({
  name: 'camp.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'strict', secure: isProduction, maxAge: 2 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

const registerLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });

function csrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = require('crypto').randomBytes(24).toString('hex');
  }
  return req.session.csrfToken;
}
function requireCsrf(req, res, next) {
  if (!req.session.csrfToken || req.get('x-csrf-token') !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Session expired. Refresh the page and try again.' });
  }
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.status(401).json({ error: 'Please sign in.' });
  next();
}

app.get('/api/config', (req, res) => res.json({ csrfToken: csrfToken(req) }));

app.post('/api/register', registerLimiter, (req, res) => {
  const fullName = String(req.body.fullName || '').trim();
  const studentId = String(req.body.studentId || '').trim().toUpperCase();
  const phone = String(req.body.phone || '').trim().replace(/[()\s-]/g, '');
  const consent = req.body.consent === true;

  if (!consent) return res.status(400).json({ error: 'Please confirm that you agree to the registration notice.' });
  if (fullName.length < 2 || fullName.length > 100) return res.status(400).json({ error: 'Enter a valid full name.' });
  if (!/^[A-Za-z0-9/-]{3,30}$/.test(studentId)) return res.status(400).json({ error: 'Enter a valid student ID.' });
  if (!/^(\+233|0)\d{9}$/.test(phone)) return res.status(400).json({ error: 'Enter a Ghanaian phone number, e.g. 0241234567 or +233241234567.' });

  try {
    const result = db.prepare('INSERT INTO registrations (full_name, student_id, phone) VALUES (?, ?, ?)')
      .run(fullName, studentId, phone);
    res.status(201).json({ message: 'Registration received. Thank you for participating!', id: result.lastInsertRowid });
  } catch (err) {
    if (String(err.code).includes('SQLITE_CONSTRAINT')) return res.status(409).json({ error: 'This student ID has already been registered.' });
    console.error(err);
    res.status(500).json({ error: 'Unable to save registration right now.' });
  }
});

app.post('/api/admin/login', loginLimiter, requireCsrf, (req, res, next) => {
  if (!bcrypt.compareSync(String(req.body.password || ''), passwordHash)) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  req.session.regenerate(err => {
    if (err) return next(err);
    req.session.isAdmin = true;
    req.session.csrfToken = require('crypto').randomBytes(24).toString('hex');
    req.session.save(err2 => {
      if (err2) return next(err2);
      res.json({ message: 'Signed in.', csrfToken: req.session.csrfToken });
    });
  });
});

app.get('/api/admin/me', (req, res) => res.json({ authenticated: !!req.session.isAdmin, csrfToken: csrfToken(req) }));
app.get('/api/admin/summary', requireAdmin, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS total FROM registrations').get().total;
  res.json({ total });
});
app.get('/api/admin/registrations', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT id, full_name AS fullName, student_id AS studentId, phone, created_at AS createdAt FROM registrations ORDER BY id DESC').all();
  res.json({ registrations: rows });
});
app.get('/api/admin/export.csv', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT full_name, student_id, phone, created_at FROM registrations ORDER BY id DESC').all();
  const quote = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
  const csv = ['Full name,Student ID,Phone,Registered at', ...rows.map(r => [r.full_name, r.student_id, r.phone, r.created_at].map(quote).join(','))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="camp-ride-registrations.csv"');
  res.send('\uFEFF' + csv);
});
app.post('/api/admin/logout', requireAdmin, requireCsrf, (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie('camp.sid');
    res.json({ message: 'Signed out.' });
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

app.listen(PORT, () => console.log(`CAMP RIDE GIVEAWAY is running at http://localhost:${PORT}`));
