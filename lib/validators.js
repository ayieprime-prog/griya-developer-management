const { body } = require('express-validator');

// Status Pernikahan values for CLAUDE.md compliance
const STATUS_PERNIKAHAN_VALUES = ['Belum Menikah', 'Menikah'];

// Jenis Objek values for Developer
const JENIS_OBJEK_VALUES = ['Rumah Tapak', 'Apartemen'];

// Developer Legalitas values
const LEGALITAS_VALUES = ['PT', 'CV', 'Perseroan', 'Lainnya'];

// Status Kerjasama
const STATUS_KERJASAMA_VALUES = ['Draft', 'Diajukan', 'Verifikasi', 'Keputusan', 'Ditolak', 'Disetujui', 'Selesai'];

// Hasil Verifikasi
const HASIL_VERIFIKASI_VALUES = ['Lolos', 'Tidak Lolos'];

// Status Penghasilan Pasangan
const STATUS_PENGHASILAN_PASANGAN_VALUES = ['Berpenghasilan', 'Tidak Berpenghasilan'];

// Alur Kerjasama
const ALUR_KERJASAMA_VALUES = ['Lama', 'Baru'];

// Legalitas Tanah
const LEGALITAS_TANAH_VALUES = ['Sertifikat Induk', 'Sertifikat Pecahan'];

// Kondisi Bangunan
const KONDISI_BANGUNAN_VALUES = ['Belum Selesai', 'Selesai', 'Sebagian Selesai'];

// Cakupan Wilayah
const CAKUPAN_WILAYAH_VALUES = ['Non Nasional', 'Nasional'];

// ============================================
// Login Validators
// ============================================
const loginValidators = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username harus diisi'),
  body('password')
    .notEmpty().withMessage('Password harus diisi')
];

