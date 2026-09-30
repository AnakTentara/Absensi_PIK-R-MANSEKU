/**
 * Dashboard & Laporan Presensi PIK-R MANSEKU
 * Program by Haikal
 */

let allAttendanceRecords = [];
let filteredRecords = [];
let allMembers = [];
let leaderboardData = [];

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
  document.getElementById("btnPrintBeritaAcara").addEventListener("click", printBeritaAcara);

  // Tab View Switching
  const btnTabRecords = document.getElementById("btnTabRecords");
  const btnTabLeaderboard = document.getElementById("btnTabLeaderboard");
  const secRecords = document.getElementById("sectionRecords");
  const secLeaderboard = document.getElementById("sectionLeaderboard");

  btnTabRecords.addEventListener("click", () => {
    btnTabRecords.className = "btn btn-primary btn-sm";
    btnTabLeaderboard.className = "btn btn-secondary btn-sm";
    secRecords.style.display = "block";
    secLeaderboard.style.display = "none";
  });

  btnTabLeaderboard.addEventListener("click", () => {
    btnTabLeaderboard.className = "btn btn-primary btn-sm";
    btnTabRecords.className = "btn btn-secondary btn-sm";
    secRecords.style.display = "none";
    secLeaderboard.style.display = "block";
    renderLeaderboard();
  });
}

/**
 * Memuat Data dari Google Apps Script API
 */
