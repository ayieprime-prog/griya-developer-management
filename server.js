const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { v4: uuidv4 } = require('uuid');
const { validationResult, body } = require('express-validator');
const { EventEmitter } = require('events');
require('dotenv').config();

// Import helpers and validators
const {
  generateId,
  generateCsrfToken,
  csrfValid,
  formatCurrency,
  formatDate,
  formatDateInput,
  hitungTipeDeveloper,
  statusBadge,
  ROLE_LABELS,
  JENIS_DOKUMEN_KERJASAMA,
  CHECKLIST_KERJASAMA_DEVELOPER
} = require('./lib/helpers');

const {
  loginValidators,
  developerValidators,
  developerPegurusValidators,
  developerProyekValidatorsEnhanced,
  developerUnitValidators,
  kerjasamaDeveloperValidators,
  verifikasiValidators,
  keputusanValidators,
  JENIS_OBJEK_VALUES,
  LEGALITAS_TANAH_VALUES,
  KONDISI_BANGUNAN_VALUES,
  CAKUPAN_WILAYAH_VALUES
} = require('./lib/validators');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize database
const dbPath = process.env.DB_PATH || path.join(__dirname, 'db', 'kpr.db');
let db;

try {
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  console.log('✓ Database connected');

  // Auto-initialize database if empty
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count === 0) {
      console.log('📊 Initializing database with schema & seed data...');
      const initScript = require('./db/init.js');
      console.log('✓ Database initialized');
    }
  } catch (err) {
    // Tables don't exist yet, initialize
    console.log('📊 Creating database schema & seed data...');
    const initScript = require('./db/init.js');
    console.log('✓ Database initialized');
  }
} catch (err) {
  console.error('✗ Database connection failed:', err.message);
  process.exit(1);
}

// Session store class
class SqliteSessionStore extends EventEmitter {
  constructor(db) {
    super();
    this.db = db;
  }

  get(sid, callback) {
    try {
      const stmt = this.db.prepare('SELECT sess FROM sessions WHERE sid = ?');
      const row = stmt.get(sid);
      if (row) {
        callback(null, JSON.parse(row.sess));
      } else {
        callback(null, null);
      }
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sess, callback) {
    try {
      const expire = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
      const sessJson = JSON.stringify(sess);
      const stmt = this.db.prepare(
        'INSERT OR REPLACE INTO sessions (sid, sess, expire) VALUES (?, ?, ?)'
      );
      stmt.run(sid, sessJson, expire);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      const stmt = this.db.prepare('DELETE FROM sessions WHERE sid = ?');
      stmt.run(sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  createSession(req, sess) {
    const sid = req.sessionID;
    return Object.assign({}, sess, { sid, cookie: sess.cookie });
  }

  touch(sid, sess, callback) {
    try {
      const expire = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
      const stmt = this.db.prepare('UPDATE sessions SET expire = ? WHERE sid = ?');
      stmt.run(expire, sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }
}

// Middleware setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration (use memory store for development)
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Express configuration
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CSRF token generation middleware
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

// Setup app.locals with helpers
app.locals.formatCurrency = formatCurrency;
app.locals.formatDate = formatDate;
app.locals.statusBadge = statusBadge;
app.locals.ROLE_LABELS = ROLE_LABELS;
app.locals.JENIS_OBJEK_VALUES = JENIS_OBJEK_VALUES;
app.locals.LEGALITAS_TANAH_VALUES = LEGALITAS_TANAH_VALUES;
app.locals.KONDISI_BANGUNAN_VALUES = KONDISI_BANGUNAN_VALUES;
app.locals.CAKUPAN_WILAYAH_VALUES = CAKUPAN_WILAYAH_VALUES;

// Middleware: User availability in views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success = req.session.success || null;
  res.locals.error = req.session.error || null;
  delete req.session.success;
  delete req.session.error;
  next();
});

// Middleware: Authentication check
function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.session.redirectTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
}

// Middleware: Role-based access control
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    if (!roles.includes(req.session.user.role) && req.session.user.role !== 'admin') {
      req.session.error = 'Anda tidak memiliki akses ke halaman ini.';
      return res.redirect('/dashboard');
    }
    next();
  };
}

// ============================================
// Public Routes (No Authentication Required)
// ============================================

// GET /login
app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('login', { error: null });
});

