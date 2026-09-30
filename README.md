# 🌟 Sistem Absensi PIK-R MANSEKU (Lifetime & Future-Proof)

> **Pusat Informasi dan Konseling Remaja (PIK-R) MAN 1 Muara Enim (MANSEKU)**  
> Dirancang dan diprogram oleh **Haikal (2026)** untuk penggunaan seumur hidup (*lifetime use*), bebas biaya server, dan tahan manipulasi kartu.

---

## 🏛️ Arsitektur & Keunggulan Sistem

1. **Lifetime & Rp 0 Biaya Selamanya (Zero Cost Serverless)**
   - Backend menggunakan **Google Apps Script (GAS)** terhubung langsung ke **Google Sheets**.
   - Tidak perlu menyewa VPS, domain backend khusus, atau database SQL berbayar bulanan.
   - Siapa saja (bahkan adik-adik pengurus baru setelah pergantian generasi) dapat mengelola data hanya dengan membuka Google Spreadsheet.

2. **Keamanan Kriptografi HMAC-SHA256 (Anti-QR Palsu)**
   - **Secret Key:** `sistem_absensi_PIK-R_2026_programbyhaikal`
   - Setiap kartu memiliki token digital turunan:  
     $$\text{Token} = \text{HMAC-SHA256}(\text{ID Anggota}, \text{Secret Key})$$
   - Oknum siswa yang mencoba membuat QR sendiri dengan ID sembarang **pasti ditolak sistem** karena tidak memiliki Secret Key server.

3. **Kartu Fisik Tahan 3 Tahun (Agnostik & Multi-Peran)**
   - Format URL: `https://absensi.pikr-manseku.my.id/id/{idAnggota}?sig={token}`
   - Kartu dicetak 1 kali saat siswa mendaftar, dapat dipakai sampai lulus.
   - **Jika discan kamera HP umum:** Membuka verifikasi identitas resmi anggota PIK-R.
   - **Jika discan oleh HP Kakak Senior (Scanner Absen):** Langsung mencatat kehadiran ke Google Sheets.

4. **Kenyamanan Kakak Senior (Scanner Web App)**
   - Akses instan di browser HP (Chrome / Safari) tanpa install APK berat.
   - Dilengkapi **Audio Chime (D5-A5 Sine Wave)** dan **Getar (Haptic Feedback)** saat berhasil scan.
   - **Cegah Dobel Scan:** Anggota yang sama tidak bisa absen dua kali dalam 1 pertemuan.
   - **Antrean Offline:** Jika sinyal di madrasah mati, absensi disimpan di memori HP dan otomatis tersinkron saat internet tersambung kembali.
   - **Absen Manual:** Tersedia tombol darurat jika kartu siswa tertinggal di kelas.

5. **Ekspor Data Online & Offline 1-Klik**
   - Data otomatis tersimpan di Google Sheets online.
   - Tersedia tombol ekspor ke **Excel (`.xlsx`)** dan **CSV** langsung dari browser dashboard.

---

## 📁 Struktur Berkas Proyek

```
PIK-R Absent/
├── backend/
│   ├── Code.gs                   # Engine REST API Google Apps Script (doGet & doPost)
│   └── SETUP_GUIDE.md            # Panduan langkah-demi-langkah deploy Google Sheets
├── frontend/
│   ├── index.html                # Portal Scanner Absensi Kakak Senior (absensi.pikr-manseku.my.id)
│   ├── dashboard.html            # Dashboard Rekapitulasi Presensi & Ekspor Excel
│   ├── generator.html            # Generator Kartu Tanda Anggota (KTA) & QR Cetak A4
│   ├── css/
│   │   └── style.css             # Tema desain modern PIK-R (Emerald & Slate)
│   └── js/
│       ├── config.js             # Konfigurasi URL, Secret Key, & Endpoint
│       ├── crypto-util.js        # Utilitas HMAC-SHA256 & Web Audio API synthesizer
│       ├── scanner.js            # Controller kamera, validasi QR, & sinkronisasi
│       ├── dashboard.js          # Controller tabel, KPI stats, & SheetJS Excel exporter
│       └── generator.js          # Controller batch card generation & format A4 cetak
└── README.md                     # Dokumentasi utama proyek
```

---

## 🚀 Cara Menjalankan & Menguji Coba di Komputer Lokal

Kamu bisa membuka halaman web frontend langsung di browser:
1. Buka folder `frontend/`
2. Klik ganda file `index.html` (atau gunakan ekstensi Live Server di VS Code / `npx serve frontend`).
3. Kamu bisa mencoba fitur:
   - **`generator.html`**: Masukkan nama dan ID, kartu KTA otomatis terbentuk lengkap dengan QR Code bertanda tangan resmi!
   - **`index.html`**: Arahkan kamera ke QR yang dihasilkan tadi untuk mengetes bunyi *beep* dan pencatatan presensi.
   - **`dashboard.html`**: Lihat data yang tersimpan dan uji download file Excel `.xlsx`.

---

## 🌐 Panduan Publikasi ke Domain `pikr-manseku.my.id`

1. **Frontend Hosting (Gratis Selamanya):**
   - Upload folder `frontend/` ke **Cloudflare Pages**, **GitHub Pages**, atau **Vercel**.
   - Arahkan subdomain di DNS:
     - `absensi.pikr-manseku.my.id` ➡️ Mengarah ke `frontend/`
2. **Backend Google Apps Script:**
   - Ikuti panduan di [`backend/SETUP_GUIDE.md`](file:///c:/Users/HP/Desktop/PIK-R%20Absent/backend/SETUP_GUIDE.md).
   - Salin URL Web App yang dihasilkan, lalu tempel di [`frontend/js/config.js`](file:///c:/Users/HP/Desktop/PIK-R%20Absent/frontend/js/config.js) pada variabel `GAS_ENDPOINT_URL`.

---

## 🔒 Konfigurasi Keamanan

| Parameter | Nilai |
| :--- | :--- |
| **Algoritma** | HMAC-SHA256 |
| **Secret Salt** | `sistem_absensi_PIK-R_2026_programbyhaikal` |
| **Panjang Token** | 10 Karakter Hex (1.099.511.627.776 kombinasi) |
| **Pencegahan Fraud** | Brute-force proof, anti-replay, multi-role separation |
