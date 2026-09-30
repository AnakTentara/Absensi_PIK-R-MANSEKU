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
let pendingAttendancePayload = null;
let isModalConfirmOpen = false;

document.addEventListener("DOMContentLoaded", () => {
  initElements();
  loadSavedPreferences();
  setupEventListeners();
  renderRecentLogs();
  checkAndSyncOfflineLogs();
  checkUrlParameters();
});

async function checkUrlParameters() {
  try {
    const url = new URL(window.location.href);
    let id = url.searchParams.get("id");
    let sig = url.searchParams.get("sig");

    if (!id && url.pathname.includes("/id/")) {
      const parts = url.pathname.split("/id/");
      if (parts[1]) {
        id = parts[1].split("/")[0].split("?")[0].trim().toUpperCase();
      }
    }

    if (id && sig) {
      console.log("Mendeteksi scan QR dari URL parameter / path:", id, sig);
      setTimeout(() => {
        onScanSuccess(window.location.href, null);
      }, 350);
    }
  } catch (e) {
    console.warn("URL parameter check error:", e);
  }
}

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

  // Setup Agenda Dropdown & Custom Text
  const selAgenda = document.getElementById("selectAgenda");
  const inputCustom = document.getElementById("inputSesiCustom");
  if (selAgenda && inputCustom) {
    selAgenda.addEventListener("change", (e) => {
      if (e.target.value === "__CUSTOM__") {
        inputCustom.style.display = "block";
        inputCustom.focus();
      } else {
        inputCustom.style.display = "none";
        localStorage.setItem(APP_CONFIG.LOCAL_STORAGE_KEYS.LAST_SESSION, e.target.value);
      }
    });
    inputCustom.addEventListener("input", (e) => {
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

  // Modal Form Izin Online
  const modalPermit = document.getElementById("permitModal");
  const btnOpenPermit = document.getElementById("btnOpenPermit");
  if (btnOpenPermit && modalPermit) {
    btnOpenPermit.addEventListener("click", () => { modalPermit.style.display = "flex"; });
    document.getElementById("btnClosePermit").addEventListener("click", () => { modalPermit.style.display = "none"; });
    document.getElementById("btnSubmitPermit").addEventListener("click", handleSubmitPermit);
  }

  // Setup PWA Service Worker & Install Prompt
  setupPwaFeatures();

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

  // Native Camera & Gallery file handlers (100% Mobile & Sandboxed proof)
  const camInput = document.getElementById("qrCameraFileInput");
  const galInput = document.getElementById("qrGalleryFileInput");
  const btnNative = document.getElementById("btnNativeCamera");
  const btnGal = document.getElementById("btnGalleryFile");

  if (btnNative && camInput) {
    btnNative.addEventListener("click", () => camInput.click());
  }
  if (btnGal && galInput) {
    btnGal.addEventListener("click", () => galInput.click());
  }

  const handleFileScan = async (file) => {
    if (!file) return;
    showToast("Menganalisis foto QR...", "info");
    try {
      if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
      }
      const decodedText = await html5QrCode.scanFile(file, true);
      if (decodedText) {
        onScanSuccess(decodedText, null);
      } else {
        throw new Error("QR tidak terdeteksi");
      }
    } catch (e) {
      console.error("Scan file error:", e);
      if (audioEngine) audioEngine.buzzError();
      showToast("Foto QR tidak terbaca. Pastikan foto cukup terang & fokus!", "error");
    }
  };

  if (camInput) camInput.addEventListener("change", (e) => { handleFileScan(e.target.files[0]); e.target.value = ""; });
  if (galInput) galInput.addEventListener("change", (e) => { handleFileScan(e.target.files[0]); e.target.value = ""; });

  // Modal Konfirmasi Presensi Hasil Scan QR
  const modalConfirm = document.getElementById("scanConfirmModal");
  const btnCancelConfirm = document.getElementById("btnCancelScanConfirm");
  const btnTopCloseConfirm = document.getElementById("btnTopCloseConfirm");
  const btnExecConfirm = document.getElementById("btnExecuteAttendance");

  if (btnCancelConfirm) btnCancelConfirm.addEventListener("click", closeScanConfirmModal);
  if (btnTopCloseConfirm) btnTopCloseConfirm.addEventListener("click", closeScanConfirmModal);
  if (btnExecConfirm) btnExecConfirm.addEventListener("click", executeConfirmedAttendance);

  // Mobile Friendly: Klik latar belakang modal untuk menutup
  [modalManual, modalPermit, modalGas, modalConfirm].forEach(m => {
    if (m) {
      m.addEventListener("click", (e) => {
        if (e.target === m) {
          if (m === modalConfirm) {
            closeScanConfirmModal();
          } else {
            m.style.display = "none";
          }
        }
      });
    }
  });

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

    const qrBoxSize = Math.min(window.innerWidth - 60, 240);
    const qrConfig = {
      fps: 15,
      qrbox: { width: qrBoxSize, height: qrBoxSize },
      aspectRatio: 1.0
    };

    // Coba langsung buka kamera belakang via facingMode (Sangat mulus di Android & iOS)
    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        qrConfig,
        onScanSuccess,
        onScanFailure
      );
    } catch (modeErr) {
      // Fallback enumerate camera jika facingMode khusus tidak didukung
      availableCameras = await Html5Qrcode.getCameras();
      if (!availableCameras || availableCameras.length === 0) {
        throw new Error("Tidak ditemukan kamera pada perangkat ini.");
      }

      let selectedCamera = availableCameras[0].id;
      for (let cam of availableCameras) {
        if (cam.label.toLowerCase().includes("back") || cam.label.toLowerCase().includes("belakang") || cam.label.toLowerCase().includes("environment")) {
          selectedCamera = cam.id;
          break;
        }
      }
      currentCameraId = selectedCamera;
      await html5QrCode.start(currentCameraId, qrConfig, onScanSuccess, onScanFailure);
    }


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
 * Handler Ketika QR Code Berhasil Terbaca (Memicu Pop-Up Konfirmasi)
 */