// POST /login
app.post('/login', loginValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('login', { error: 'Username dan password harus diisi.' });
  }

  try {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1');
    const user = stmt.get(req.body.username);

    if (!user) {
      return res.render('login', { error: 'Username atau password salah.' });
    }

    const passwordMatch = await bcrypt.compare(req.body.password, user.password);
    if (!passwordMatch) {
      return res.render('login', { error: 'Username atau password salah.' });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      nama_lengkap: user.nama_lengkap,
      role: user.role,
      email: user.email,
      cabang: user.cabang
    };

    const redirectTo = req.session.redirectTo || '/dashboard';
    delete req.session.redirectTo;

    catatAuditSistem(user.id, 'LOGIN', `User ${user.username} login`);
    res.redirect(redirectTo);
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', { error: 'Terjadi kesalahan saat login.' });
  }
});

// GET /logout
app.get('/logout', (req, res) => {
  if (req.session.user) {
    catatAuditSistem(req.session.user.id, 'LOGOUT', `User ${req.session.user.username} logout`);
  }
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// ============================================
// Protected Routes (Authentication Required)
// ============================================

// GET /dashboard
app.get('/dashboard', requireLogin, (req, res) => {
  try {
    // Get statistics
    const stats = {
      totalKerjasama: 0,
      disetujui: 0,
      menungguVerifikasi: 0,
      ditolak: 0
    };

    const countStmt = db.prepare('SELECT status, COUNT(*) as count FROM kerjasama_developer GROUP BY status');
    const rows = countStmt.all();

    rows.forEach(row => {
      stats.totalKerjasama += row.count;
      if (row.status === 'Disetujui') stats.disetujui = row.count;
      if (row.status === 'Verifikasi') stats.menungguVerifikasi = row.count;
      if (row.status === 'Ditolak') stats.ditolak = row.count;
    });

    res.render('dashboard', { stats });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.render('dashboard', { stats: {} });
  }
});

// ============================================
// Developer Module Routes (Database Developer)
// ============================================

// GET /developer - List developers
app.get('/developer', requireLogin, (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM developer ORDER BY created_at DESC');
    const developers = stmt.all();
    res.render('developer/list', { developers });
  } catch (err) {
    console.error('Developer list error:', err);
    req.session.error = 'Terjadi kesalahan saat memuat data developer.';
    res.redirect('/dashboard');
  }
});

// GET /developer/new - Create developer form
app.get('/developer/new', requireLogin, requireRole('admin', 'account_officer'), (req, res) => {
  res.render('developer/form', { developer: null, action: 'Tambah' });
});

// POST /developer - Create new developer
app.post('/developer', requireLogin, requireRole('admin', 'account_officer'), developerValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorArray = errors.array().map(e => e.msg);
    return res.render('developer/form', {
      developer: req.body,
      action: 'Tambah',
      errors: errorArray
    });
  }

  try {
    if (!csrfValid(req)) {
      req.session.error = 'CSRF token tidak valid.';
      return res.redirect('/developer');
    }

    const developerId = generateId();
    const stmt = db.prepare(`
      INSERT INTO developer (
        id, nama, legalitas, nomor_akta_pendirian, tanggal_akta_pendirian,
        notaris_nama, notaris_nib, sk_menkumham_nomor, sk_menkumham_tanggal,
        situs_web, email, no_telepon, alamat_kantor, kota, provinsi,
        status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    stmt.run(
      developerId,
      req.body.nama,
      req.body.legalitas || null,
      req.body.nomor_akta_pendirian || null,
      req.body.tanggal_akta_pendirian || null,
      req.body.notaris_nama || null,
      req.body.notaris_nib || null,
      req.body.sk_menkumham_nomor || null,
      req.body.sk_menkumham_tanggal || null,
      req.body.situs_web || null,
      req.body.email || null,
      req.body.no_telepon || null,
      req.body.alamat_kantor || null,
      req.body.kota || null,
      req.body.provinsi || null,
      'Aktif',
      req.session.user.id
    );

    catatAuditSistem(req.session.user.id, 'CREATE_DEVELOPER', `Developer ${req.body.nama} dibuat`);
    req.session.success = 'Developer berhasil ditambahkan.';
    res.redirect(`/developer/${developerId}`);
  } catch (err) {
    console.error('Developer create error:', err);
    req.session.error = 'Terjadi kesalahan saat membuat developer.';
    res.redirect('/developer');
  }
});

// GET /developer/:id - View developer detail
app.get('/developer/:id', requireLogin, (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM developer WHERE id = ?');
    const developer = stmt.get(req.params.id);

    if (!developer) {
      req.session.error = 'Developer tidak ditemukan.';
      return res.redirect('/developer');
    }

    // Get pengurus
    const pegurusStmt = db.prepare('SELECT * FROM developer_pengurus WHERE developer_id = ? ORDER BY created_at DESC');
    const pengurus = pegurusStmt.all(req.params.id);

    // Get proyek
    const proyekStmt = db.prepare('SELECT * FROM developer_proyek WHERE developer_id = ? ORDER BY created_at DESC');
    const proyek = proyekStmt.all(req.params.id);

    // Get unit (with tipe calculation)
    const unitStmt = db.prepare(`
      SELECT du.*, dp.nama_proyek
      FROM developer_unit du
      LEFT JOIN developer_proyek dp ON du.developer_proyek_id = dp.id
      WHERE dp.developer_id = ?
      ORDER BY du.created_at DESC
    `);
    const units = unitStmt.all(req.params.id);

    res.render('developer/detail', {
      developer,
      pengurus,
      proyek,
      units,
      hitungTipeDeveloper
    });
  } catch (err) {
    console.error('Developer detail error:', err);
    req.session.error = 'Terjadi kesalahan.';
    res.redirect('/developer');
  }
});

// GET /developer/:id/edit - Edit developer form
app.get('/developer/:id/edit', requireLogin, requireRole('admin', 'account_officer'), (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM developer WHERE id = ?');
    const developer = stmt.get(req.params.id);

    if (!developer) {
      req.session.error = 'Developer tidak ditemukan.';
      return res.redirect('/developer');
    }

    res.render('developer/form', { developer, action: 'Edit' });
  } catch (err) {
    console.error('Developer edit form error:', err);
    req.session.error = 'Terjadi kesalahan.';
    res.redirect('/developer');
  }
});

// POST /developer/:id - Update developer
app.post('/developer/:id', requireLogin, requireRole('admin', 'account_officer'), developerValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorArray = errors.array().map(e => e.msg);
    return res.render('developer/form', {
      developer: { ...req.body, id: req.params.id },
      action: 'Edit',
      errors: errorArray
    });
  }

  try {
    if (!csrfValid(req)) {
      req.session.error = 'CSRF token tidak valid.';
      return res.redirect(`/developer/${req.params.id}`);
    }

    const stmt = db.prepare(`
      UPDATE developer SET
        nama = ?, legalitas = ?, nomor_akta_pendirian = ?, tanggal_akta_pendirian = ?,
        notaris_nama = ?, notaris_nib = ?, sk_menkumham_nomor = ?, sk_menkumham_tanggal = ?,
        situs_web = ?, email = ?, no_telepon = ?, alamat_kantor = ?, kota = ?, provinsi = ?,
        updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      req.body.nama,
      req.body.legalitas || null,
      req.body.nomor_akta_pendirian || null,
      req.body.tanggal_akta_pendirian || null,
      req.body.notaris_nama || null,
      req.body.notaris_nib || null,
      req.body.sk_menkumham_nomor || null,
      req.body.sk_menkumham_tanggal || null,
      req.body.situs_web || null,
      req.body.email || null,
      req.body.no_telepon || null,
      req.body.alamat_kantor || null,
      req.body.kota || null,
      req.body.provinsi || null,
      req.session.user.id,
      req.params.id
    );

    catatAuditSistem(req.session.user.id, 'UPDATE_DEVELOPER', `Developer ${req.body.nama} diperbarui`);
    req.session.success = 'Developer berhasil diperbarui.';
    res.redirect(`/developer/${req.params.id}`);
  } catch (err) {
    console.error('Developer update error:', err);
    req.session.error = 'Terjadi kesalahan saat mengupdate developer.';
    res.redirect(`/developer/${req.params.id}`);
  }
});

