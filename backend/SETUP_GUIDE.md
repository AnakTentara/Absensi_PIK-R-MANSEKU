# Panduan Setup Google Apps Script (Backend Absensi PIK-R MANSEKU)

Backend ini dirancang dengan prinsip **Zero Cost (Gratis Selamanya)** dan **Lifetime Use**. Semua data tersimpan di Google Sheets milik organisasi dan dapat diexport kapan saja ke format Excel (`.xlsx`) atau PDF.

---

## Langkah 1: Buat Google Spreadsheet Baru
1. Buka [Google Sheets](https://sheets.new) menggunakan akun resmi organisasi (disarankan e.g. `pikrman1muaraenim@gmail.com`).
2. Beri nama Spreadsheet: **`Database Absensi PIK-R MANSEKU`**.

## Langkah 2: Buka Script Editor
1. Di menu atas Google Sheets, klik **Extensions** (Ekstensi) > **Apps Script**.
2. Beri nama proyek di kiri atas: **`Backend-Absensi-PIKR`**.
3. Hapus semua kode default di dalam editor `Code.gs`.
4. Salin (copy) seluruh isi file [`backend/Code.gs`](file:///c:/Users/HP/Desktop/PIK-R%20Absent/backend/Code.gs) dan tempel (paste) ke dalam editor Apps Script.
5. Klik ikon **Save** (Disket / Ctrl + S).

## Langkah 3: Inisialisasi Database Pertama Kali
1. Di bilah menu atas editor Apps Script, pilih fungsi **`setupDatabase`** dari daftar dropdown.
2. Klik tombol **Run** (Jalankan).
3. Google akan meminta izin (*Authorization Required*):
   - Klik **Review Permissions** > Pilih akun Google organisasi Anda.
   - Klik **Advanced** (Lanjutan) di kiri bawah.
   - Klik **Go to Backend-Absensi-PIKR (unsafe)**.
   - Klik **Allow** (Izinkan).
4. Kembali ke tab Google Sheets Anda, perhatikan 3 sheet baru sudah otomatis dibuat dengan format rapi:
   - `Data_Anggota`
   - `Riwayat_Absensi`
   - `Pengaturan`

## Langkah 4: Publikasikan sebagai Web App (REST API)
Agar website frontend dan scanner bisa terhubung ke backend:
1. Di kanan atas editor Apps Script, klik tombol biru **Deploy** (Terapkan) > **New deployment** (Penerapan baru).
2. Klik ikon gear ⚙️ di sebelah *Select type*, pilih **Web app**.
3. Isi konfigurasi berikut:
   - **Description**: `Produksi API Absensi PIK-R v2.0`
   - **Execute as**: **`Me (email organisasi)`** (PENTING!)
   - **Who has access**: **`Anyone`** (Siapa saja, bahkan tanpa akun Google)
4. Klik **Deploy**.
5. Salin **Web app URL** yang muncul (formatnya: `https://script.google.com/macros/s/AKfycb.../exec`).
6. Buka file [`frontend/js/config.js`](file:///c:/Users/HP/Desktop/PIK-R%20Absent/frontend/js/config.js) di proyek ini, dan ganti nilai `GAS_ENDPOINT_URL` dengan URL yang baru saja disalin.

---

## Keamanan & Secret Key
- **Secret Key:** `sistem_absensi_PIK-R_2026_programbyhaikal`
- Token dihasilkan dengan algoritma **HMAC-SHA256**.
- Sistem secara otomatis menolak QR code yang URL atau ID-nya dimanipulasi secara manual.
- Anti-dobel scan aktif: jika siswa yang sama discan 2 kali di hari yang sama, sistem otomatis mendeteksi dan memberi tahu waktu absen pertamanya.
