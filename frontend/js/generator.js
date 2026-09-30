/**
 * Logika Generator Kartu KTA & QR Code PIK-R MANSEKU
 * Program by Haikal
 */

let singleQrInstance = null;
let generatedBatchMembers = [];

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupSingleGenerator();
  setupBatchGenerator();
  // Trigger single generation initial
  updateSingleCard();
});

function setupTabs() {
  const tabSingle = document.getElementById("tabSingle");
  const tabBatch = document.getElementById("tabBatch");
  const secSingle = document.getElementById("sectionSingle");
  const secBatch = document.getElementById("sectionBatch");
  const batchContainer = document.getElementById("batchCardsContainer");

  tabSingle.addEventListener("click", () => {
    tabSingle.className = "btn btn-primary btn-sm";
    tabBatch.className = "btn btn-secondary btn-sm";
    secSingle.style.display = "grid";
    secBatch.style.display = "none";
    batchContainer.style.display = "none";
  });

  tabBatch.addEventListener("click", () => {
    tabBatch.className = "btn btn-primary btn-sm";
    tabSingle.className = "btn btn-secondary btn-sm";
    secSingle.style.display = "none";
    secBatch.style.display = "block";
    batchContainer.style.display = "grid";
  });
}

function setupSingleGenerator() {
  const btn = document.getElementById("btnGenerateSingle");
  const inputs = ["genId", "genNama", "genKelas", "genJabatan"];
  const selectJabatan = document.getElementById("selectJabatanPreset");
  const inputJabatan = document.getElementById("genJabatan");

  if (selectJabatan && inputJabatan) {
    selectJabatan.addEventListener("change", (e) => {
      if (e.target.value === "__CUSTOM__") {
        inputJabatan.style.display = "block";
        inputJabatan.focus();
      } else {
        inputJabatan.style.display = "none";
        inputJabatan.value = e.target.value;
        updateSingleCard();
      }
    });
  }

  // Quick pick member buttons from SQLite 2026
  const setMemberForm = (id, nama, kelas, jabatan) => {
    document.getElementById("genId").value = id;
    document.getElementById("genNama").value = nama;
    document.getElementById("genKelas").value = kelas;
    if (selectJabatan) selectJabatan.value = jabatan;
    if (inputJabatan) {
      inputJabatan.value = jabatan;
      inputJabatan.style.display = "none";
    }
    updateSingleCard();
    CryptoUtil.Sound.playPop();
    CryptoUtil.Sound.triggerHaptic(18);
  };

  const btnFebri = document.getElementById("btnPickFebriady");
  const btnHaikal = document.getElementById("btnPickHaikal");
  const btnRendra = document.getElementById("btnPickRendra");

  if (btnFebri) btnFebri.addEventListener("click", () => setMemberForm("PIKR-2026-001", "Febriady", "XII-1", "Ketua Umum"));
  if (btnHaikal) btnHaikal.addEventListener("click", () => setMemberForm("PIKR-2026-002", "Haikal Mabrur", "XII-1", "Anggota MedInfo"));
  if (btnRendra) btnRendra.addEventListener("click", () => setMemberForm("PIKR-2026-003", "Rendra Agus Setiawan", "XII-2", "Ketua MedInfo"));

  btn.addEventListener("click", updateSingleCard);
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateSingleCard);
  });
}