// POST /developer/:id/delete - Soft delete developer
app.post('/developer/:id/delete', requireLogin, requireRole('admin'), (req, res) => {
  try {
    if (!csrfValid(req)) {
      req.session.error = 'CSRF token tidak valid.';
      return res.redirect('/developer');
    }

    const stmt = db.prepare('UPDATE developer SET status = ? WHERE id = ?');
    stmt.run('Nonaktif', req.params.id);

    catatAuditSistem(req.session.user.id, 'DELETE_DEVELOPER', `Developer dengan ID ${req.params.id} dihapus`);
    req.session.success = 'Developer berhasil dihapus.';
    res.redirect('/developer');
  } catch (err) {
    console.error('Developer delete error:', err);
    req.session.error = 'Terjadi kesalahan saat menghapus developer.';
    res.redirect('/developer');
  }
});

// ============================================
// Developer Pengurus Sub-routes
// ============================================

// POST /developer/:id/pengurus - Add pengurus
app.post('/developer/:id/pengurus', requireLogin, requireRole('admin', 'account_officer'), developerPegurusValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.session.error = errors.array()[0].msg;
    return res.redirect(`/developer/${req.params.id}`);
  }

  try {
    if (!csrfValid(req)) {
      req.session.error = 'CSRF token tidak valid.';
      return res.redirect(`/developer/${req.params.id}`);
    }

    const pegurusId = generateId();
    const stmt = db.prepare(`
      INSERT INTO developer_pengurus (id, developer_id, nama, jabatan, nik, alamat, no_hp, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(
      pegurusId,
      req.params.id,
      req.body.nama,
      req.body.jabatan,
      req.body.nik || null,
      req.body.alamat || null,
      req.body.no_hp || null
    );

    catatAuditSistem(req.session.user.id, 'CREATE_PENGURUS', `Pengurus ${req.body.nama} ditambahkan`);
    req.session.success = 'Pengurus berhasil ditambahkan.';
    res.redirect(`/developer/${req.params.id}`);
  } catch (err) {
    console.error('Add pengurus error:', err);
    req.session.error = 'Terjadi kesalahan saat menambah pengurus.';
    res.redirect(`/developer/${req.params.id}`);
  }
});

// POST /developer/:id/pengurus/:pegurusId/edit - Edit pengurus
app.post('/developer/:id/pengurus/:pegurusId/edit', requireLogin, requireRole('admin', 'account_officer'), developerPegurusValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.session.error = errors.array()[0].msg;
    return res.redirect(`/developer/${req.params.id}`);
  }

  try {
    if (!csrfValid(req)) {
      req.session.error = 'CSRF token tidak valid.';
      return res.redirect(`/developer/${req.params.id}`);
    }

    const stmt = db.prepare(`
      UPDATE developer_pengurus SET nama = ?, jabatan = ?, nik = ?, alamat = ?, no_hp = ?
      WHERE id = ? AND developer_id = ?
    `);

    stmt.run(
      req.body.nama,
      req.body.jabatan,
      req.body.nik || null,
      req.body.alamat || null,
      req.body.no_hp || null,
      req.params.pegurusId,
      req.params.id
    );

    catatAuditSistem(req.session.user.id, 'UPDATE_PENGURUS', `Pengurus ${req.body.nama} diperbarui`);
    req.session.success = 'Pengurus berhasil diperbarui.';
    res.redirect(`/developer/${req.params.id}`);
  } catch (err) {
    console.error('Edit pengurus error:', err);
    req.session.error = 'Terjadi kesalahan saat mengupdate pengurus.';
    res.redirect(`/developer/${req.params.id}`);
  }
});

// POST /developer/:id/pengurus/:pegurusId/delete - Delete pengurus
app.post('/developer/:id/pengurus/:pegurusId/delete', requireLogin, requireRole('admin'), (req, res) => {
  try {
    if (!csrfValid(req)) {
      req.session.error = 'CSRF token tidak valid.';
      return res.redirect(`/developer/${req.params.id}`);
    }

    const stmt = db.prepare('DELETE FROM developer_pengurus WHERE id = ? AND developer_id = ?');
    stmt.run(req.params.pegurusId, req.params.id);

    catatAuditSistem(req.session.user.id, 'DELETE_PENGURUS', `Pengurus dengan ID ${req.params.pegurusId} dihapus`);
    req.session.success = 'Pengurus berhasil dihapus.';
    res.redirect(`/developer/${req.params.id}`);
  } catch (err) {
    console.error('Delete pengurus error:', err);
    req.session.error = 'Terjadi kesalahan saat menghapus pengurus.';
    res.redirect(`/developer/${req.params.id}`);
  }
});

// ============================================
// Developer Proyek Sub-routes
// ============================================

// POST /developer/:id/proyek - Add proyek
app.post('/developer/:id/proyek', requireLogin, requireRole('admin', 'account_officer'), developerProyekValidatorsEnhanced, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.session.error = errors.array()[0].msg;
    return res.redirect(`/developer/${req.params.id}`);
  }

  try {
    if (!csrfValid(req)) {
      req.session.error = 'CSRF token tidak valid.';
      return res.redirect(`/developer/${req.params.id}`);
    }

    const proyekId = generateId();
    const stmt = db.prepare(`
      INSERT INTO developer_proyek (
        id, developer_id, nama_proyek, nama_perumahan, key_person_nama, key_person_jabatan,
        key_person_no_hp, bukti_kepemilikan, lokasi_proyek, kota, provinsi, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    stmt.run(
      proyekId,
      req.params.id,
      req.body.nama_proyek,
      req.body.nama_perumahan || null,
      req.body.key_person_nama || null,
      req.body.key_person_jabatan || null,
      req.body.key_person_no_hp || null,
      req.body.bukti_kepemilikan || null,
      req.body.lokasi_proyek || null,
      req.body.kota || null,
      req.body.provinsi || null
    );

    catatAuditSistem(req.session.user.id, 'CREATE_PROYEK', `Proyek ${req.body.nama_proyek} ditambahkan`);
    req.session.success = 'Proyek berhasil ditambahkan.';
    res.redirect(`/developer/${req.params.id}`);
  } catch (err) {
    console.error('Add proyek error:', err);
    req.session.error = 'Terjadi kesalahan saat menambah proyek.';
    res.redirect(`/developer/${req.params.id}`);
  }
});

