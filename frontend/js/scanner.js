/**
 * Logika Scanner Kamera & Alur Absensi Senior
 * Sistem Absensi PIK-R MANSEKU - Program by Haikal
 */

let html5QrCode = null;
let isScanning = false;
let currentCameraId = null;
let availableCameras = [];
let lastScannedId = null;
let lastScanTime = 0;
let todayLogs = [];

document.addEventListener("DOMContentLoaded", () => {
  initElements();
  loadSavedPreferences();
  setupEventListeners();
  renderRecentLogs();
  checkAndSyncOfflineLogs();
});

function initElements() {
  window.btnStart = document.getElementById("btnStartScan");
  window.btnStop = document.getElementById("btnStopScan");
  window.btnSwitch = document.getElementById("btnSwitchCamera");
  window.laserGuide = document.getElementById("laserGuide");
  window.statusBadge = document.getElementById("scannerStatusBadge");
  window.inputPetugas = document.getElementById("inputPetugas");
  window.inputSesi = document.getElementById("inputSesi");
  window.resultCard = document.getElementById("scanResultCard");
}

function loadSavedPreferences() {
  const savedPetugas = localStorage.getItem(APP_CONFIG.LOCAL_STORAGE_KEYS.PETUGAS_NAME);
  if (savedPetugas && window.inputPetugas) {
    window.inputPetugas.value = savedPetugas;
  }
  const savedSesi = localStorage.getItem(APP_CONFIG.LOCAL_STORAGE_KEYS.LAST_SESSION);
  if (savedSesi && window.inputSesi) {
    window.inputSesi.value = savedSesi;
  }
}

function setupEventListeners() {
  window.btnStart.addEventListener("click", startCameraScanner);
  window.btnStop.addEventListener("click", stopCameraScanner);
  window.btnSwitch.addEventListener("click", switchCamera);

  if (window.inputPetugas) {
    window.inputPetugas.addEventListener("change", (e) => {
      localStorage.setItem(APP_CONFIG.LOCAL_STORAGE_KEYS.PETUGAS_NAME, e.target.value.trim());
    });
  }

  if (window.inputSesi) {
    window.inputSesi.addEventListener("change", (e) => {
      localStorage.setItem(APP_CONFIG.LOCAL_STORAGE_KEYS.LAST_SESSION, e.target.value.trim());
    });
  }

  // Tombol Scan Berikutnya
  document.getElementById("btnNextScan").addEventListener("click", () => {
    window.resultCard.classList.remove("show");
  });

  // Modal Manual
  const modalManual = document.getElementById("manualModal");
  document.getElementById("btnManualInput").addEventListener("click", () => {
    modalManual.style.display = "flex";
  });
  document.getElementById("btnCloseManual").addEventListener("click", () => {
    modalManual.style.display = "none";
  });
  document.getElementById("btnSubmitManual").addEventListener("click", handleManualSubmit);

  // Modal GAS Config
  const modalGas = document.getElementById("gasConfigModal");
  const inputGas = document.getElementById("inputGasEndpoint");
  document.getElementById("btnConfigGAS").addEventListener("click", () => {
    inputGas.value = APP_CONFIG.GAS_ENDPOINT_URL;
    modalGas.style.display = "flex";
  });
  document.getElementById("btnCloseGasModal").addEventListener("click", () => {
    modalGas.style.display = "none";
  });
  document.getElementById("btnSaveGasConfig").addEventListener("click", () => {
    const newUrl = inputGas.value.trim();
    if (newUrl) {
      APP_CONFIG.GAS_ENDPOINT_URL = newUrl;
      localStorage.setItem(APP_CONFIG.LOCAL_STORAGE_KEYS.CUSTOM_GAS_URL, newUrl);
      showToast("URL Google Apps Script berhasil disimpan!", "success");
      modalGas.style.display = "none";
    }
  });
  document.getElementById("btnTestPingGAS").addEventListener("click", testPingGAS);

  // Search log filter
  document.getElementById("searchLog").addEventListener("input", (e) => {
    filterRecentLogs(e.target.value);
  });
}

