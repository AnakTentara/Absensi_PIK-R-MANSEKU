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

3. **Kartu Fisik Tahan 3 Tahun & Dual-Purpose QR Code**
   - Format URL: `https://pikr-manseku.web.app/anggota/{idAnggota}?sig={token}`
   - Kartu dicetak 1 kali saat siswa mendaftar, dapat dipakai sampai lulus.
   - **Jika dipindai kamera HP umum / siapa saja:** Mengarahkan ke profil resmi anggota di portal [pikr-manseku.web.app](https://pikr-manseku.web.app).
   - **Jika dipindai scanner internal absensi (`absensi-pik-r.web.app`):** Memverifikasi tanda tangan digital HMAC dan membuka **Pop-Up Konfirmasi Presensi** (Nama, Kelas, Jabatan, Jam Masuk, Jam Keluar) dengan tombol "Kembali" & "Presensi".

4. **Kenyamanan Petugas & Interaksi Memuaskan (Satisfying Micro-Interactions)**
   - PWA Responsif & mobile-first (Android & iOS).
   - Pop-up modal konfirmasi saat QR terdeteksi untuk memastikan petugas memeriksa identitas siswa sebelum mencatat presensi.
   - Tombol 3D berpegas, logo yang memantul lembut, serta efek suara Web Audio API (pop, scanner beep, success fanfare) dan getaran getar (haptic feedback).
   - **Cegah Dobel Scan & Auto Masuk/Pulang:** Scan pertama otomatis mencatat jam masuk, scan kedua otomatis mencatat jam pulang.
   - **Antrean Offline:** Jika sinyal di madrasah mati, absensi disimpan di IndexedDB/localStorage dan otomatis tersinkron saat internet tersambung kembali.
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
│   ├── gas-web/Code.gs           # Versi Google Apps Script terintegrasi
│   └── SETUP_GUIDE.md            # Panduan langkah-demi-langkah deploy Google Sheets
├── frontend/
│   ├── index.html                # Portal Scanner Absensi & Pop-Up Konfirmasi Presensi
│   ├── dashboard.html            # Dashboard Rekapitulasi Presensi & Ekspor Excel
│   ├── generator.html            # Generator Kartu Tanda Anggota (KTA) & Plain QR
│   ├── css/
│   │   └── style.css             # Tema desain modern PIK-R, Glassmorphism & 3D buttons
│   ├── js/
│   │   ├── config.js             # Konfigurasi URL, Secret Key, Firebase & GAS
│   │   ├── firebase-init.js      # Inisialisasi Firebase SDK & Analytics
│   │   ├── crypto-util.js        # Utilitas HMAC-SHA256, Web Audio Synthesizer, & MemberRegistry
│   │   ├── scanner.js            # Controller kamera, modal konfirmasi presensi, & sinkronisasi
│   │   ├── dashboard.js          # Controller tabel, KPI stats, & SheetJS Excel exporter
│   │   └── generator.js          # Controller KTA generator, quick-pick anggota 2026, plain QR
│   ├── sw.js                     # Service Worker PWA Offline Cache (v4)
│   └── manifest.json             # Manifest Web App Android/iOS
├── firebase.json                 # Konfigurasi Firebase Hosting (site: absensi-pik-r)
├── .firebaserc                   # Target project absensi-pik-r (pik-r-ecosystem)
└── README.md                     # Dokumentasi utama proyek
```

---

## 🚀 Deployment Firebase Hosting (Multi-Site)

Sistem ini di-deploy di **Firebase Hosting**:
- **URL Live:** [https://absensi-pik-r.web.app](https://absensi-pik-r.web.app)
- **Project Firebase:** `absensi-pik-r` (Display Name: `pik-r-ecosystem`)
- **Site ID:** `absensi-pik-r`

Perintah deploy:
```bash
firebase deploy --only hosting:absensi-pik-r
```

---

## 🔒 Konfigurasi Keamanan

| Parameter | Nilai |
| :--- | :--- |
| **Algoritma** | HMAC-SHA256 |
| **Secret Salt** | `sistem_absensi_PIK-R_2026_programbyhaikal` |
| **Panjang Token** | 10 Karakter Hex (1.099.511.627.776 kombinasi) |
| **Pencegahan Fraud** | Brute-force proof, anti-replay, multi-role separation |
