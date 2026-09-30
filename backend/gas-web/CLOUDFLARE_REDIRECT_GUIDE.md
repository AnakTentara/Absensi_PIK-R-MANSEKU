# Panduan Menghubungkan absensi.pikr-manseku.my.id ke Google Apps Script via Cloudflare

Panduan ini mengatur agar subdomain **`absensi.pikr-manseku.my.id`** otomatis mengarah ke web Google Apps Script dengan mempertahankan tanda tangan kriptografis dan parameter kartu anggota seumur hidup.

---

## 1. Tambahkan DNS Record di Cloudflare
1. Buka dashboard [Cloudflare](https://dash.cloudflare.com/) > Klik domain **`pikr-manseku.my.id`**.
2. Masuk ke tab **DNS** > **Records**.
3. Klik tombol **Add record**:
   - **Type**: `A`
   - **Name**: `absensi`
   - **IPv4 address**: `192.0.2.1` *(Dummy IP Cloudflare)*
   - **Proxy status**: **Proxied** (Awan Oranye ☁️ Aktif)
4. Klik **Save**.

---

## 2. Atur Redirect Rule (Pengalihan Otomatis)
1. Di bilah menu kiri Cloudflare, klik **Rules** > **Redirect Rules**.
2. Klik tombol **Create rule**.
3. Atur formulir berikut:
   - **Rule name**: `Redirect Subdomain Absensi ke Google Apps Script`
   - **When incoming requests match...**:
     - Pilih **Custom filter expression**
     - Field: `Hostname`
     - Operator: `equals`
     - Value: `absensi.pikr-manseku.my.id`
   - **Then... (URL Redirect)**:
     - Type: **Dynamic**
     - Expression:
       ```text
       concat("https://script.google.com/macros/s/AKfycb...MASUKKAN_DEPLOYMENT_ID_ANDA.../exec", http.request.uri.path, "?", http.request.uri.query)
       ```
     - Status code: **`302`** (Temporary Redirect)
     - Centang pilihan: **Preserve query string**
4. Klik **Deploy**.

---

## 3. Keuntungan Sistem Ini untuk Masa Depan
1. **Kartu Pelajar / KTA Bersih:**  
   Isi QR code pada kartu fisik anggota:
   ```text
   https://absensi.pikr-manseku.my.id?id=PIKR-2026-001&sig=2D76E6C288
   ```
2. **Tidak Perlu Cetak Ulang Kartu Jika Ganti Script:**  
   Jika tahun depan Anda membuat script baru atau Google memberikan URL deploy baru, Anda **tidak perlu menarik kartu fisik siswa**. Cukup ubah URL target di Redirect Rule Cloudflare, dan semua kartu lama otomatis tetap berfungsi normal!