/**
 * Memulai Scanner Kamera
 */
async function startCameraScanner() {
  try {
    if (typeof Html5Qrcode === "undefined") {
      showToast("Library scanner gagal dimuat. Pastikan terhubung internet.", "error");
      return;
    }

    window.statusBadge.textContent = "Membuka Kamera...";
    window.statusBadge.className = "badge badge-warning";

    html5QrCode = new Html5Qrcode("reader");

    availableCameras = await Html5Qrcode.getCameras();
    if (!availableCameras || availableCameras.length === 0) {
      showToast("Tidak ditemukan kamera pada perangkat ini.", "error");
      window.statusBadge.textContent = "Kamera Tidak Ditemukan";
      window.statusBadge.className = "badge badge-danger";
      return;
    }

    // Prioritaskan kamera belakang (environment)
    let selectedCamera = availableCameras[0].id;
    for (let cam of availableCameras) {
      if (cam.label.toLowerCase().includes("back") || cam.label.toLowerCase().includes("belakang") || cam.label.toLowerCase().includes("environment")) {
        selectedCamera = cam.id;
        break;
      }
    }
    currentCameraId = selectedCamera;

    const qrConfig = {
      fps: 15,
      qrbox: { width: 230, height: 230 },
      aspectRatio: 1.0
    };

    await html5QrCode.start(
      currentCameraId,
      qrConfig,
      onScanSuccess,
      onScanFailure
    );

    isScanning = true;
    window.btnStart.style.display = "none";
    window.btnStop.style.display = "inline-flex";
    if (availableCameras.length > 1) {
      window.btnSwitch.style.display = "inline-flex";
    }
    window.laserGuide.style.display = "block";
    window.statusBadge.textContent = "Kamera Aktif";
    window.statusBadge.className = "badge badge-success";

  } catch (err) {
    console.error("Gagal memulai kamera:", err);
    showToast("Izin kamera ditolak atau kamera sedang dipakai aplikasi lain.", "error");
    window.statusBadge.textContent = "Akses Ditolak";
    window.statusBadge.className = "badge badge-danger";
  }
}

/**
 * Hentikan Scanner
 */
async function stopCameraScanner() {
  if (html5QrCode && isScanning) {
    await html5QrCode.stop();
    html5QrCode.clear();
    isScanning = false;
    window.btnStart.style.display = "inline-flex";
    window.btnStop.style.display = "none";
    window.btnSwitch.style.display = "none";
    window.laserGuide.style.display = "none";
    window.statusBadge.textContent = "Kamera Nonaktif";
    window.statusBadge.className = "badge badge-info";
  }
}

/**
 * Ganti Kamera (Depan / Belakang)
 */
async function switchCamera() {
  if (availableCameras.length <= 1) return;
  await stopCameraScanner();
  const currentIndex = availableCameras.findIndex(c => c.id === currentCameraId);
  const nextIndex = (currentIndex + 1) % availableCameras.length;
  currentCameraId = availableCameras[nextIndex].id;
  await startCameraScanner();
}

/**
 * Handler Ketika QR Code Berhasil Terbaca
 */
