/**
 * Dashboard & Laporan Presensi PIK-R MANSEKU
 * Program by Haikal
 */

let allAttendanceRecords = [];
let filteredRecords = [];
let allMembers = [];

document.addEventListener("DOMContentLoaded", () => {
  setupDefaultDate();
  setupEventListeners();
  loadData();
});

function setupDefaultDate() {
  const dateInput = document.getElementById("filterDate");
  const today = new Date().toISOString().split("T")[0];
  dateInput.value = today;
}

function setupEventListeners() {
  document.getElementById("btnRefreshData").addEventListener("click", loadData);
  document.getElementById("filterDate").addEventListener("change", applyFilters);
  document.getElementById("filterStatus").addEventListener("change", applyFilters);
  document.getElementById("filterSearch").addEventListener("input", applyFilters);

  document.getElementById("btnExportExcel").addEventListener("click", exportToExcel);
  document.getElementById("btnExportCsv").addEventListener("click", exportToCsv);
}

/**
 * Memuat Data dari Google Apps Script API
 */
async function loadData() {
  const tbody = document.getElementById("attendanceTbody");
  tbody.innerHTML = `
    <tr>
      <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
        🔄 Mengambil data dari Google Sheets...
      </td>
    </tr>
  `;

  const isMock = APP_CONFIG.GAS_ENDPOINT_URL.includes("GANTI_DENGAN_DEPLOYMENT_ID");

  try {
    if (isMock) {
      // Data Mock untuk demo sebelum GAS di-deploy
      await new Promise(r => setTimeout(r, 500));
      allMembers = getMockMembers();
      allAttendanceRecords = getMockAttendance();
    } else {
      // Ambil riwayat presensi & data anggota dari GAS
      const [attendRes, memberRes] = await Promise.all([
        fetch(`${APP_CONFIG.GAS_ENDPOINT_URL}?action=get_attendance`).then(r => r.json()),
        fetch(`${APP_CONFIG.GAS_ENDPOINT_URL}?action=get_members`).then(r => r.json())
      ]);

      if (attendRes.status === "success") {
        allAttendanceRecords = attendRes.records || [];
      }
      if (memberRes.status === "success") {
        allMembers = memberRes.members || [];
      }
    }

    applyFilters();
    updateStats();
    showToast("Data presensi berhasil dimuat!", "success");

  } catch (err) {
    console.error("Gagal memuat data:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: var(--danger);">
          Gagal terhubung ke Google Apps Script.<br>
          <small style="color: var(--text-muted);">Pastikan URL di config.js sudah benar dan di-deploy dengan akses 'Anyone'.</small>
        </td>
      </tr>
    `;
    showToast("Gagal memuat data dari Spreadsheet", "error");
  }
}

/**
 * Filter Data Berdasarkan Tanggal, Status, dan Pencarian
 */
function applyFilters() {
  const selectedDate = document.getElementById("filterDate").value;
  const selectedStatus = document.getElementById("filterStatus").value;
  const searchQuery = document.getElementById("filterSearch").value.toLowerCase().trim();

  filteredRecords = allAttendanceRecords.filter(item => {
    // Cocokkan tanggal jika diisi
    if (selectedDate && item.tanggal && item.tanggal !== selectedDate) {
      return false;
    }

    // Cocokkan status
    if (selectedStatus !== "ALL" && item.status !== selectedStatus) {
      return false;
    }

    // Cocokkan pencarian nama, id, atau kelas
    if (searchQuery) {
      const matchName = (item.nama || "").toLowerCase().includes(searchQuery);
      const matchId = (item.idAnggota || "").toLowerCase().includes(searchQuery);
      const matchKelas = (item.kelas || "").toLowerCase().includes(searchQuery);
      if (!matchName && !matchId && !matchKelas) return false;
    }

    return true;
  });

  renderTable();
  updateStats();
}

/**
 * Render Tabel Data Presensi
 */
function renderTable() {
  const tbody = document.getElementById("attendanceTbody");
  const badge = document.getElementById("recordCountBadge");

  badge.textContent = `${filteredRecords.length} Data Ditampilkan`;

  if (filteredRecords.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          Tidak ada data presensi yang sesuai dengan filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredRecords.map(item => `
    <tr>
      <td>
        <span style="font-weight: 600;">${item.jam || "-"}</span><br>
        <small style="color: var(--text-muted); font-size: 0.72rem;">${item.tanggal || "-"}</small>
      </td>
      <td><code style="background: var(--surface-alt); padding: 0.2rem 0.4rem; border-radius: 4px; font-weight: 700;">${item.idAnggota || "-"}</code></td>
      <td><strong>${item.nama || "-"}</strong></td>
      <td>${item.kelas || "-"}</td>
      <td>${getStatusBadge(item.status)}</td>
      <td>${item.sesi || "Pertemuan Rutin"}</td>
      <td><small>${item.petugas || "Kakak Senior"}</small></td>
      <td><small style="color: var(--text-muted);">${item.catatan || "-"}</small></td>
    </tr>
  `).join("");
}

function getStatusBadge(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("hadir")) return `<span class="badge badge-success">Hadir</span>`;
  if (s.includes("izin")) return `<span class="badge badge-info">Izin</span>`;
  if (s.includes("sakit")) return `<span class="badge badge-warning">Sakit</span>`;
  return `<span class="badge badge-danger">${status || "Alpha"}</span>`;
}

/**
 * Hitung & Perbarui Indikator Statistik
 */
function updateStats() {
  const selectedDate = document.getElementById("filterDate").value;

  const recordsForDate = allAttendanceRecords.filter(r => !selectedDate || r.tanggal === selectedDate);
  const totalHadir = recordsForDate.filter(r => (r.status || "").toLowerCase().includes("hadir")).length;
  const totalIzinSakit = recordsForDate.filter(r => {
    const s = (r.status || "").toLowerCase();
    return s.includes("izin") || s.includes("sakit");
  }).length;

  const totalAnggota = Math.max(allMembers.length, recordsForDate.length);
  const belumHadir = Math.max(0, totalAnggota - (totalHadir + totalIzinSakit));

  document.getElementById("statTotalAnggota").textContent = totalAnggota;
  document.getElementById("statHadir").textContent = totalHadir;
  document.getElementById("statIzin").textContent = totalIzinSakit;
  document.getElementById("statBelum").textContent = belumHadir;
}

/**
 * Ekspor Data ke Excel (.xlsx) dengan SheetJS
 */
function exportToExcel() {
  if (filteredRecords.length === 0) {
    showToast("Tidak ada data untuk diekspor.", "warning");
    return;
  }

  const exportData = filteredRecords.map((r, idx) => ({
    "No": idx + 1,
    "Tanggal": r.tanggal,
    "Jam": r.jam,
    "ID Anggota": r.idAnggota,
    "Nama Lengkap": r.nama,
    "Kelas": r.kelas,
    "Status": r.status,
    "Agenda / Kegiatan": r.sesi,
    "Petugas Absen": r.petugas,
    "Catatan": r.catatan
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Presensi_PIKR");

  // Auto-width kolom
  const colWidths = [
    { wch: 5 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, 
    { wch: 26 }, { wch: 12 }, { wch: 10 }, { wch: 24 }, 
    { wch: 16 }, { wch: 20 }
  ];
  worksheet["!cols"] = colWidths;

  const dateStr = document.getElementById("filterDate").value || "Semua_Tanggal";
  const filename = `Presensi_PIK-R_MANSEKU_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, filename);
  showToast("File Excel berhasil di-download!", "success");
}

/**
 * Ekspor Data ke CSV
 */
function exportToCsv() {
  if (filteredRecords.length === 0) {
    showToast("Tidak ada data untuk diekspor.", "warning");
    return;
  }

  const headers = ["No", "Tanggal", "Jam", "ID Anggota", "Nama Lengkap", "Kelas", "Status", "Agenda", "Petugas", "Catatan"];
  const rows = filteredRecords.map((r, i) => [
    i + 1,
    `"${r.tanggal || ""}"`,
    `"${r.jam || ""}"`,
    `"${r.idAnggota || ""}"`,
    `"${(r.nama || "").replace(/"/g, '""')}"`,
    `"${r.kelas || ""}"`,
    `"${r.status || ""}"`,
    `"${(r.sesi || "").replace(/"/g, '""')}"`,
    `"${(r.petugas || "").replace(/"/g, '""')}"`,
    `"${(r.catatan || "").replace(/"/g, '""')}"`
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  const dateStr = document.getElementById("filterDate").value || "Semua";
  link.setAttribute("href", url);
  link.setAttribute("download", `Presensi_PIK-R_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("File CSV berhasil di-download!", "success");
}

// Mock Dataset untuk Demo Awal
function getMockMembers() {
  return [
    { id: "PIKR-2026-001", nama: "Haikal", kelas: "XI IPA 1" },
    { id: "PIKR-2026-002", nama: "Aisyah Nurul", kelas: "XI IPS 2" },
    { id: "PIKR-2026-003", nama: "Rizky Pratama", kelas: "X-A" },
    { id: "PIKR-2026-004", nama: "Nabila Zahra", kelas: "XII IPA 2" },
    { id: "PIKR-2026-005", nama: "Fajar Nugraha", kelas: "XI IPS 1" }
  ];
}

function getMockAttendance() {
  const today = new Date().toISOString().split("T")[0];
  return [
    {
      logId: "LOG-01",
      tanggal: today,
      jam: "15:45:10",
      idAnggota: "PIKR-2026-001",
      nama: "Haikal",
      kelas: "XI IPA 1",
      status: "Hadir",
      sesi: "Pertemuan Rutin PIK-R",
      petugas: "Kak Nur",
      catatan: "-"
    },
    {
      logId: "LOG-02",
      tanggal: today,
      jam: "15:48:22",
      idAnggota: "PIKR-2026-002",
      nama: "Aisyah Nurul",
      kelas: "XI IPS 2",
      status: "Hadir",
      sesi: "Pertemuan Rutin PIK-R",
      petugas: "Kak Nur",
      catatan: "-"
    },
    {
      logId: "LOG-03",
      tanggal: today,
      jam: "16:02:11",
      idAnggota: "PIKR-2026-003",
      nama: "Rizky Pratama",
      kelas: "X-A",
      status: "Izin",
      sesi: "Pertemuan Rutin PIK-R",
      petugas: "Kak Nur",
      catatan: "Ada les tambahan"
    }
  ];
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