// POST /developer/:id/proyek/:proyekId/edit - Edit proyek
app.post('/developer/:id/proyek/:proyekId/edit', requireLogin, requireRole('admin', 'account_officer'), developerProyekValidatorsEnhanced, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.session.error = errors.array()[0].msg;
    return res.redirect(`/developer/${req.params.id}`);
  }

  try {
    if (!csrfValid(req)) {
      req.session.error = 'CSRF token tidak valid.';
      return res.redirect(`/developer/${req.params.id}`);
    }

    const stmt = db.prepare(`
      UPDATE developer_proyek SET
        nama_proyek = ?, nama_perumahan = ?, key_person_nama = ?, key_person_jabatan = ?,
        key_person_no_hp = ?, bukti_kepemilikan = ?, lokasi_proyek = ?, kota = ?, provinsi = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND developer_id = ?
    `);

    stmt.run(
      req.body.nama_proyek,
      req.body.nama_perumahan || null,
      req.body.key_person_nama || null,
      req.body.key_person_jabatan || null,
      req.body.key_person_no_hp || null,
      req.body.bukti_kepemilikan || null,
      req.body.lokasi_proyek || null,
      req.body.kota || null,
      req.body.provinsi || null,
      req.params.proyekId,
      req.params.id
    );

    catatAuditSistem(req.session.user.id, 'UPDATE_PROYEK', `Proyek ${req.body.nama_proyek} diperbarui`);
    req.session.success = 'Proyek berhasil diperbarui.';
    res.redirect(`/developer/${req.params.id}`);
  } catch (err) {
    console.error('Edit proyek error:', err);
    req.session.error = 'Terjadi kesalahan saat mengupdate proyek.';
    res.redirect(`/developer/${req.params.id}`);
  }
});

