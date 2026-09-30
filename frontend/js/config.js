/**
 * Konfigurasi Utama Sistem Absensi PIK-R MANSEKU
 * Program by Haikal - 2026
 */

const APP_CONFIG = {
  // Nama Organisasi
  APP_NAME: "Absensi PIK-R MANSEKU",
  ORGANIZATION: "PIK-R MAN 1 Muara Enim",
  
  // Base URL Website & Scan
  SCAN_BASE_URL: "https://absensi.pikr-manseku.my.id",
  PORTAL_BASE_URL: "https://pikr-manseku.my.id",
  
  // Secret Key Tanda Tangan Kriptografis
  SECRET_KEY: "sistem_absensi_PIK-R_2026_programbyhaikal",
  SIG_LENGTH: 10,
  
  // Google Apps Script Web App Endpoint URL
  // Tempelkan URL dari hasil Deploy "New deployment" -> "Web App" di sini:
  GAS_ENDPOINT_URL: "https://script.google.com/macros/s/AKfycbx_GANTI_DENGAN_DEPLOYMENT_ID_ANDA/exec",
  
  // Mode Uji Coba Lokal / Mock Data (Bisa diaktifkan jika belum deploy GAS)
  USE_MOCK_FALLBACK: true,

  // Konfigurasi Firebase Hosting & Analytics (Project: absensi-pik-r)
  FIREBASE_CONFIG: {
    apiKey: "AIzaSyAn-AWu5VLA9Hxh1RLpjiJIDl82PTH9H9g",
    authDomain: "absensi-pik-r.firebaseapp.com",
    projectId: "absensi-pik-r",
    storageBucket: "absensi-pik-r.firebasestorage.app",
    messagingSenderId: "572782848196",
    appId: "1:572782848196:web:9f00f1396825d2e0a90191",
    measurementId: "G-T6DE0JXTMG"
  },

  // Penyimpanan Lokal
  LOCAL_STORAGE_KEYS: {
    PETUGAS_NAME: "pikr_petugas_name",
    LAST_SESSION: "pikr_last_session",
    OFFLINE_LOGS: "pikr_offline_attendance_queue",
    CUSTOM_GAS_URL: "pikr_custom_gas_url"
  }
};

// Ambil URL GAS dari localStorage jika user pernah menginput URL manual di halaman dashboard/scanner
if (localStorage.getItem(APP_CONFIG.LOCAL_STORAGE_KEYS.CUSTOM_GAS_URL)) {
  APP_CONFIG.GAS_ENDPOINT_URL = localStorage.getItem(APP_CONFIG.LOCAL_STORAGE_KEYS.CUSTOM_GAS_URL);
}
