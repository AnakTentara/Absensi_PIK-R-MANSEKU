# Cara Menjalankan Website Penuh di scripts.google.com (100% Gratis & All-in-One)

Dengan cara ini, seluruh sistem (Database Google Sheets, Scanner Kamera, Dashboard Rekap, Download Excel, dan Generator Kartu KTA) hidup di dalam **satu link Google Apps Script** tanpa butuh server luar sama sekali!

---

## Langkah 1: Buka Google Sheets & Apps Script
1. Buka [Google Sheets](https://sheets.new) di browser Anda.
2. Klik menu **Ekstensi (Extensions)** > **Apps Script**.

## Langkah 2: Buat 2 Berkas di Apps Script Editor
Di bilah kiri editor Google Apps Script:
1. Pada berkas **`Code.gs`**:
   - Hapus isinya, lalu salin seluruh isi dari [`backend/gas-web/Code.gs`](file:///c:/Users/HP/Desktop/PIK-R%20Absent/backend/gas-web/Code.gs).
2. Tambahkan berkas HTML baru:
   - Klik ikon **`+`** di sebelah tulisan *Files / File* > pilih **HTML**.
   - Beri nama: **`App`** (huruf A besar, tanpa mengetik .html).
   - Hapus isinya, lalu salin seluruh isi dari [`backend/gas-web/App.html`](file:///c:/Users/HP/Desktop/PIK-R%20Absent/backend/gas-web/App.html).
3. Klik ikon **Save** (Disket / Ctrl + S).

## Langkah 3: Inisialisasi Database Pertama Kali
1. Di bilah menu atas, pilih fungsi **`setupDatabase`** pada daftar dropdown.
2. Klik **Run (Jalankan)** dan berikan izin akses Google (Review Permissions > Advanced > Go to Backend... > Allow).
3. Database `Data_Anggota`, `Riwayat_Absensi`, dan `Pengaturan` otomatis terbuat di sheet!

## Langkah 4: Publikasikan Web App
1. Di kanan atas, klik tombol biru **Deploy** > **New deployment**.
2. Klik ikon gear ⚙️ > pilih **Web app**.
3. Atur konfigurasi:
   - **Description**: `Web Absensi PIK-R MANSEKU v1.0`
   - **Execute as**: **`Me (Akun Google Anda)`**
   - **Who has access**: **`Anyone`** (Siapa saja)
4. Klik **Deploy**.
5. Salin **Web app URL** yang muncul (misalnya: `https://script.google.com/macros/s/AKfycb.../exec`).

---

🎉 **SELESAI!**
Buka URL tersebut di browser HP atau laptop Anda. Website PIK-R MANSEKU sudah langsung aktif dengan semua fitur (Scanner, Rekap, dan KTA)!
