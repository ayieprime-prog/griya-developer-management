const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'kpr.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for better concurrent access
db.exec('PRAGMA journal_mode = WAL');

// Drop existing tables (preserve sessions)
const tablesToDrop = [
  'audit_log',
  'developer_realisasi_cabang',
  'developer_tbo_item',
  'kerjasama_developer_addendum',
  'kerjasama_developer_komposisi_pencairan',
  'kerjasama_developer_aplikasi',
  'kerjasama_developer',
  'developer_pengurus',
  'developer_unit',
  'developer_proyek',
  'developer',
  'users'
];

tablesToDrop.forEach(table => {
  try {
    db.exec(`DROP TABLE IF EXISTS ${table}`);
  } catch (e) {
    // ignore
  }
});

// Create users table
db.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'account_officer', 'supervisor', 'pemimpin_cabang', 'laka', 'pemimpin_uus')),
    nama_lengkap TEXT NOT NULL,
    email TEXT,
    no_hp TEXT,
    cabang TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create developer table (Database Developer)
db.exec(`
  CREATE TABLE developer (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    legalitas TEXT CHECK(legalitas IN ('PT', 'CV', 'Perseroan', 'Lainnya')),
    akta_pendirian TEXT,
    nomor_akta_pendirian TEXT,
    tanggal_akta_pendirian DATE,
    notaris_nama TEXT,
    notaris_nib TEXT,
    sk_menkumham_nomor TEXT,
    sk_menkumham_tanggal DATE,
    situs_web TEXT,
    email TEXT,
    no_telepon TEXT,
    alamat_kantor TEXT,
    kota TEXT,
    provinsi TEXT,
    status TEXT DEFAULT 'Aktif' CHECK(status IN ('Aktif', 'Nonaktif', 'Revisi')),
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(updated_by) REFERENCES users(id)
  )
`);

// Create developer_proyek table
db.exec(`
  CREATE TABLE developer_proyek (
    id TEXT PRIMARY KEY,
    developer_id TEXT NOT NULL,
    nama_proyek TEXT NOT NULL,
    nama_perumahan TEXT,
    key_person_nama TEXT,
    key_person_jabatan TEXT,
    key_person_no_hp TEXT,
    bukti_kepemilikan TEXT,
    lokasi_proyek TEXT,
    kota TEXT,
    provinsi TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(developer_id) REFERENCES developer(id)
  )
`);

// Create developer_unit table (untuk perhitungan Tipe I-IV)
db.exec(`
  CREATE TABLE developer_unit (
    id TEXT PRIMARY KEY,
    developer_proyek_id TEXT NOT NULL,
    no_kavling TEXT NOT NULL,
    luas_kavling REAL,
    luas_bangunan REAL,
    legalitas_tanah TEXT CHECK(legalitas_tanah IN ('Sertifikat Induk', 'Sertifikat Pecahan')),
    kondisi_bangunan TEXT CHECK(kondisi_bangunan IN ('Belum Selesai', 'Selesai')),
    status_terjual INTEGER DEFAULT 0,
    harga_satuan REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(developer_proyek_id) REFERENCES developer_proyek(id)
  )
`);

// Create developer_pengurus table (Direksi/Pengurus)
db.exec(`
  CREATE TABLE developer_pengurus (
    id TEXT PRIMARY KEY,
    developer_id TEXT NOT NULL,
    nama TEXT NOT NULL,
    jabatan TEXT NOT NULL,
    nik TEXT,
    alamat TEXT,
    no_hp TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(developer_id) REFERENCES developer(id)
  )
`);

// Create kerjasama_developer table (PKS Header - Perjanjian Kerjasama Syariah Developer)
db.exec(`
  CREATE TABLE kerjasama_developer (
    id TEXT PRIMARY KEY,
    developer_id TEXT,
    nomor_pks TEXT UNIQUE,
    tanggal_pks DATE,
    tahun_pks INTEGER,
    status TEXT DEFAULT 'Draft' CHECK(status IN ('Draft', 'Diajukan', 'Verifikasi', 'Keputusan', 'Ditolak', 'Disetujui', 'Selesai')),
    tahap_kerjasama_baru INTEGER DEFAULT 0,
    alur TEXT DEFAULT 'Lama' CHECK(alur IN ('Lama', 'Baru')),
    awal_berlaku DATE,
    akhir_berlaku DATE,
    total_plafond_kerjasama REAL,
    jangka_waktu_bulan INTEGER,
    margin_rate REAL,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(developer_id) REFERENCES developer(id),
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(updated_by) REFERENCES users(id)
  )
`);