async function onScanSuccess(decodedText) {
  const now = Date.now();
  // Cegah scan ganda dalam 2 detik untuk barcode yang sama
  if (decodedText === lastScannedId && now - lastScanTime < 2500) {
    return;
  }
  lastScannedId = decodedText;
  lastScanTime = now;

  console.log("QR Terdeteksi:", decodedText);

  // 1. Parse Payload URL / ID & Signature
  const parsed = CryptoUtil.parseQrPayload(decodedText);
  if (!parsed || !parsed.id) {
    CryptoUtil.Sound.playError();
    triggerHaptic([100, 50, 100]);
    showToast("Format QR Code tidak dikenali!", "error");
    return;
  }

  // 2. Validasi Kriptografis HMAC-SHA256
  const isValidSignature = await CryptoUtil.verifySignature(parsed.id, parsed.sig);

  if (!isValidSignature) {
    CryptoUtil.Sound.playError();
    triggerHaptic([150, 80, 150]);
    displayScanResult({
      status: "invalid",
      id: parsed.id,
      nama: "Kartu Palsu / Tidak Sah",
      kelas: "Signature Mismatch",
      message: "TANDA TANGAN DIGITAL TIDAK COCOK! QR diduga dibuat tanpa izin sistem resmi."
    });
    showToast("Peringatan: Tanda tangan QR tidak valid!", "error");
    return;
  }

  // 3. Tanda Tangan Valid! Mainkan Audio Beep Sukses
  CryptoUtil.Sound.playSuccess();
  triggerHaptic([60]);

  // 4. Catat Kehadiran ke Backend
  await recordAttendance({
    id: parsed.id,
    sig: parsed.sig,
    petugas: (window.inputPetugas ? window.inputPetugas.value.trim() : "") || "Kakak Senior",
    sesi: (window.inputSesi ? window.inputSesi.value.trim() : "") || "Pertemuan Rutin",
    statusKehadiran: "Hadir"
  });
}

function onScanFailure(error) {
  // Silent frame error
}

/**
 * Kirim Absensi ke Google Apps Script / Simpan Offline
 */
async function recordAttendance(payload) {
  displayScanResult({
    status: "processing",
    id: payload.id,
    nama: "Memverifikasi data...",
    kelas: "Mohon tunggu sebentar",
    message: "Menghubungkan ke Google Sheets..."
  });

  const now = new Date();
  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  try {
    const postPayload = {
      action: "record_attendance",
      id: payload.id,
      sig: payload.sig,
      petugas: payload.petugas,
      sesi: payload.sesi,
      statusKehadiran: payload.statusKehadiran,
      catatan: payload.catatan || "-"
    };

    // Cek apakah URL GAS sudah dikonfigurasi nyata atau masih placeholder
    const isMock = APP_CONFIG.GAS_ENDPOINT_URL.includes("GANTI_DENGAN_DEPLOYMENT_ID");

    let responseData = null;

    if (isMock) {
      // Mock Fallback jika user belum memasang ID Apps Script nyata
      await new Promise(r => setTimeout(r, 600));
      responseData = {
        status: "success",
        message: "Absensi tersimpan di sistem lokal (Demo Mode)",
        data: {
          id: payload.id,
          nama: "Anggota (" + payload.id + ")",
          kelas: "Kelas Aktif",
          jam: timeStr,
          status: payload.statusKehadiran,
          sesi: payload.sesi
        }
      };
    } else {
      // Kirim ke Google Apps Script Backend
      const res = await fetch(APP_CONFIG.GAS_ENDPOINT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(postPayload)
      });
      responseData = await res.json();
    }

    if (responseData.status === "success") {
      const data = responseData.data || {};
      const record = {
        id: data.id || payload.id,
        nama: data.nama || payload.id,
        kelas: data.kelas || "-",
        jam: data.jam || timeStr,
        status: data.status || payload.statusKehadiran,
        petugas: payload.petugas
      };

      addLogItem(record);
      displayScanResult({
        status: "success",
        id: record.id,
        nama: record.nama,
        kelas: record.kelas,
        jam: record.jam,
        message: "Absensi BERHASIL dicatat ke Google Sheets!"
      });
      showToast(`Berhasil absen: ${record.nama}`, "success");

    } else if (responseData.status === "already_recorded") {
      CryptoUtil.Sound.playWarning();
      triggerHaptic([80, 50, 80]);
      
      const member = responseData.member || {};
      displayScanResult({
        status: "warning",
        id: member.id || payload.id,
        nama: member.nama || payload.id,
        kelas: member.kelas || "-",
        message: responseData.message || "Anggota ini SUDAH ABSEN sebelumnya hari ini."
      });
      showToast("Sudah absen sebelumnya!", "warning");

    } else {
      CryptoUtil.Sound.playError();
      displayScanResult({
        status: "error",
        id: payload.id,
        nama: "Gagal Absen",
        kelas: "-",
        message: responseData.message || "Terjadi kesalahan pada sistem."
      });
      showToast(responseData.message || "Gagal mencatat absensi", "error");
    }

  } catch (netErr) {
    console.warn("Gagal terhubung ke Google Apps Script, menyimpan ke antrean offline:", netErr);
    
    // Offline Storage Backup
    saveToOfflineQueue(payload, timeStr);
    
    displayScanResult({
      status: "offline_saved",
      id: payload.id,
      nama: "Tersimpan Offline",
      kelas: "Koneksi Terputus",
      jam: timeStr,
      message: "Data diamankan di memori HP. Otomatis disinkronkan saat sinyal pulih."
    });
    showToast("Disimpan offline (akan sync saat online)", "warning");
  }
}