async function onScanSuccess(decodedText) {
  if (isModalConfirmOpen) {
    return;
  }

  const now = Date.now();
  // Cegah scan ganda dalam 2.5 detik untuk QR yang sama jika modal belum terbuka
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
    CryptoUtil.Sound.triggerHaptic([100, 50, 100]);
    showToast("Format QR Code tidak dikenali!", "error");
    return;
  }

  // 2. Validasi Kriptografis HMAC-SHA256
  const isValidSignature = await CryptoUtil.verifySignature(parsed.id, parsed.sig);

  if (!isValidSignature) {
    CryptoUtil.Sound.playError();
    CryptoUtil.Sound.triggerHaptic([150, 80, 150]);
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

  // 3. Tanda Tangan Valid! Cari identitas lengkap siswa (Nama, Kelas, Jabatan)
  const member = (typeof MemberRegistry !== "undefined")
    ? MemberRegistry.findById(parsed.id)
    : { id: parsed.id, nama: "Anggota (" + parsed.id + ")", kelas: "XI IPA 1", jabatan: "Anggota Medinfo" };

  // 4. Periksa riwayat hari ini: Otomatis Masuk -> Pulang
  const existing = todayLogs.find(l => (l.id || l.idAnggota || "").toUpperCase() === parsed.id.toUpperCase());
  const currentTime = new Date();
  const timeFormatted = currentTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";

  let scanType = "MASUK";
  let jamMasukDisplay = timeFormatted;
  let jamKeluarDisplay = "-";

  if (!existing) {
    scanType = "MASUK";
    jamMasukDisplay = timeFormatted;
    jamKeluarDisplay = "-";
  } else if (!existing.jamPulang || existing.jamPulang === "-") {
    scanType = "PULANG";
    jamMasukDisplay = existing.jamMasuk || existing.jam || timeFormatted;
    jamKeluarDisplay = timeFormatted;
  } else {
    scanType = "LENGKAP";
    jamMasukDisplay = existing.jamMasuk || existing.jam || "-";
    jamKeluarDisplay = existing.jamPulang;
  }

  // 5. Buka Pop-Up Konfirmasi Presensi
  openScanConfirmModal(member, scanType, jamMasukDisplay, jamKeluarDisplay, parsed);
}