// ============================================
// Developer Validators (Database Developer)
// ============================================
const developerValidators = [
  body('nama')
    .trim()
    .notEmpty().withMessage('Nama Developer harus diisi'),
  body('legalitas')
    .optional({ checkFalsy: true })
    .isIn(LEGALITAS_VALUES).withMessage('Legalitas tidak valid'),
  body('akta_pendirian_nomor')
    .optional({ checkFalsy: true })
    .trim(),
  body('nomor_akta_pendirian')
    .optional({ checkFalsy: true })
    .trim(),
  body('tanggal_akta_pendirian')
    .optional({ checkFalsy: true })
    .isISO8601().withMessage('Format tanggal tidak valid'),
  body('notaris_nama')
    .optional({ checkFalsy: true })
    .trim(),
  body('sk_menkumham_nomor')
    .optional({ checkFalsy: true })
    .trim(),
  body('sk_menkumham_tanggal')
    .optional({ checkFalsy: true })
    .isISO8601().withMessage('Format tanggal tidak valid'),
  body('email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('Format email tidak valid'),
  body('no_telepon')
    .optional({ checkFalsy: true })
    .trim(),
  body('alamat_kantor')
    .optional({ checkFalsy: true })
    .trim(),
  body('kota')
    .optional({ checkFalsy: true })
    .trim(),
  body('provinsi')
    .optional({ checkFalsy: true })
    .trim()
];

// ============================================
// Developer Proyek Validators
// ============================================
const developerProyekValidators = [
  body('nama_proyek')
    .trim()
    .notEmpty().withMessage('Nama Proyek harus diisi'),
  body('nama_perumahan')
    .optional({ checkFalsy: true })
    .trim(),
  body('key_person_nama')
    .optional({ checkFalsy: true })
    .trim(),
  body('key_person_no_hp')
    .optional({ checkFalsy: true })
    .trim(),
  body('lokasi_proyek')
    .optional({ checkFalsy: true })
    .trim()
];

// ============================================
// Kerjasama Developer Validators
// ============================================
const kerjasamaDeveloperValidators = [
  body('developer_id')
    .notEmpty().withMessage('Developer harus dipilih'),
  body('jenis_objek')
    .notEmpty().withMessage('Jenis Objek harus dipilih')
    .isIn(JENIS_OBJEK_VALUES).withMessage('Jenis Objek tidak valid'),
  body('legalitas_tanah')
    .notEmpty().withMessage('Legalitas Tanah harus dipilih')
    .isIn(LEGALITAS_TANAH_VALUES).withMessage('Legalitas Tanah tidak valid'),
  body('kondisi_bangunan')
    .notEmpty().withMessage('Kondisi Bangunan harus dipilih')
    .isIn(KONDISI_BANGUNAN_VALUES).withMessage('Kondisi Bangunan tidak valid'),
  body('cakupan_wilayah')
    .notEmpty().withMessage('Cakupan Wilayah harus dipilih')
    .isIn(CAKUPAN_WILAYAH_VALUES).withMessage('Cakupan Wilayah tidak valid'),
  body('total_plafond_kerjasama')
    .notEmpty().withMessage('Total Plafond harus diisi')
    .isFloat({ gt: 0 }).withMessage('Total Plafond harus lebih besar dari 0'),
  body('jangka_waktu_bulan')
    .notEmpty().withMessage('Jangka Waktu harus diisi')
    .isInt({ gt: 0 }).withMessage('Jangka Waktu harus lebih besar dari 0'),
  body('margin_rate')
    .notEmpty().withMessage('Margin Rate harus diisi')
    .isFloat({ min: 0 }).withMessage('Margin Rate tidak valid'),
  body('alur')
    .optional({ checkFalsy: true })
    .isIn(ALUR_KERJASAMA_VALUES).withMessage('Alur Kerjasama tidak valid')
];

// ============================================
// Kerjasama Developer Aplikasi Validators
// ============================================
const kerjasamaDeveloperAplikasiValidators = [
  body('nama_proyek')
    .trim()
    .notEmpty().withMessage('Nama Proyek harus diisi'),
  body('lokasi_proyek_alamat')
    .optional({ checkFalsy: true })
    .trim(),
  body('jenis_objek')
    .notEmpty().withMessage('Jenis Objek harus dipilih')
    .isIn(JENIS_OBJEK_VALUES).withMessage('Jenis Objek tidak valid'),
  body('total_unit_direncanakan')
    .optional({ checkFalsy: true })
    .isInt({ gt: 0 }).withMessage('Total Unit harus berupa angka positif'),
  body('total_investasi')
    .optional({ checkFalsy: true })
    .isFloat({ gt: 0 }).withMessage('Total Investasi harus berupa angka positif'),
  body('legalitas_tanah')
    .notEmpty().withMessage('Legalitas Tanah harus dipilih')
    .isIn(LEGALITAS_TANAH_VALUES).withMessage('Legalitas Tanah tidak valid'),
  body('kondisi_bangunan')
    .notEmpty().withMessage('Kondisi Bangunan harus dipilih')
    .isIn(KONDISI_BANGUNAN_VALUES).withMessage('Kondisi Bangunan tidak valid'),
  body('cakupan_wilayah')
    .notEmpty().withMessage('Cakupan Wilayah harus dipilih')
    .isIn(CAKUPAN_WILAYAH_VALUES).withMessage('Cakupan Wilayah tidak valid'),
  body('total_plafond')
    .notEmpty().withMessage('Total Plafond harus diisi')
    .isFloat({ gt: 0 }).withMessage('Total Plafond harus lebih besar dari 0'),
  body('jangka_waktu')
    .notEmpty().withMessage('Jangka Waktu harus diisi')
    .isInt({ gt: 0 }).withMessage('Jangka Waktu harus lebih besar dari 0')
];

// ============================================
// Verifikasi Validators
// ============================================
const verifikasiValidators = [
  body('hasil_verifikasi')
    .notEmpty().withMessage('Hasil Verifikasi harus dipilih')
    .isIn(HASIL_VERIFIKASI_VALUES).withMessage('Hasil Verifikasi tidak valid'),
  body('catatan')
    .optional({ checkFalsy: true })
    .trim()
];

// ============================================
// Keputusan Validators
// ============================================
const keputusanValidators = [
  body('hasil_keputusan')
    .notEmpty().withMessage('Hasil Keputusan harus dipilih')
    .isIn(['Disetujui', 'Ditolak']).withMessage('Hasil Keputusan tidak valid'),
  body('catatan')
    .optional({ checkFalsy: true })
    .trim()
];

module.exports = {
  loginValidators,
  developerValidators,
  developerProyekValidators,
  kerjasamaDeveloperValidators,
  kerjasamaDeveloperAplikasiValidators,
  verifikasiValidators,
  keputusanValidators,
  // Constants
  STATUS_PERNIKAHAN_VALUES,
  JENIS_OBJEK_VALUES,
  LEGALITAS_VALUES,
  STATUS_KERJASAMA_VALUES,
  HASIL_VERIFIKASI_VALUES,
  ALUR_KERJASAMA_VALUES,
  LEGALITAS_TANAH_VALUES,
  KONDISI_BANGUNAN_VALUES,
  CAKUPAN_WILAYAH_VALUES
};