// POST /developer/:id/proyek/:proyekId/delete - Delete proyek
app.post('/developer/:id/proyek/:proyekId/delete', requireLogin, requireRole('admin'), (req, res) => {
  try {
    if (!csrfValid(req)) {
      req.session.error = 'CSRF token tidak valid.';
      return res.redirect(`/developer/${req.params.id}`);
    }

    // Delete associated units first
    const deleteUnitsStmt = db.prepare('DELETE FROM developer_unit WHERE developer_proyek_id = ?');
    deleteUnitsStmt.run(req.params.proyekId);

    // Delete proyek
    const stmt = db.prepare('DELETE FROM developer_proyek WHERE id = ? AND developer_id = ?');
    stmt.run(req.params.proyekId, req.params.id);

    catatAuditSistem(req.session.user.id, 'DELETE_PROYEK', `Proyek dengan ID ${req.params.proyekId} dihapus`);
    req.session.success = 'Proyek berhasil dihapus.';
    res.redirect(`/developer/${req.params.id}`);
  } catch (err) {
    console.error('Delete proyek error:', err);
    req.session.error = 'Terjadi kesalahan saat menghapus proyek.';
    res.redirect(`/developer/${req.params.id}`);
  }
});

// ============================================
// Developer Unit Sub-routes
// ============================================