function onScanFailure(error) {
  // Silent frame error
}

/**
 * Menampilkan Pop-Up Konfirmasi Presensi
 */
function openScanConfirmModal(member, scanType, jamMasuk, jamKeluar, parsed) {
  // Pause frame scanner agar kamera tidak terus menerus memindai di background
  if (html5QrCode && isScanning) {
    try { html5QrCode.pause(true); } catch (e) {}
  }

  CryptoUtil.Sound.playPop();
  CryptoUtil.Sound.triggerHaptic(25);

  const modal = document.getElementById("scanConfirmModal");
  if (!modal) return;

  const badgeEl = document.getElementById("modalScanTypeBadge");
  const avatarEl = document.getElementById("modalAvatar");
  const namaEl = document.getElementById("modalNama");
  const idEl = document.getElementById("modalId");
  const kelasEl = document.getElementById("modalKelas");
  const jabatanEl = document.getElementById("modalJabatan");
  const masukEl = document.getElementById("modalJamMasuk");
  const keluarEl = document.getElementById("modalJamKeluar");
  const agendaEl = document.getElementById("modalAgenda");
  const petugasEl = document.getElementById("modalPetugas");
  const btnExec = document.getElementById("btnExecuteAttendance");

  if (avatarEl) avatarEl.textContent = member.nama ? member.nama.charAt(0).toUpperCase() : "A";
  if (namaEl) namaEl.textContent = member.nama;
  if (idEl) idEl.textContent = member.id;
  if (kelasEl) kelasEl.textContent = member.kelas || "-";
  if (jabatanEl) jabatanEl.textContent = member.jabatan || "Anggota Medinfo";
  if (masukEl) masukEl.textContent = jamMasuk;
  if (keluarEl) keluarEl.textContent = jamKeluar;
  if (agendaEl) agendaEl.textContent = getCurrentAgenda();
  if (petugasEl) petugasEl.textContent = (window.inputPetugas ? window.inputPetugas.value.trim() : "") || "Kakak Senior";

  if (badgeEl) {
    if (scanType === "PULANG") {
      badgeEl.className = "confirm-scan-badge badge-pulang";
      badgeEl.textContent = "🔵 Presensi Pulang (+5 Poin)";
    } else if (scanType === "LENGKAP") {
      badgeEl.className = "confirm-scan-badge badge-lengkap";
      badgeEl.textContent = "⭐ Kehadiran Lengkap";
    } else {
      badgeEl.className = "confirm-scan-badge badge-masuk";
      badgeEl.textContent = "🟢 Presensi Masuk (+10 Poin)";
    }
  }

  if (btnExec) {
    if (scanType === "PULANG") {
      btnExec.textContent = "⚡ Presensi Pulang";
      btnExec.className = "btn btn-primary confirm-btn-execute btn-pulang";
    } else if (scanType === "LENGKAP") {
      btnExec.textContent = "✓ Hadir Lengkap";
      btnExec.className = "btn btn-secondary confirm-btn-execute";
    } else {
      btnExec.textContent = "⚡ Presensi Masuk";
      btnExec.className = "btn btn-primary confirm-btn-execute";
    }
  }

  pendingAttendancePayload = {
    id: parsed.id,
    sig: parsed.sig,
    nama: member.nama,
    kelas: member.kelas,
    jabatan: member.jabatan,
    petugas: (window.inputPetugas ? window.inputPetugas.value.trim() : "") || "Kakak Senior",
    sesi: getCurrentAgenda(),
    statusKehadiran: "Hadir",
    scanType: scanType,
    jamMasuk: jamMasuk,
    jamKeluar: jamKeluar
  };

  isModalConfirmOpen = true;
  modal.style.display = "flex";
}

/**
 * Tutup Pop-Up Konfirmasi Presensi & Lanjutkan Scanning
 */
