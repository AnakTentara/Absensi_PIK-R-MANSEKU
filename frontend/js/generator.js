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

  btn.addEventListener("click", updateSingleCard);
  inputs.forEach(id => {
    document.getElementById(id).addEventListener("input", updateSingleCard);
  });
}

async function updateSingleCard() {
  const id = document.getElementById("genId").value.trim().toUpperCase();
  const nama = document.getElementById("genNama").value.trim();
  const kelas = document.getElementById("genKelas").value.trim();
  const jabatan = document.getElementById("genJabatan").value.trim();

  if (!id) return;

  // 1. Hitung HMAC Signature
  const sig = await CryptoUtil.generateSignature(id);

  // 2. URL Masa Depan Kartu
  const qrUrl = `${APP_CONFIG.SCAN_BASE_URL}/id/${id}?sig=${sig}`;

  // 3. Update Preview Teks
  document.getElementById("previewSigToken").textContent = sig;
  document.getElementById("previewTargetUrl").textContent = qrUrl;

  document.getElementById("cardViewNama").textContent = nama || "Nama Anggota";
  document.getElementById("cardViewId").textContent = id;
  document.getElementById("cardViewRole").textContent = `${kelas || "-"} • ${jabatan || "Anggota"}`;

  // 4. Render QR Code
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
    const qrUrl = `${APP_CONFIG.SCAN_BASE_URL}/id/${id}?sig=${sig}`;

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

    container.appendChild(cardEl);

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

  showToast(`Selesai! ${generatedBatchMembers.length} kartu siap dicetak.`, "success");
}

/**
 * Salin data siap tempel untuk dimasukkan ke Google Sheets 'Data_Anggota'
 */
function copyBatchForGoogleSheets() {
  if (generatedBatchMembers.length === 0) {
    showToast("Belum ada data anggota yang diproses.", "warning");
    return;
  }

  // Format kolom sesuai sheet Data_Anggota:
  // ID, Nama, Kelas, Jabatan, NoHP, Status, Signature, URL Kartu, Tanggal
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