// POST /developer/:id/unit - Add unit
app.post('/developer/:id/unit', requireLogin, requireRole('admin', 'account_officer'), developerUnitValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.session.error = errors.array()[0].msg;
    return res.redirect(`/developer/${req.params.id}`);
  }

  try {
    if (!csrfValid(req)) {
      req.session.error = 'CSRF token tidak valid.';
      return res.redirect(`/developer/${req.params.id}`);
    }

    // Verify proyek exists
    const proyekStmt = db.prepare('SELECT id FROM developer_proyek WHERE id = ? AND developer_id = ?');
    const proyek = proyekStmt.get(req.body.developer_proyek_id, req.params.id);

    if (!proyek) {
      req.session.error = 'Proyek tidak ditemukan.';
      return res.redirect(`/developer/${req.params.id}`);
    }

    const unitId = generateId();
    const stmt = db.prepare(`
      INSERT INTO developer_unit (
        id, developer_proyek_id, no_kavling, luas_kavling, luas_bangunan,
        legalitas_tanah, kondisi_bangunan, status_terjual, harga_satuan, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    stmt.run(
      unitId,
      req.body.developer_proyek_id,
      req.body.no_kavling,
      req.body.luas_kavling || null,
      req.body.luas_bangunan || null,
      req.body.legalitas_tanah || null,
      req.body.kondisi_bangunan || null,
      req.body.status_terjual || 0,
      req.body.harga_satuan || null
    );

    catatAuditSistem(req.session.user.id, 'CREATE_UNIT', `Unit ${req.body.no_kavling} ditambahkan`);
    req.session.success = 'Unit properti berhasil ditambahkan.';
    res.redirect(`/developer/${req.params.id}`);
  } catch (err) {
    console.error('Add unit error:', err);
    req.session.error = 'Terjadi kesalahan saat menambah unit.';
    res.redirect(`/developer/${req.params.id}`);
  }
});

// POST /developer/:id/unit/:unitId/edit - Edit unit
app.post('/developer/:id/unit/:unitId/edit', requireLogin, requireRole('admin', 'account_officer'), developerUnitValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.session.error = errors.array()[0].msg;
    return res.redirect(`/developer/${req.params.id}`);
  }

  try {
    if (!csrfValid(req)) {
      req.session.error = 'CSRF token tidak valid.';
      return res.redirect(`/developer/${req.params.id}`);
    }

    const stmt = db.prepare(`
      UPDATE developer_unit SET
        no_kavling = ?, luas_kavling = ?, luas_bangunan = ?,
        legalitas_tanah = ?, kondisi_bangunan = ?, status_terjual = ?, harga_satuan = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      req.body.no_kavling,
      req.body.luas_kavling || null,
      req.body.luas_bangunan || null,
      req.body.legalitas_tanah || null,
      req.body.kondisi_bangunan || null,
      req.body.status_terjual || 0,
      req.body.harga_satuan || null,
      req.params.unitId
    );

    catatAuditSistem(req.session.user.id, 'UPDATE_UNIT', `Unit ${req.body.no_kavling} diperbarui`);
    req.session.success = 'Unit properti berhasil diperbarui.';
    res.redirect(`/developer/${req.params.id}`);
  } catch (err) {
    console.error('Edit unit error:', err);
    req.session.error = 'Terjadi kesalahan saat mengupdate unit.';
    res.redirect(`/developer/${req.params.id}`);
  }
});