async function updateSingleCard() {
  const id = document.getElementById("genId").value.trim().toUpperCase();
  const nama = document.getElementById("genNama").value.trim();
  const kelas = document.getElementById("genKelas").value.trim();
  const jabatan = document.getElementById("genJabatan").value.trim() || "Anggota Medinfo";

  if (!id) return;

  // 1. Hitung HMAC Signature
  const sig = await CryptoUtil.generateSignature(id);

  // 2. URL Masa Depan Kartu: Arahkan ke Portal Profil Anggota PIK-R
  // Jika discan kamera umum -> membuka profil anggota resmi di website PIK-R
  // Jika discan scanner absensi -> otomatis memverifikasi dan membuka pop-up presensi
  const portalBase = APP_CONFIG.PORTAL_BASE_URL || "https://pikr-manseku.web.app";
  const qrUrl = `${portalBase}/anggota/${id}?sig=${sig}`;

  // 3. Simpan ke Registry Lokal agar Scanner Langsung Mengenali Siswa Ini
  if (typeof MemberRegistry !== "undefined") {
    MemberRegistry.saveMember({ id, nama, kelas, jabatan });
  }

  // 4. Update Preview Teks
  document.getElementById("previewSigToken").textContent = sig;
  document.getElementById("previewTargetUrl").textContent = qrUrl;

  document.getElementById("cardViewNama").textContent = nama || "Nama Anggota";
  document.getElementById("cardViewId").textContent = id;
  document.getElementById("cardViewRole").textContent = `${kelas || "-"} • ${jabatan || "Anggota Medinfo"}`;

  // 5. Render QR Code
  const qrContainer = document.getElementById("qrcodeSingle");
  qrContainer.innerHTML = "";

  if (typeof QRCode !== "undefined") {
    singleQrInstance = new QRCode(qrContainer, {
      text: qrUrl,
      width: 140,
      height: 140,
      colorDark: "#0f172a",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  }
}

function setupBatchGenerator() {
  document.getElementById("btnProcessBatch").addEventListener("click", processBatchMembers);
  document.getElementById("btnDownloadSinglePlainQr").addEventListener("click", () => {
    const id = document.getElementById("genId").value.trim().toUpperCase();
    const nama = document.getElementById("genNama").value.trim();
    const sig = document.getElementById("previewSigToken").textContent.trim();
    const qrUrl = document.getElementById("previewTargetUrl").textContent.trim();
    if (!id || !qrUrl) return showToast("Data anggota belum lengkap.", "warning");
    downloadPlainQr(id, nama, qrUrl);
  });
  document.getElementById("btnDownloadAllPlainQrZip").addEventListener("click", downloadAllPlainQrZip);
  document.getElementById("btnPrintAllCards").addEventListener("click", () => {
    if (generatedBatchMembers.length === 0) {
      showToast("Klik 'Generate Semua Kartu' terlebih dahulu.", "warning");
      return;
    }
    window.print();
  });
  document.getElementById("btnExportBatchCsv").addEventListener("click", copyBatchForGoogleSheets);
}

/**
 * Memproses Daftar Anggota dari Textarea (Batch)
 */
async function processBatchMembers() {
  const text = document.getElementById("batchInputText").value.trim();
  if (!text) {
    showToast("Silakan masukkan teks data anggota.", "warning");
    return;
  }

  const lines = text.split("\n");
  generatedBatchMembers = [];
  const container = document.getElementById("batchCardsContainer");
  container.innerHTML = "";
  container.style.display = "grid";

  showToast(`Sedang memproses ${lines.length} anggota...`, "info");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Pisahkan dengan koma atau tab
    const parts = line.includes("\t") ? line.split("\t") : line.split(",");
    const id = (parts[0] || "").trim().toUpperCase();
    const nama = (parts[1] || "").trim();
    const kelas = (parts[2] || "").trim();
    const jabatan = (parts[3] || "Anggota").trim();

    if (!id || !nama) continue;

    const sig = await CryptoUtil.generateSignature(id);
    const portalBase = APP_CONFIG.PORTAL_BASE_URL || "https://pikr-manseku.web.app";
    const qrUrl = `${portalBase}/anggota/${id}?sig=${sig}`;

    const memberObj = { id, nama, kelas, jabatan, sig, qrUrl };
    generatedBatchMembers.push(memberObj);

    // Buat DOM Kartu
    const cardEl = document.createElement("div");
    cardEl.className = "kta-card";
    const qrDivId = `batch-qr-${i}`;

    cardEl.innerHTML = `
      <div class="kta-header">
        <img src="logo/logo_pik-r.png" alt="Logo" style="width: 48px; height: 48px; object-fit: contain; margin-bottom: 0.2rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
        <h2>PIK-R MANSEKU</h2>
        <p>MAN 1 Muara Enim • Kartu Tanda Anggota</p>
      </div>

      <div class="kta-qr-box">
        <div id="${qrDivId}"></div>
        <div style="font-size: 0.68rem; color: #64748b; margin-top: 0.35rem; font-weight: 600;">
          SCAN IDENTITAS / ABSENSI
        </div>
      </div>

      <div class="kta-footer">
        <div class="kta-name">${nama}</div>
        <div class="kta-id">${id}</div>
        <div class="kta-role">${kelas} • ${jabatan}</div>
      </div>
    `;

    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "0.5rem";

    wrapper.appendChild(cardEl);

    const btnDl = document.createElement("button");
    btnDl.className = "btn btn-primary btn-sm no-print";
    btnDl.style.width = "100%";
    btnDl.innerHTML = `📥 Download QR Polos (.png)`;
    btnDl.onclick = () => downloadPlainQr(id, nama, qrUrl);
    wrapper.appendChild(btnDl);

    container.appendChild(wrapper);

    // Render QR Code untuk kartu ini
    if (typeof QRCode !== "undefined") {
      new QRCode(document.getElementById(qrDivId), {
        text: qrUrl,
        width: 140,
        height: 140,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  showToast(`Selesai! ${generatedBatchMembers.length} kartu & QR siap digunakan.`, "success");
}

/**
 * Generate dan Download QR Polos Beresolusi Tinggi sebagai ${namaAnggota}-QR.png
 */
function downloadPlainQr(id, nama, url) {
  const cleanName = (nama || id || "Anggota").trim().replace(/[/\\?%*:|"<>]/g, "_");
  const filename = `${cleanName}-QR.png`;

  showToast(`Mempersiapkan ${filename}...`, "info");

  const tempDiv = document.createElement("div");
  tempDiv.style.position = "fixed";
  tempDiv.style.left = "-9999px";
  tempDiv.style.top = "-9999px";
  document.body.appendChild(tempDiv);

  new QRCode(tempDiv, {
    text: url,
    width: 450,
    height: 450,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  setTimeout(() => {
    let dataUrl = "";
    const canvas = tempDiv.querySelector("canvas");
    if (canvas) {
      dataUrl = canvas.toDataURL("image/png");
    } else {
      const img = tempDiv.querySelector("img");
      if (img) dataUrl = img.src;
    }

    if (dataUrl) {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`Berhasil diunduh: ${filename}`, "success");
    } else {
      showToast("Gagal memproses gambar QR", "error");
    }
    document.body.removeChild(tempDiv);
  }, 120);
}

/**
 * Download Seluruh QR Code Polos Sekaligus dalam Format ZIP
 */
async function downloadAllPlainQrZip() {
  if (generatedBatchMembers.length === 0) {
    showToast("Klik 'Generate Semua Kartu' terlebih dahulu.", "warning");
    return;
  }
  if (typeof JSZip === "undefined") {
    showToast("Library JSZip belum siap. Pastikan internet terhubung.", "error");
    return;
  }

  showToast(`Mengemas ${generatedBatchMembers.length} QR polos ke dalam ZIP...`, "info");
  const zip = new JSZip();

  for (let i = 0; i < generatedBatchMembers.length; i++) {
    const m = generatedBatchMembers[i];
    const cleanName = (m.nama || m.id).trim().replace(/[/\\?%*:|"<>]/g, "_");
    const filename = `${cleanName}-QR.png`;

    const tempDiv = document.createElement("div");
    tempDiv.style.position = "fixed";
    tempDiv.style.left = "-9999px";
    tempDiv.style.top = "-9999px";
    document.body.appendChild(tempDiv);

    new QRCode(tempDiv, {
      text: m.qrUrl,
      width: 450,
      height: 450,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });

    await new Promise(r => setTimeout(r, 60));

    let base64Data = "";
    const canvas = tempDiv.querySelector("canvas");
    if (canvas) {
      base64Data = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
    } else {
      const img = tempDiv.querySelector("img");
      if (img && img.src.startsWith("data:")) {
        base64Data = img.src.replace(/^data:image\/png;base64,/, "");
      }
    }

    if (base64Data) {
      zip.file(filename, base64Data, { base64: true });
    }
    document.body.removeChild(tempDiv);
  }

  const content = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(content);
  a.download = `QR_Polos_PIKR_MANSEKU_${new Date().toISOString().split("T")[0]}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast("File ZIP semua QR polos berhasil diunduh!", "success");
}

/**
 * Salin data siap tempel untuk dimasukkan ke Google Sheets 'Data_Anggota'
 */
function copyBatchForGoogleSheets() {
  if (generatedBatchMembers.length === 0) {
    showToast("Belum ada data anggota yang diproses.", "warning");
    return;
  }

  const rows = generatedBatchMembers.map(m => 
    `${m.id}\t${m.nama}\t${m.kelas}\t${m.jabatan}\t-\tAktif\t${m.sig}\t${m.qrUrl}\t${new Date().toISOString().split("T")[0]}`
  );

  const tsvText = rows.join("\n");
  navigator.clipboard.writeText(tsvText).then(() => {
    showToast("Data disalin ke clipboard! Buka Google Sheets 'Data_Anggota' dan paste (Ctrl+V).", "success");
  }).catch(() => {
    showToast("Gagal menyalin otomatis, silakan copy dari console.", "warning");
    console.log(tsvText);
  });
}

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