// Create kerjasama_developer_aplikasi table (75+ field application/permohonan)
db.exec(`
  CREATE TABLE kerjasama_developer_aplikasi (
    id TEXT PRIMARY KEY,
    kerjasama_developer_id TEXT NOT NULL,

    -- Identitas Pemohon (Pengembang)
    nama_pengembang TEXT,
    status_pengembang TEXT CHECK(status_pengembang IN ('Perseroan Terbatas', 'Perseroan Komanditer', 'Lainnya')),
    akta_pendirian_nomor TEXT,
    akta_pendirian_tanggal DATE,
    notaris_nama TEXT,
    notaris_kota TEXT,
    sk_menkumham_nomor TEXT,
    sk_menkumham_tanggal DATE,
    npwp TEXT,
    alamat_kantor_pusat TEXT,
    kota_kantor_pusat TEXT,
    provinsi_kantor_pusat TEXT,
    telepon TEXT,
    faksimili TEXT,
    email TEXT,
    website TEXT,

    -- Proyek
    nama_proyek TEXT,
    lokasi_proyek_alamat TEXT,
    lokasi_proyek_kelurahan TEXT,
    lokasi_proyek_kecamatan TEXT,
    lokasi_proyek_kota TEXT,
    lokasi_proyek_provinsi TEXT,

    -- Data Proyek
    jenis_objek TEXT CHECK(jenis_objek IN ('Rumah Tapak', 'Apartemen', 'Lainnya')),
    total_unit_direncanakan INTEGER,
    luas_tanah_total REAL,
    total_investasi REAL,

    -- Perizinan
    izin_lokasi_nomor TEXT,
    izin_lokasi_tanggal DATE,
    imb_nomor TEXT,
    imb_tanggal DATE,
    sertifikat_tanah_nomor TEXT,
    sertifikat_legalitas TEXT CHECK(sertifikat_legalitas IN ('Sertifikat Induk', 'Sertifikat Pecahan')),

    -- Legalitas & Kerjasama
    legalitas_tanah TEXT CHECK(legalitas_tanah IN ('Sertifikat Induk', 'Sertifikat Pecahan')),
    kondisi_bangunan TEXT CHECK(kondisi_bangunan IN ('Belum Selesai', 'Selesai', 'Sebagian Selesai')),
    cakupan_wilayah TEXT CHECK(cakupan_wilayah IN ('Non Nasional', 'Nasional')),

    -- Komposisi Pencairan
    jumlah_tahap_pencairan INTEGER DEFAULT 0,

    -- Ringkasan Kerjasama
    plafond_awal REAL,
    total_plafond REAL,
    jangka_waktu INTEGER,
    margin_rate REAL,
    awal_berlaku DATE,
    akhir_berlaku DATE,

    -- File/Dokumen
    file_aplikasi TEXT,
    file_nota_analisa TEXT,
    file_draft_pks TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(kerjasama_developer_id) REFERENCES kerjasama_developer(id)
  )
`);

// Create kerjasama_developer_komposisi_pencairan table (Disbursement schedule)
db.exec(`
  CREATE TABLE kerjasama_developer_komposisi_pencairan (
    id TEXT PRIMARY KEY,
    kerjasama_developer_id TEXT NOT NULL,
    tahap_pencairan INTEGER,
    progress_bangunan_persen REAL,
    jumlah_unit INTEGER,
    plafond_tahap REAL,
    deskripsi TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(kerjasama_developer_id) REFERENCES kerjasama_developer(id)
  )
`);

// Create kerjasama_developer_addendum table (Amendments)
db.exec(`
  CREATE TABLE kerjasama_developer_addendum (
    id TEXT PRIMARY KEY,
    kerjasama_developer_id TEXT NOT NULL,
    nomor_addendum TEXT,
    tanggal_addendum DATE,
    uraian_perubahan TEXT,
    file_addendum TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(kerjasama_developer_id) REFERENCES kerjasama_developer(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
  )
`);

// Create developer_tbo_item table (Checklist Dokumen - 21 items)
db.exec(`
  CREATE TABLE developer_tbo_item (
    id TEXT PRIMARY KEY,
    kerjasama_developer_id TEXT NOT NULL,
    kode TEXT,
    nama_item TEXT,
    kategori TEXT,
    status TEXT CHECK(status IN ('Ada', 'Tidak Ada', NULL)),
    keterangan TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(kerjasama_developer_id) REFERENCES kerjasama_developer(id)
  )
`);