// POST /developer/:id/unit/:unitId/delete - Delete unit
app.post('/developer/:id/unit/:unitId/delete', requireLogin, requireRole('admin'), (req, res) => {
  try {
    if (!csrfValid(req)) {
      req.session.error = 'CSRF token tidak valid.';
      return res.redirect(`/developer/${req.params.id}`);
    }

    const stmt = db.prepare('DELETE FROM developer_unit WHERE id = ?');
    stmt.run(req.params.unitId);

    catatAuditSistem(req.session.user.id, 'DELETE_UNIT', `Unit dengan ID ${req.params.unitId} dihapus`);
    req.session.success = 'Unit properti berhasil dihapus.';
    res.redirect(`/developer/${req.params.id}`);
  } catch (err) {
    console.error('Delete unit error:', err);
    req.session.error = 'Terjadi kesalahan saat menghapus unit.';
    res.redirect(`/developer/${req.params.id}`);
  }
});

// ============================================
// Kerjasama Developer Module Routes
// ============================================

// GET /kerjasama-developer - List kerjasamA
app.get('/kerjasama-developer', requireLogin, (req, res) => {
  try {
    const search = req.query.search || '';
    const status = req.query.status || '';

    let query = `
      SELECT kd.*, d.nama as developer_nama, ka.nama_proyek
      FROM kerjasama_developer kd
      LEFT JOIN developer d ON kd.developer_id = d.id
      LEFT JOIN kerjasama_developer_aplikasi ka ON kd.id = ka.kerjasama_developer_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (d.nama LIKE ? OR ka.nama_proyek LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      query += ' AND kd.status = ?';
      params.push(status);
    }

    query += ' ORDER BY kd.created_at DESC';

    const stmt = db.prepare(query);
    const kerjasamas = params.length > 0 ? stmt.all(...params) : stmt.all();

    res.render('kerjasama-developer/list', {
      kerjasamas,
      search,
      status
    });
  } catch (err) {
    console.error('Kerjasama list error:', err);
    req.session.error = 'Terjadi kesalahan saat memuat daftar kerjasama.';
    res.redirect('/dashboard');
  }
});

// GET /kerjasama-developer/new - Create kerjasama form
app.get('/kerjasama-developer/new', requireLogin, requireRole('admin', 'account_officer'), (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM developer WHERE status = "Aktif" ORDER BY nama');
    const developers = stmt.all();
    res.render('kerjasama-developer/form', {
      kerjasama: null,
      developers,
      action: 'Tambah'
    });
  } catch (err) {
    console.error('Kerjasama form error:', err);
    req.session.error = 'Terjadi kesalahan.';
    res.redirect('/kerjasama-developer');
  }
});

// GET /kerjasama-developer/:id - View kerjasama detail
app.get('/kerjasama-developer/:id', requireLogin, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT kd.*, d.nama as developer_nama
      FROM kerjasama_developer kd
      LEFT JOIN developer d ON kd.developer_id = d.id
      WHERE kd.id = ?
    `);
    const kerjasama = stmt.get(req.params.id);

    if (!kerjasama) {
      req.session.error = 'Kerjasama tidak ditemukan.';
      return res.redirect('/kerjasama-developer');
    }

    // Get aplikasi
    const aplikasiStmt = db.prepare('SELECT * FROM kerjasama_developer_aplikasi WHERE kerjasama_developer_id = ?');
    const aplikasi = aplikasiStmt.get(req.params.id);

    // Get verifikasi
    const verifikasiStmt = db.prepare('SELECT * FROM kerjasama_developer_verifikasi WHERE kerjasama_developer_id = ? ORDER BY created_at DESC LIMIT 1');
    const verifikasi = verifikasiStmt.get(req.params.id);

    // Get keputusan
    const keputusanStmt = db.prepare('SELECT * FROM kerjasama_developer_keputusan WHERE kerjasama_developer_id = ? ORDER BY created_at DESC LIMIT 1');
    const keputusan = keputusanStmt.get(req.params.id);

    res.render('kerjasama-developer/detail', {
      kerjasama,
      aplikasi,
      verifikasi,
      keputusan
    });
  } catch (err) {
    console.error('Kerjasama detail error:', err);
    req.session.error = 'Terjadi kesalahan.';
    res.redirect('/kerjasama-developer');
  }
});