async function loadData() {
  const tbody = document.getElementById("attendanceTbody");
  tbody.innerHTML = `
    <tr>
      <td colspan="11" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
        🔄 Mengambil data dari Google Sheets...
      </td>
    </tr>
  `;

  const isMock = APP_CONFIG.GAS_ENDPOINT_URL.includes("GANTI_DENGAN_DEPLOYMENT_ID");

  try {
    if (isMock) {
      // Data Mock untuk demo sebelum GAS di-deploy
      await new Promise(r => setTimeout(r, 400));
      allMembers = getMockMembers();
      allAttendanceRecords = getMockAttendance();
    } else {
      // Ambil riwayat presensi & data anggota dari GAS
      const [attendRes, memberRes] = await Promise.all([
        fetch(`${APP_CONFIG.GAS_ENDPOINT_URL}?action=get_attendance`).then(r => r.json()).catch(() => null),
        fetch(`${APP_CONFIG.GAS_ENDPOINT_URL}?action=get_members`).then(r => r.json()).catch(() => null)
      ]);

      if (attendRes && attendRes.status === "success") {
        allAttendanceRecords = attendRes.records || [];
      }
      if (memberRes && memberRes.status === "success") {
        allMembers = memberRes.members || [];
      }
    }

    calculateLeaderboard();
    applyFilters();
    updateStats();
    showToast("Data presensi berhasil dimuat!", "success");

  } catch (err) {
    console.error("Gagal memuat data:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align: center; padding: 2rem; color: var(--danger);">
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
    if (selectedStatus !== "ALL") {
      const itemStatus = (item.status || "").toLowerCase();
      if (!itemStatus.includes(selectedStatus.toLowerCase())) {
        return false;
      }
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
        <td colspan="11" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          Tidak ada data presensi yang sesuai dengan filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredRecords.map(item => {
    const jamMasuk = item.jamMasuk || item.jam || "-";
    const jamPulang = item.jamPulang || "-";
    const poin = item.poin || (item.jamPulang ? 15 : (item.status === "Izin" || item.status === "Sakit" ? 2 : 10));

    return `
      <tr>
        <td><small style="color: var(--text-muted); font-size: 0.8rem;">${item.tanggal || "-"}</small></td>
        <td><strong style="color: var(--primary); font-family: monospace;">${jamMasuk}</strong></td>
        <td><strong style="color: ${jamPulang !== '-' ? '#047857' : '#9ca3af'}; font-family: monospace;">${jamPulang}</strong></td>
        <td><code style="background: var(--surface-alt); padding: 0.2rem 0.4rem; border-radius: 4px; font-weight: 700;">${item.idAnggota || "-"}</code></td>
        <td><strong>${item.nama || "-"}</strong></td>
        <td>${item.kelas || "-"}</td>
        <td>${getStatusBadge(item.status, jamPulang)}</td>
        <td>${item.sesi || "Pertemuan Mingguan"}</td>
        <td><span class="badge" style="background: #fef3c7; color: #92400e; font-weight: 800;">+${poin}</span></td>
        <td><small>${item.petugas || "Kakak Senior"}</small></td>
        <td><small style="color: var(--text-muted);">${item.catatan || "-"}</small></td>
      </tr>
    `;
  }).join("");
}

function getStatusBadge(status, jamPulang) {
  const s = String(status || "").toLowerCase();
  if (s.includes("hadir")) {
    if (jamPulang && jamPulang !== "-") {
      return `<span class="badge badge-success">✓ Lengkap</span>`;
    }
    return `<span class="badge badge-info">Masuk</span>`;
  }
  if (s.includes("izin")) return `<span class="badge badge-warning">Izin</span>`;
  if (s.includes("sakit")) return `<span class="badge badge-warning">Sakit</span>`;
  return `<span class="badge badge-danger">${status || "Alpha"}</span>`;
}

/**
 * Hitung Poin Keaktifan & Leaderboard
 */
function calculateLeaderboard() {
  const scoreMap = {};

  // Masukkan semua data anggota terdaftar
  allMembers.forEach(m => {
    scoreMap[m.id] = {
      id: m.id,
      nama: m.nama,
      kelas: m.kelas,
      hadirMasuk: 0,
      hadirLengkap: 0,
      izinSakit: 0,
      totalPoin: 0
    };
  });

  // Iterasi seluruh rekaman presensi
  allAttendanceRecords.forEach(r => {
    const id = r.idAnggota;
    if (!scoreMap[id]) {
      scoreMap[id] = {
        id: id,
        nama: r.nama || id,
        kelas: r.kelas || "-",
        hadirMasuk: 0,
        hadirLengkap: 0,
        izinSakit: 0,
        totalPoin: 0
      };
    }

    const st = String(r.status || "").toLowerCase();
    const hasPulang = r.jamPulang && r.jamPulang !== "-";

    if (st.includes("hadir")) {
      if (hasPulang) {
        scoreMap[id].hadirLengkap++;
        scoreMap[id].totalPoin += (Number(r.poin) || 15);
      } else {
        scoreMap[id].hadirMasuk++;
        scoreMap[id].totalPoin += (Number(r.poin) || 10);
      }
    } else if (st.includes("izin") || st.includes("sakit")) {
      scoreMap[id].izinSakit++;
      scoreMap[id].totalPoin += (Number(r.poin) || 2);
    }
  });

  leaderboardData = Object.values(scoreMap).sort((a, b) => b.totalPoin - a.totalPoin);
}

/**
 * Render Tabel Leaderboard Poin
 */
function renderLeaderboard() {
  const tbody = document.getElementById("leaderboardTbody");
  if (!tbody) return;

  if (leaderboardData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">Belum ada data poin terkumpul.</td></tr>`;
    return;
  }

  tbody.innerHTML = leaderboardData.map((m, idx) => {
    let rankBadge = `<span style="font-weight: 700; color: var(--text-muted);">#${idx + 1}</span>`;
    if (idx === 0) rankBadge = `<span style="font-size: 1.25rem;">🥇</span> <strong style="color: #d97706;">Juara 1</strong>`;
    else if (idx === 1) rankBadge = `<span style="font-size: 1.2rem;">🥈</span> <strong style="color: #64748b;">Juara 2</strong>`;
    else if (idx === 2) rankBadge = `<span style="font-size: 1.15rem;">🥉</span> <strong style="color: #b45309;">Juara 3</strong>`;

    let badgeApresiasi = `<span class="badge" style="background: #f1f5f9; color: #475569;">Partisipan</span>`;
    if (m.totalPoin >= 45) {
      badgeApresiasi = `<span class="badge badge-success">🌟 Duta Teladan</span>`;
    } else if (m.totalPoin >= 30) {
      badgeApresiasi = `<span class="badge badge-info">⭐ Sangat Aktif</span>`;
    } else if (m.totalPoin >= 10) {
      badgeApresiasi = `<span class="badge badge-warning">👍 Aktif</span>`;
    }

    const totalHadir = m.hadirMasuk + m.hadirLengkap;

    return `
      <tr>
        <td>${rankBadge}</td>
        <td><code style="font-weight: 700; font-size: 0.82rem;">${m.id}</code></td>
        <td><strong>${m.nama}</strong></td>
        <td>${m.kelas}</td>
        <td>
          <span style="font-size: 0.85rem;">${totalHadir}x Hadir</span>
          ${m.izinSakit > 0 ? `<small style="color: var(--text-muted);"> (${m.izinSakit} izin)</small>` : ""}
        </td>
        <td>
          <span style="font-size: 1rem; font-weight: 800; color: var(--primary);">
            ${m.totalPoin}
          </span>
          <small style="color: var(--text-muted);"> Poin</small>
        </td>
        <td>${badgeApresiasi}</td>
      </tr>
    `;
  }).join("");
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
 * Cetak Berita Acara Presensi (PDF) dengan KOP Resmi
 */
function printBeritaAcara() {
  const selectedDate = document.getElementById("filterDate").value;
  const dateObj = selectedDate ? new Date(selectedDate) : new Date();
  
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const formattedDate = dateObj.toLocaleDateString('id-ID', options);
  
  document.getElementById("printDateString").textContent = formattedDate;
  document.getElementById("printSignDate").textContent = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  // Cari nama agenda
  const agendaSample = filteredRecords.length > 0 && filteredRecords[0].sesi ? filteredRecords[0].sesi : "Pertemuan Mingguan PIK-R MANSEKU";
  document.getElementById("printAgendaString").textContent = agendaSample;

  // Bangun tabel cetak
  const printTableContainer = document.getElementById("printTableContainer");
  if (filteredRecords.length === 0) {
    printTableContainer.innerHTML = `<p style="text-align: center; color: #666; font-style: italic; padding: 2rem;">Tidak ada rekaman kehadiran untuk tanggal ini.</p>`;
  } else {
    printTableContainer.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-top: 1rem;">
        <thead>
          <tr style="background: #f3f4f6; border: 1px solid #000;">
            <th style="border: 1px solid #000; padding: 6px; width: 35px; text-align: center;">No</th>
            <th style="border: 1px solid #000; padding: 6px; width: 110px; text-align: center;">ID Anggota</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: left;">Nama Siswa/i</th>
            <th style="border: 1px solid #000; padding: 6px; width: 80px; text-align: center;">Kelas</th>
            <th style="border: 1px solid #000; padding: 6px; width: 75px; text-align: center;">Masuk</th>
            <th style="border: 1px solid #000; padding: 6px; width: 75px; text-align: center;">Pulang</th>
            <th style="border: 1px solid #000; padding: 6px; width: 75px; text-align: center;">Status</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: left;">Catatan</th>
          </tr>
        </thead>
        <tbody>
          ${filteredRecords.map((r, i) => `
            <tr style="border: 1px solid #000;">
              <td style="border: 1px solid #000; padding: 5px; text-align: center;">${i + 1}</td>
              <td style="border: 1px solid #000; padding: 5px; font-family: monospace; text-align: center;">${r.idAnggota || "-"}</td>
              <td style="border: 1px solid #000; padding: 5px; font-weight: bold;">${r.nama || "-"}</td>
              <td style="border: 1px solid #000; padding: 5px; text-align: center;">${r.kelas || "-"}</td>
              <td style="border: 1px solid #000; padding: 5px; text-align: center;">${r.jamMasuk || r.jam || "-"}</td>
              <td style="border: 1px solid #000; padding: 5px; text-align: center;">${r.jamPulang || "-"}</td>
              <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: 600;">${r.status || "-"}</td>
              <td style="border: 1px solid #000; padding: 5px; font-size: 0.78rem;">${r.catatan || "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  // Aktifkan mode cetak Berita Acara
  document.body.classList.add("printing-berita-acara");
  window.print();
  setTimeout(() => {
    document.body.classList.remove("printing-berita-acara");
  }, 1000);
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
    "Jam Masuk": r.jamMasuk || r.jam || "-",
    "Jam Pulang": r.jamPulang || "-",
    "ID Anggota": r.idAnggota,
    "Nama Lengkap": r.nama,
    "Kelas": r.kelas,
    "Status": r.status,
    "Agenda / Kegiatan": r.sesi,
    "Poin Keaktifan": r.poin || (r.jamPulang ? 15 : 10),
    "Petugas Absen": r.petugas,
    "Catatan": r.catatan
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Presensi_PIKR");

  // Auto-width kolom
  const colWidths = [
    { wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, 
    { wch: 26 }, { wch: 12 }, { wch: 10 }, { wch: 24 }, { wch: 14 },
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

  const headers = ["No", "Tanggal", "Jam Masuk", "Jam Pulang", "ID Anggota", "Nama Lengkap", "Kelas", "Status", "Agenda", "Poin", "Petugas", "Catatan"];
  const rows = filteredRecords.map((r, i) => [
    i + 1,
    `"${r.tanggal || ""}"`,
    `"${r.jamMasuk || r.jam || ""}"`,
    `"${r.jamPulang || ""}"`,
    `"${r.idAnggota || ""}"`,
    `"${(r.nama || "").replace(/"/g, '""')}"`,
    `"${r.kelas || ""}"`,
    `"${r.status || ""}"`,
    `"${(r.sesi || "").replace(/"/g, '""')}"`,
    `"${r.poin || (r.jamPulang ? 15 : 10)}"`,
    `"${(r.petugas || "").replace(/"/g, '""')}"`,
    `"${(r.catatan || "").replace(/"/g, '""')}"`
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  const dateStr = document.getElementById("filterDate").value || "Semua";
  link.setAttribute("href", url);
  link.setAttribute("download", `Presensi_PIK-R_MANSEKU_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("File CSV berhasil di-download!", "success");
}

// Mock Dataset untuk Demo Awal
function getMockMembers() {
  return [
    { id: "PIKR-2026-001", nama: "Muhammad Haikal", kelas: "XI IPA 1" },
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
      jamMasuk: "15:45:10",
      jamPulang: "17:15:30",
      idAnggota: "PIKR-2026-001",
      nama: "Muhammad Haikal",
      kelas: "XI IPA 1",
      status: "Hadir (Lengkap)",
      sesi: "Pertemuan Mingguan",
      poin: 15,
      petugas: "Kak Nur",
      catatan: "Aktif bertanya & diskusi"
    },
    {
      logId: "LOG-02",
      tanggal: today,
      jamMasuk: "15:48:22",
      jamPulang: "-",
      idAnggota: "PIKR-2026-002",
      nama: "Aisyah Nurul",
      kelas: "XI IPS 2",
      status: "Hadir (Masuk)",
      sesi: "Pertemuan Mingguan",
      poin: 10,
      petugas: "Kak Nur",
      catatan: "-"
    },
    {
      logId: "LOG-03",
      tanggal: today,
      jamMasuk: "-",
      jamPulang: "-",
      idAnggota: "PIKR-2026-003",
      nama: "Rizky Pratama",
      kelas: "X-A",
      status: "Izin",
      sesi: "Pertemuan Mingguan",
      poin: 2,
      petugas: "Kak Nur",
      catatan: "Ada les tambahan pelajaran"
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