// Create developer_realisasi_cabang table (Branch authorization/realization)
db.exec(`
  CREATE TABLE developer_realisasi_cabang (
    id TEXT PRIMARY KEY,
    kerjasama_developer_id TEXT NOT NULL,
    cabang_nama TEXT,
    cabang_kode TEXT,
    status_pembukaan TEXT CHECK(status_pembukaan IN ('Direncanakan', 'Dibuka', 'Ditutup')),
    tanggal_pembukaan DATE,
    apj_nama TEXT,
    apj_nik TEXT,
    apj_no_hp TEXT,
    target_penjualan_unit INTEGER,
    realisasi_penjualan_unit INTEGER,
    catatan TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(kerjasama_developer_id) REFERENCES kerjasama_developer(id)
  )
`);

// Create kerjasama_developer verifikasi tracking
db.exec(`
  CREATE TABLE kerjasama_developer_verifikasi (
    id TEXT PRIMARY KEY,
    kerjasama_developer_id TEXT NOT NULL,
    hasil_verifikasi TEXT CHECK(hasil_verifikasi IN ('Lolos', 'Tidak Lolos')),
    catatan TEXT,
    verified_by TEXT,
    verified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(kerjasama_developer_id) REFERENCES kerjasama_developer(id),
    FOREIGN KEY(verified_by) REFERENCES users(id)
  )
`);

// Create kerjasama_developer keputusan tracking
db.exec(`
  CREATE TABLE kerjasama_developer_keputusan (
    id TEXT PRIMARY KEY,
    kerjasama_developer_id TEXT NOT NULL,
    level TEXT CHECK(level IN ('cabang', 'pusat')),
    hasil_keputusan TEXT CHECK(hasil_keputusan IN ('Disetujui', 'Ditolak')),
    catatan TEXT,
    decided_by TEXT,
    decided_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(kerjasama_developer_id) REFERENCES kerjasama_developer(id),
    FOREIGN KEY(decided_by) REFERENCES users(id)
  )
`);

// Create audit_log table
db.exec(`
  CREATE TABLE audit_log (
    id TEXT PRIMARY KEY,
    kerjasama_developer_id TEXT,
    user_id TEXT,
    aksi TEXT NOT NULL,
    detail TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(kerjasama_developer_id) REFERENCES kerjasama_developer(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`);

// Create sessions table
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expire INTEGER NOT NULL
  )
`);

// Insert demo users
const users = [
  {
    id: 'user_admin_1',
    username: 'admin',
    role: 'admin',
    nama_lengkap: 'Administrator',
    email: 'admin@bank.com'
  },
  {
    id: 'user_ao_1',
    username: 'ao1',
    role: 'account_officer',
    nama_lengkap: 'Account Officer',
    email: 'ao@bank.com'
  },
  {
    id: 'user_supervisor_1',
    username: 'supervisor1',
    role: 'supervisor',
    nama_lengkap: 'Supervisor',
    email: 'supervisor@bank.com'
  },
  {
    id: 'user_pemimpincabang_1',
    username: 'pemimpincabang1',
    role: 'pemimpin_cabang',
    nama_lengkap: 'Pemimpin Cabang',
    email: 'pemimpincabang@bank.com'
  },
  {
    id: 'user_laka_1',
    username: 'laka1',
    role: 'laka',
    nama_lengkap: 'LAKA Officer',
    email: 'laka@bank.com'
  },
  {
    id: 'user_pemimpinuus_1',
    username: 'pemimpinuus1',
    role: 'pemimpin_uus',
    nama_lengkap: 'Pemimpin UUS',
    email: 'pemimpinuus@bank.com'
  }
];

const insertUser = db.prepare(`
  INSERT INTO users (id, username, password, role, nama_lengkap, email, is_active)
  VALUES (?, ?, ?, ?, ?, ?, 1)
`);

users.forEach(user => {
  const password = user.username === 'admin' ? 'admin123' : user.username + '123';
  const hashed = bcrypt.hashSync(password, 10);
  insertUser.run(user.id, user.username, hashed, user.role, user.nama_lengkap, user.email);
});

console.log('✓ Database initialized successfully');
console.log('\nDemo Accounts:');
console.log('- Username: admin, Password: admin123 (Admin)');
console.log('- Username: ao1, Password: ao1123 (Account Officer)');
console.log('- Username: supervisor1, Password: supervisor1123 (Supervisor)');
console.log('- Username: pemimpincabang1, Password: pemimpincabang1123 (Pemimpin Cabang)');
console.log('- Username: laka1, Password: laka1123 (LAKA)');
console.log('- Username: pemimpinuus1, Password: pemimpinuus1123 (Pemimpin UUS)');

db.close();