// ============================================
// Monitoring Routes
// ============================================

// GET /monitoring - Dashboard monitoring
app.get('/monitoring', requireLogin, (req, res) => {
  try {
    const stats = {
      totalKerjasama: 0,
      disetujui: 0,
      dalamProses: 0,
      ditolak: 0,
      totalPlafondDisetujui: 0
    };

    const countStmt = db.prepare('SELECT status, COUNT(*) as count, SUM(total_plafond_kerjasama) as total_plafond FROM kerjasama_developer GROUP BY status');
    const rows = countStmt.all();

    rows.forEach(row => {
      stats.totalKerjasama += row.count;
      if (row.status === 'Disetujui') {
        stats.disetujui = row.count;
        stats.totalPlafondDisetujui = row.total_plafond || 0;
      }
      if (['Diajukan', 'Verifikasi', 'Keputusan'].includes(row.status)) {
        stats.dalamProses += row.count;
      }
      if (row.status === 'Ditolak') stats.ditolak = row.count;
    });

    // Get recent kerjasamas
    const recentStmt = db.prepare(`
      SELECT kd.*, d.nama as developer_nama
      FROM kerjasama_developer kd
      LEFT JOIN developer d ON kd.developer_id = d.id
      ORDER BY kd.updated_at DESC
      LIMIT 10
    `);
    const recentKerjasamas = recentStmt.all();

    res.render('monitoring/index', { stats, recentKerjasamas });
  } catch (err) {
    console.error('Monitoring error:', err);
    res.render('monitoring/index', { stats: {}, recentKerjasamas: [] });
  }
});

// ============================================
// Error Handling
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { message: 'Halaman tidak ditemukan' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).render('500', { message: 'Terjadi kesalahan server' });
});

// ============================================
// Utility Functions
// ============================================

/**
 * Record system audit log
 */
function catatAuditSistem(userId, aksi, detail) {
  try {
    const stmt = db.prepare(
      'INSERT INTO audit_log (id, user_id, aksi, detail, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)'
    );
    stmt.run(generateId(), userId, aksi, detail);
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

// ============================================
// Server Startup
// ============================================

const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║   Griya Developer Management System                    ║
║   Server running on http://localhost:${PORT}              ║
║   Environment: ${NODE_ENV}                                    ║
╚════════════════════════════════════════════════════════╝
  `);
  console.log('✓ Login at http://localhost:' + PORT + '/login');
  console.log('✓ Demo account: admin / admin123\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n✓ Shutting down gracefully...');
  server.close(() => {
    db.close();
    console.log('✓ Database connection closed');
    process.exit(0);
  });
});

module.exports = app;