/**
 * Tampilkan Hasil Scan di Kartu Info
 */
function displayScanResult(info) {
  window.resultCard.classList.add("show");
  
  const resBadge = document.getElementById("resBadge");
  const resNama = document.getElementById("resNama");
  const resId = document.getElementById("resId");
  const resKelas = document.getElementById("resKelas");
  const resAvatar = document.getElementById("resAvatar");
  const resMessage = document.getElementById("resMessage");
  const resTime = document.getElementById("resTime");
  const resStatusDetail = document.getElementById("resStatusDetail");

  resNama.textContent = info.nama;
  resId.textContent = info.id;
  resKelas.textContent = info.kelas;
  resMessage.textContent = info.message;
  resTime.textContent = info.jam || new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
  resAvatar.textContent = info.nama ? info.nama.charAt(0).toUpperCase() : "P";

  if (info.status === "success") {
    resBadge.className = "badge badge-success";
    resBadge.textContent = "Hadir ✓";
    resStatusDetail.textContent = "Status: Hadir Resmi";
    resStatusDetail.style.color = "var(--primary)";
  } else if (info.status === "warning") {
    resBadge.className = "badge badge-warning";
    resBadge.textContent = "Sudah Absen";
    resStatusDetail.textContent = "Status: Duplikat Hari Ini";
    resStatusDetail.style.color = "var(--warning)";
  } else if (info.status === "invalid" || info.status === "error") {
    resBadge.className = "badge badge-danger";
    resBadge.textContent = "Ditolak ✕";
    resStatusDetail.textContent = "Status: Tidak Sah";
    resStatusDetail.style.color = "var(--danger)";
  } else if (info.status === "offline_saved") {
    resBadge.className = "badge badge-info";
    resBadge.textContent = "Disimpan Offline ☁️";
    resStatusDetail.textContent = "Status: Menunggu Sinkronisasi";
    resStatusDetail.style.color = "var(--secondary)";
  }
}

/**
 * Tambahkan Log Scan ke UI & Local Storage
 */
function addLogItem(item) {
  todayLogs.unshift(item);
  renderRecentLogs();
}