function closeScanConfirmModal() {
  const modal = document.getElementById("scanConfirmModal");
  if (modal) modal.style.display = "none";
  isModalConfirmOpen = false;
  pendingAttendancePayload = null;

  CryptoUtil.Sound.playDismiss();
  CryptoUtil.Sound.triggerHaptic(10);

  // Resume kamera jika scanner aktif
  if (html5QrCode && isScanning) {
    try { html5QrCode.resume(); } catch (e) {}
  }

  setTimeout(() => {
    lastScannedId = null;
  }, 1000);
}

/**
 * Eksekusi Presensi Setelah Dikonfirmasi Oleh Pengguna
 */
async function executeConfirmedAttendance() {
  if (!pendingAttendancePayload) return;
  const payload = { ...pendingAttendancePayload };

  const modal = document.getElementById("scanConfirmModal");
  if (modal) modal.style.display = "none";
  isModalConfirmOpen = false;
  pendingAttendancePayload = null;

  // Catat kehadiran
  await recordAttendance(payload);

  // Resume kamera setelah presensi dicatat
  if (html5QrCode && isScanning) {
    try { html5QrCode.resume(); } catch (e) {}
  }

  setTimeout(() => {
    lastScannedId = null;
  }, 1500);
}

/**
 * Dapatkan Nama Agenda yang Dipilih (Preset atau Ketik Sendiri)
 */
function getCurrentAgenda() {
  const sel = document.getElementById("selectAgenda");
  if (!sel) return "Pertemuan Mingguan";
  if (sel.value === "__CUSTOM__") {
    const custom = document.getElementById("inputSesiCustom").value.trim();
    return custom || "Pertemuan Khusus PIK-R";
  }
  return sel.value;
}

/**
 * Kirim Absensi ke Google Apps Script / Local Offline (Auto Check-In / Check-Out)
 */
