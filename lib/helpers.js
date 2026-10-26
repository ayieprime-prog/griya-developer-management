const crypto = require('crypto');
const dayjs = require('dayjs');

// Generate UUID
function generateId() {
  return crypto.randomUUID();
}

// Timing-safe CSRF token validation
function csrfValid(req) {
  if (!req.session.csrfToken || !req.body._csrf) {
    return false;
  }
  const expectedToken = req.session.csrfToken;
  const receivedToken = req.body._csrf;
  if (expectedToken.length !== receivedToken.length) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(expectedToken),
    Buffer.from(receivedToken)
  );
}

// Generate CSRF token
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Format currency to IDR
function formatCurrency(value) {
  if (!value && value !== 0) return 'Rp 0';
  return 'Rp ' + Math.round(value).toLocaleString('id-ID');
}

// Format date to DD/MM/YYYY
function formatDate(date) {
  if (!date) return '-';
  return dayjs(date).format('DD/MM/YYYY');
}

// Format date to YYYY-MM-DD for input
function formatDateInput(date) {
  if (!date) return '';
  return dayjs(date).format('YYYY-MM-DD');
}

// Calculate Tipe Developer (I-IV) based on legalitas_tanah & kondisi_bangunan
function hitungTipeDeveloper(legalitasTanah, kondisiBangunan) {
  if (!legalitasTanah || !kondisiBangunan) return null;

  // Tipe I: Sertifikat Induk + Belum Selesai
  if (legalitasTanah === 'Sertifikat Induk' && kondisiBangunan === 'Belum Selesai') {
    return 'Tipe I';
  }
  // Tipe II: Sertifikat Induk + Selesai
  if (legalitasTanah === 'Sertifikat Induk' && (kondisiBangunan === 'Selesai' || kondisiBangunan === 'Sebagian Selesai')) {
    return 'Tipe II';
  }
  // Tipe III: Sertifikat Pecahan + Belum Selesai
  if (legalitasTanah === 'Sertifikat Pecahan' && kondisiBangunan === 'Belum Selesai') {
    return 'Tipe III';
  }
  // Tipe IV: Sertifikat Pecahan + Selesai
  if (legalitasTanah === 'Sertifikat Pecahan' && (kondisiBangunan === 'Selesai' || kondisiBangunan === 'Sebagian Selesai')) {
    return 'Tipe IV';
  }

  return null;
}

// Status badges for views
function statusBadge(status) {
  const badges = {
    'Draft': 'secondary',
    'Diajukan': 'info',
    'Verifikasi': 'warning',
    'Keputusan': 'primary',
    'Ditolak': 'danger',
    'Disetujui': 'success',
    'Selesai': 'success',
    'Lolos': 'success',
    'Tidak Lolos': 'danger'
  };
  return badges[status] || 'secondary';
}

// Role labels for display
const ROLE_LABELS = {
  'admin': 'Administrator',
  'account_officer': 'Account Officer',
  'supervisor': 'Supervisor',
  'pemimpin_cabang': 'Pemimpin Cabang',
  'laka': 'LAKA',
  'pemimpin_uus': 'Pemimpin UUS'
};

// Document types for Kerjasama Developer
const JENIS_DOKUMEN_KERJASAMA = [
  'Foto OTS',
  'Dokumen Pendukung Lainnya'
];

// Checklist Dokumen items (21 items for Developer)
const CHECKLIST_KERJASAMA_DEVELOPER = [
  { kode: 'A1', nama: 'Akta Pendirian Perusahaan', kategori: 'AKTA PENDIRIAN' },
  { kode: 'A2', nama: 'Perubahan Akta Pendirian (jika ada)', kategori: 'AKTA PENDIRIAN' },
  { kode: 'A3', nama: 'SK Menkumham', kategori: 'AKTA PENDIRIAN' },
  { kode: 'A4', nama: 'Surat Keterangan Domisili Perusahaan', kategori: 'AKTA PENDIRIAN' },
  { kode: 'A5', nama: 'NPWP Perusahaan', kategori: 'AKTA PENDIRIAN' },

  { kode: 'B1', nama: 'Izin Lokasi', kategori: 'PERIZINAN LAHAN' },
  { kode: 'B2', nama: 'Sertifikat Tanah', kategori: 'PERIZINAN LAHAN' },
  { kode: 'B3', nama: 'IMB', kategori: 'PERIZINAN LAHAN' },
  { kode: 'B4', nama: 'Persetujuan Lingkungan', kategori: 'PERIZINAN LAHAN' },

  { kode: 'C1', nama: 'Master Plan Proyek', kategori: 'DATA PROYEK' },
  { kode: 'C2', nama: 'Foto Lokasi Proyek', kategori: 'DATA PROYEK' },
  { kode: 'C3', nama: 'Rencana Tata Guna Lahan', kategori: 'DATA PROYEK' },

  { kode: 'D1', nama: 'Daftar Penguasa/Direksi', kategori: 'PENGUASA USAHA' },
  { kode: 'D2', nama: 'KTP Penguasa/Direksi', kategori: 'PENGUASA USAHA' },
  { kode: 'D3', nama: 'NPWP Penguasa/Direksi', kategori: 'PENGUASA USAHA' },

  { kode: 'E1', nama: 'Laporan Keuangan Audit (2 tahun terakhir)', kategori: 'KEUANGAN' },
  { kode: 'E2', nama: 'SPT PPh Badan (2 tahun terakhir)', kategori: 'KEUANGAN' },
  { kode: 'E3', nama: 'Surat Pernyataan Tidak Macet', kategori: 'KEUANGAN' },

  { kode: 'F1', nama: 'Surat Komitmen Pengembang', kategori: 'KOMITMEN' },
  { kode: 'F2', nama: 'Permohonan KPK (Perjanjian Kerjasama)', kategori: 'KOMITMEN' },
  { kode: 'F3', nama: 'Dokumen Pendukung Lainnya', kategori: 'LAINNYA' }
];

module.exports = {
  generateId,
  csrfValid,
  generateCsrfToken,
  formatCurrency,
  formatDate,
  formatDateInput,
  hitungTipeDeveloper,
  statusBadge,
  ROLE_LABELS,
  JENIS_DOKUMEN_KERJASAMA,
  CHECKLIST_KERJASAMA_DEVELOPER
};