function renderRecentLogs() {
  const container = document.getElementById("recentLogsList");
  const badge = document.getElementById("scanCounterBadge");

  badge.textContent = `${todayLogs.length} Hadir`;

  if (todayLogs.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); font-size: 0.85rem;">
        Belum ada anggota yang discan hari ini.<br>Arahkan kamera ke QR Code pada kartu fisik anggota.
      </div>
    `;
    return;
  }

  container.innerHTML = todayLogs.map(log => `
    <div class="log-item">
      <div class="log-details">
        <h4>${log.nama}</h4>
        <span>${log.id} • ${log.kelas} • Petugas: ${log.petugas}</span>
      </div>
      <div style="text-align: right;">
        <span class="badge badge-success">${log.status}</span>
        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem;">${log.jam}</div>
      </div>
    </div>
  `).join("");
}

function filterRecentLogs(keyword) {
  const q = keyword.toLowerCase().trim();
  const items = document.querySelectorAll("#recentLogsList .log-item");
  items.forEach(el => {
    const text = el.textContent.toLowerCase();
    el.style.display = text.includes(q) ? "flex" : "none";
  });
}

/**
 * Handle Absen Manual Jika Kartu Tertinggal
 */
async function handleManualSubmit() {
  const id = document.getElementById("manualId").value.trim().toUpperCase();
  const status = document.getElementById("manualStatus").value;
  const catatan = document.getElementById("manualCatatan").value.trim();

  if (!id) {
    showToast("Silakan masukkan ID Anggota.", "warning");
    return;
  }

  // Hitung signature resmi secara otomatis
  const sig = await CryptoUtil.generateSignature(id);

  document.getElementById("manualModal").style.display = "none";
  document.getElementById("manualId").value = "";
  document.getElementById("manualCatatan").value = "";

  await recordAttendance({
    id: id,
    sig: sig,
    petugas: (window.inputPetugas ? window.inputPetugas.value.trim() : "") || "Kakak Senior",
    sesi: (window.inputSesi ? window.inputSesi.value.trim() : "") || "Pertemuan Rutin",
    statusKehadiran: status,
    catatan: catatan ? "Manual: " + catatan : "Manual Input"
  });
}

/**
 * Simpan data ke Offline Queue jika koneksi internet terputus
 */
function saveToOfflineQueue(payload, timeStr) {
  const queue = JSON.parse(localStorage.getItem(APP_CONFIG.LOCAL_STORAGE_KEYS.OFFLINE_LOGS) || "[]");
  queue.push({
    payload: payload,
    savedAt: timeStr,
    timestamp: Date.now()
  });
  localStorage.setItem(APP_CONFIG.LOCAL_STORAGE_KEYS.OFFLINE_LOGS, JSON.stringify(queue));
}

/**
 * Cek dan Sinkronkan Antrean Offline ke Google Sheets
 */
async function checkAndSyncOfflineLogs() {
  const queue = JSON.parse(localStorage.getItem(APP_CONFIG.LOCAL_STORAGE_KEYS.OFFLINE_LOGS) || "[]");
  if (queue.length === 0) return;

  if (APP_CONFIG.GAS_ENDPOINT_URL.includes("GANTI_DENGAN_DEPLOYMENT_ID")) return;

  console.log(`Menemukan ${queue.length} log offline. Mencoba sinkronisasi...`);

  const remaining = [];
  for (let item of queue) {
    try {
      const res = await fetch(APP_CONFIG.GAS_ENDPOINT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "record_attendance",
          ...item.payload
        })
      });
      const data = await res.json();
      if (data.status === "success" || data.status === "already_recorded") {
        console.log("Log offline tersinkron:", item.payload.id);
      } else {
        remaining.push(item);
      }
    } catch (e) {
      remaining.push(item);
    }
  }

  localStorage.setItem(APP_CONFIG.LOCAL_STORAGE_KEYS.OFFLINE_LOGS, JSON.stringify(remaining));
  if (queue.length > remaining.length) {
    showToast(`${queue.length - remaining.length} data absensi offline berhasil disinkronkan ke Spreadsheet!`, "success");
  }
}

/**
 * Tes Ping Koneksi ke Google Apps Script
 */
async function testPingGAS() {
  const url = document.getElementById("inputGasEndpoint").value.trim();
  if (!url) {
    showToast("Masukkan URL terlebih dahulu.", "warning");
    return;
  }

  showToast("Menguji koneksi ke Google Apps Script...", "info");

  try {
    const res = await fetch(`${url}?action=ping`);
    const data = await res.json();
    if (data.status === "success") {
      showToast("Koneksi SUKSES! Spreadsheet terhubung.", "success");
    } else {
      showToast("Tersambung namun respon tidak sesuai.", "warning");
    }
  } catch (err) {
    showToast("Gagal terhubung. Pastikan Web App sudah di-deploy dengan akses 'Anyone'.", "error");
  }
}

/**
 * Toast Notification UI Helper
 */
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function triggerHaptic(pattern = [50]) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}