async function recordAttendance(payload) {
  displayScanResult({
    status: "processing",
    id: payload.id,
    nama: payload.nama || "Memverifikasi data...",
    kelas: payload.kelas || "Mohon tunggu sebentar",
    jabatan: payload.jabatan || "Anggota",
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

    const isMock = APP_CONFIG.GAS_ENDPOINT_URL.includes("GANTI_DENGAN_DEPLOYMENT_ID");
    let responseData = null;

    if (isMock) {
      // Mock Fallback jika user belum memasang ID Apps Script nyata
      await new Promise(r => setTimeout(r, 450));
      const existing = todayLogs.find(l => (l.id || l.idAnggota || "").toUpperCase() === payload.id.toUpperCase());

      if (!existing) {
        responseData = {
          status: "success",
          scanType: "MASUK",
          message: `Absen MASUK berhasil dicatat! (+10 Poin)`,
          data: {
            id: payload.id,
            nama: payload.nama || ("Anggota (" + payload.id + ")"),
            kelas: payload.kelas || "XI IPA 1",
            jabatan: payload.jabatan || "Anggota Medinfo",
            jamMasuk: timeStr,
            jamPulang: "-",
            status: "Hadir (Masuk)",
            poin: 10,
            sesi: payload.sesi
          }
        };
      } else if (existing.jamPulang === "-" || !existing.jamPulang) {
        existing.jamPulang = timeStr;
        existing.status = "Hadir Lengkap";
        existing.poin = 15;
        responseData = {
          status: "success",
          scanType: "PULANG",
          message: `Absen PULANG berhasil dicatat! Kehadiran lengkap (+5 Poin Bonus)`,
          data: {
            id: payload.id,
            nama: existing.nama || payload.nama,
            kelas: existing.kelas || payload.kelas,
            jabatan: existing.jabatan || payload.jabatan || "Anggota Medinfo",
            jamMasuk: existing.jamMasuk || existing.jam || timeStr,
            jamPulang: timeStr,
            status: "Hadir Lengkap",
            poin: 15,
            sesi: payload.sesi
          }
        };
      } else {
        responseData = {
          status: "already_completed",
          message: `Kehadiran ${existing.nama || payload.nama} sudah LENGKAP hari ini!\n• Masuk: ${existing.jamMasuk || existing.jam}\n• Pulang: ${existing.jamPulang}`,
          data: existing
        };
      }
    } else {
      const res = await fetch(APP_CONFIG.GAS_ENDPOINT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(postPayload)
      });
      responseData = await res.json();
    }

    if (responseData.status === "success") {
      const data = responseData.data || {};
      const scanType = responseData.scanType || payload.scanType || "MASUK";

      if (scanType === "PULANG") {
        CryptoUtil.Sound.playCheckoutFanfare();
        CryptoUtil.Sound.triggerHaptic([60, 40, 60, 40, 100]);
      } else {
        CryptoUtil.Sound.playSuccess();
        CryptoUtil.Sound.triggerHaptic(60);
      }

      const record = {
        id: data.id || payload.id,
        nama: data.nama || payload.nama || payload.id,
        kelas: data.kelas || payload.kelas || "-",
        jabatan: data.jabatan || payload.jabatan || "Anggota Medinfo",
        jamMasuk: data.jamMasuk || payload.jamMasuk || timeStr,
        jamPulang: data.jamPulang || (scanType === "PULANG" ? timeStr : "-"),
        status: data.status || (scanType === "PULANG" ? "Hadir Lengkap" : "Hadir (Masuk)"),
        petugas: payload.petugas,
        poin: data.poin || (scanType === "PULANG" ? 15 : 10)
      };

      addLogItem(record);
      displayScanResult({
        status: "success",
        scanType: scanType,
        id: record.id,
        nama: record.nama,
        kelas: record.kelas,
        jabatan: record.jabatan,
        jamMasuk: record.jamMasuk,
        jamPulang: record.jamPulang,
        poin: record.poin,
        message: responseData.message || (scanType === "PULANG" ? "Absen PULANG berhasil dicatat!" : "Absen MASUK berhasil dicatat!")
      });
      showToast(responseData.message || `Berhasil: ${record.nama}`, "success");

    } else if (responseData.status === "already_completed" || responseData.status === "already_recorded") {
      CryptoUtil.Sound.playWarning();
      CryptoUtil.Sound.triggerHaptic([80, 50, 80]);
      
      const member = responseData.data || responseData.member || {};
      displayScanResult({
        status: "warning",
        id: member.id || payload.id,
        nama: member.nama || payload.nama || payload.id,
        kelas: member.kelas || payload.kelas || "-",
        jabatan: member.jabatan || payload.jabatan || "Anggota",
        jamMasuk: member.jamMasuk || payload.jamMasuk || "-",
        jamPulang: member.jamPulang || payload.jamKeluar || "-",
        poin: member.poin || 15,
        message: responseData.message || "Anggota ini sudah absen lengkap hari ini."
      });
      showToast("Sudah absen lengkap hari ini!", "warning");

    } else {
      CryptoUtil.Sound.playError();
      displayScanResult({
        status: "error",
        id: payload.id,
        nama: payload.nama || "Gagal Absen",
        kelas: payload.kelas || "-",
        jabatan: payload.jabatan || "Anggota",
        message: responseData.message || "Terjadi kesalahan pada sistem."
      });
      showToast(responseData.message || "Gagal mencatat absensi", "error");
    }

  } catch (netErr) {
    console.warn("Gagal terhubung ke Google Apps Script, menyimpan ke antrean offline:", netErr);
    saveToOfflineQueue(payload, timeStr);
    
    displayScanResult({
      status: "offline_saved",
      id: payload.id,
      nama: payload.nama || "Tersimpan Offline",
      kelas: payload.kelas || "Koneksi Terputus",
      jabatan: payload.jabatan || "Anggota",
      jamMasuk: timeStr,
      jamPulang: "-",
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
  const resPoints = document.getElementById("resPoints");
  const resJamMasuk = document.getElementById("resJamMasuk");
  const resJamPulang = document.getElementById("resJamPulang");

  resNama.textContent = info.nama;
  resId.textContent = info.id;
  resKelas.textContent = info.kelas;
  resMessage.textContent = info.message;
  resAvatar.textContent = info.nama ? info.nama.charAt(0).toUpperCase() : "P";

  if (resJamMasuk) resJamMasuk.textContent = `Masuk: ${info.jamMasuk || "-"}`;
  if (resJamPulang) resJamPulang.textContent = `Pulang: ${info.jamPulang || "-"}`;

  if (info.status === "success") {
    if (info.scanType === "PULANG") {
      resBadge.className = "badge badge-info";
      resBadge.textContent = "Pulang ✓";
      if (resPoints) resPoints.textContent = `+5 Poin (Total: ${info.poin || 15})`;
    } else {
      resBadge.className = "badge badge-success";
      resBadge.textContent = "Masuk ✓";
      if (resPoints) resPoints.textContent = `+10 Poin`;
    }
  } else if (info.status === "warning") {
    resBadge.className = "badge badge-warning";
    resBadge.textContent = "Lengkap ✓";
    if (resPoints) resPoints.textContent = `15 Poin`;
  } else if (info.status === "invalid" || info.status === "error") {
    resBadge.className = "badge badge-danger";
    resBadge.textContent = "Ditolak ✕";
    if (resPoints) resPoints.textContent = `0 Poin`;
  } else if (info.status === "offline_saved") {
    resBadge.className = "badge badge-info";
    resBadge.textContent = "Offline ☁️";
    if (resPoints) resPoints.textContent = `+10 Poin (Pending)`;
  }
}

/**
 * Handle Form Izin / Sakit Online oleh Siswa
 */
async function handleSubmitPermit() {
  const id = document.getElementById("permitId").value.trim().toUpperCase();
  const kelas = document.getElementById("permitKelas").value.trim();
  const status = document.getElementById("permitStatus").value;
  const alasan = document.getElementById("permitAlasan").value.trim();

  if (!id) return showToast("Masukkan ID atau Nama Siswa.", "warning");
  if (!alasan) return showToast("Masukkan alasan izin/sakit.", "warning");

  const modalPermit = document.getElementById("permitModal");
  showToast("Mengirimkan surat konfirmasi...", "info");

  try {
    const isMock = APP_CONFIG.GAS_ENDPOINT_URL.includes("GANTI_DENGAN_DEPLOYMENT_ID");
    if (isMock) {
      await new Promise(r => setTimeout(r, 500));
      showToast("Surat izin berhasil dicatat di sistem lokal!", "success");
    } else {
      const res = await fetch(APP_CONFIG.GAS_ENDPOINT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "submit_permit",
          id: id,
          nama: id,
          kelas: kelas,
          status: status,
          alasan: alasan,
          sesi: getCurrentAgenda()
        })
      });
      const data = await res.json();
      showToast(data.message || "Izin berhasil tercatat!", "success");
    }

    modalPermit.style.display = "none";
    document.getElementById("permitId").value = "";
    document.getElementById("permitAlasan").value = "";
  } catch (e) {
    showToast("Gagal mengirim izin. Periksa koneksi internet.", "error");
  }
}

/**
 * Setup PWA Features (Service Worker & Install Button)
 */
function setupPwaFeatures() {
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById("btnInstallPwa");
    if (btn) {
      btn.style.display = "inline-flex";
      btn.addEventListener("click", async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === "accepted") {
            btn.style.display = "none";
            showToast("Aplikasi berhasil di-install ke layar utama HP!", "success");
          }
          deferredPrompt = null;
        }
      });
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
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
        <span>${log.id} • ${log.kelas}${log.jabatan ? ` • <strong style="color:var(--primary); font-weight: 600;">${log.jabatan}</strong>` : ""}</span>
        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.15rem;">Petugas: ${log.petugas}</div>
      </div>
      <div style="text-align: right;">
        <span class="badge ${log.status.includes('Lengkap') ? 'badge-info' : 'badge-success'}">${log.status}</span>
        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem;">${log.jamMasuk ? log.jamMasuk + (log.jamPulang && log.jamPulang !== '-' ? ' - ' + log.jamPulang : '') : (log.jam || '-')}</div>
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
