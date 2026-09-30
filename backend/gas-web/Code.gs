/**
 * =========================================================================
 * BACKEND & FRONTEND ALL-IN-ONE GOOGLE APPS SCRIPT (FULL HOSTING)
 * =========================================================================
 * Semua sistem (Database, REST API, Scanner, Dashboard, Generator Kartu)
 * hidup 100% di dalam scripts.google.com tanpa server luar!
 * =========================================================================
 */

const CONFIG = {
  SECRET_KEY: "sistem_absensi_PIK-R_2026_programbyhaikal",
  SIG_LENGTH: 10,
  SHEET_MEMBERS: "Data_Anggota",
  SHEET_ATTENDANCE: "Riwayat_Absensi",
  SHEET_CONFIG: "Pengaturan",
  TIMEZONE: "Asia/Jakarta"
};

/**
 * Setup Database Otomatis
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  let sheetMembers = ss.getSheetByName(CONFIG.SHEET_MEMBERS);
  if (!sheetMembers) {
    sheetMembers = ss.insertSheet(CONFIG.SHEET_MEMBERS);
    sheetMembers.appendRow([
      "ID Anggota", "Nama Lengkap", "Kelas", "Jabatan", "No WhatsApp", 
      "Status", "Signature Token", "URL Kartu QR", "Terdaftar Pada"
    ]);
    formatHeader(sheetMembers);

    const sampleId = "PIKR-2026-001";
    const sampleSig = generateSignature(sampleId);
    sheetMembers.appendRow([
      sampleId, "Haikal (Sample Anggota)", "XI IPA 1", "Ketua / Pengurus",
      "08123456789", "Aktif", sampleSig,
      "https://absensi.pikr-manseku.my.id?id=" + sampleId + "&sig=" + sampleSig,
      new Date()
    ]);
  }

  let sheetAttendance = ss.getSheetByName(CONFIG.SHEET_ATTENDANCE);
  if (!sheetAttendance) {
    sheetAttendance = ss.insertSheet(CONFIG.SHEET_ATTENDANCE);
    sheetAttendance.appendRow([
      "ID Log", "Timestamp", "Tanggal", "Jam", "ID Anggota", 
      "Nama Lengkap", "Kelas", "Status Kehadiran", "Sesi / Kegiatan", 
      "Petugas Absen", "Catatan"
    ]);
    formatHeader(sheetAttendance);
  }

  let sheetConfig = ss.getSheetByName(CONFIG.SHEET_CONFIG);
  if (!sheetConfig) {
    sheetConfig = ss.insertSheet(CONFIG.SHEET_CONFIG);
    sheetConfig.appendRow(["Parameter", "Nilai", "Keterangan"]);
    formatHeader(sheetConfig);
    sheetConfig.appendRow(["NAMA_KEGIATAN", "Pertemuan Rutin PIK-R", "Nama agenda hari ini"]);
    sheetConfig.appendRow(["STATUS_ABSENSI", "BUKA", "Status gerbang absen: BUKA / TUTUP"]);
    sheetConfig.appendRow(["IZINKAN_DOUBLE_SCAN", "TIDAK", "TIDAK = 1 siswa hanya 1x absen per hari"]);
  }

  return "Database Google Sheets PIK-R MANSEKU Siap Digunakan!";
}

function formatHeader(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  headerRange.setBackground("#0d9488");
  headerRange.setFontColor("#ffffff");
  headerRange.setFontWeight("bold");
  sheet.setFrozenRows(1);
}

function generateSignature(idAnggota) {
  const cleanId = String(idAnggota).trim().toUpperCase();
  const rawBytes = Utilities.computeHmacSha256Signature(cleanId, CONFIG.SECRET_KEY);
  let hexString = "";
  for (let i = 0; i < rawBytes.length; i++) {
    let byteVal = rawBytes[i];
    if (byteVal < 0) byteVal += 256;
    let byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = "0" + byteHex;
    hexString += byteHex;
  }
  return hexString.substring(0, CONFIG.SIG_LENGTH).toUpperCase();
}

function verifySignature(idAnggota, signature) {
  if (!idAnggota || !signature) return false;
  return generateSignature(idAnggota).toUpperCase() === String(signature).trim().toUpperCase();
}

/**
 * Web Router Utama (doGet)
 * Menampilkan Web App atau Melayani Permintaan API JSON
 */
function doGet(e) {
  const params = e ? e.parameter : {};

  // Jika dipanggil oleh API (ada parameter action)
  if (params.action) {
    return handleApiGet(params);
  }

  // Jika dibuka lewat browser untuk scan kartu publik
  if (params.id && params.sig) {
    return renderMemberPublicCard(params.id, params.sig);
  }

  // Menampilkan Web Portal Utama PIK-R MANSEKU di script.google.com
  const page = params.page || "scanner";
  const htmlOutput = HtmlService.createTemplateFromFile("App");
  htmlOutput.activePage = page;
  htmlOutput.scriptUrl = ScriptApp.getService().getUrl();
  
  return htmlOutput.evaluate()
    .setTitle("Portal Absensi & KTA - PIK-R MANSEKU")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Handle API GET
 */
function handleApiGet(params) {
  const action = params.action;
  let result = {};

  if (action === "ping") {
    result = { status: "success", message: "API GAS Aktif", timestamp: new Date() };
  } else if (action === "get_members") {
    result = handleGetMembers();
  } else if (action === "get_attendance") {
    result = handleGetAttendance(params.tanggal);
  } else if (action === "verify_member") {
    result = handleVerifyMember(params.id, params.sig);
  } else {
    result = { status: "error", message: "Action tidak dikenal." };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle POST (Submit Absensi dari Scanner)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(15000);

  try {
    let postData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (err) {
        postData = e.parameter || {};
      }
    } else if (e && e.parameter) {
      postData = e.parameter;
    }

    const action = postData.action || "record_attendance";
    let result = {};

    if (action === "record_attendance") {
      result = handleRecordAttendance(postData);
    } else {
      result = { status: "error", message: "Action POST tidak valid." };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Halaman Verifikasi Kartu Publik (Jika QR discan kamera biasa oleh guru / umum)
 */
function renderMemberPublicCard(id, sig) {
  const isValid = verifySignature(id, sig);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_MEMBERS);
  const data = sheet ? sheet.getDataRange().getValues() : [];

  let member = null;
  const targetId = String(id).trim().toUpperCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toUpperCase() === targetId) {
      member = {
        id: data[i][0],
        nama: data[i][1],
        kelas: data[i][2],
        jabatan: data[i][3],
        status: data[i][5]
      };
      break;
    }
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verifikasi Kartu Anggota PIK-R</title>
      <style>
        body { font-family: -apple-system, sans-serif; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }
        .card { background: #1e293b; border-radius: 20px; padding: 2rem; max-width: 380px; width: 100%; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.4); border: 1px solid #334155; }
        .badge { display: inline-block; padding: 0.35rem 0.9rem; border-radius: 999px; font-weight: bold; font-size: 0.8rem; margin-bottom: 1rem; }
        .badge-valid { background: #059669; color: white; }
        .badge-invalid { background: #dc2626; color: white; }
        .avatar { width: 70px; height: 70px; border-radius: 50%; background: #0d9488; color: white; font-size: 1.8rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-weight: bold; }
        h2 { margin: 0 0 0.3rem; font-size: 1.3rem; }
        p { margin: 0.2rem 0; color: #94a3b8; font-size: 0.9rem; }
      </style>
    </head>
    <body>
      <div class="card">
        ${isValid ? '<span class="badge badge-valid">✓ Kartu Terverifikasi Asli</span>' : '<span class="badge badge-invalid">✕ Tanda Tangan Kartu Palsu</span>'}
        <div class="avatar">${member ? member.nama.charAt(0).toUpperCase() : 'P'}</div>
        <h2>${member ? member.nama : 'Anggota (' + id + ')'}</h2>
        <p><strong>${id}</strong></p>
        <p>${member ? member.kelas + ' • ' + member.jabatan : 'Terverifikasi secara Kriptografis'}</p>
        <p style="margin-top: 1rem; font-size: 0.75rem; color: #64748b;">Pusat Informasi dan Konseling Remaja (PIK-R)<br>MAN 1 Muara Enim</p>
      </div>
    </body>
    </html>
  `;
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Handler data backend
function handleGetMembers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_MEMBERS);
  if (!sheet) return { status: "error", message: "Sheet tidak ada" };
  const data = sheet.getDataRange().getValues();
  const members = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      members.push({ id: data[i][0], nama: data[i][1], kelas: data[i][2], jabatan: data[i][3], status: data[i][5] });
    }
  }
  return { status: "success", members: members };
}

function handleGetAttendance(tanggal) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_ATTENDANCE);
  if (!sheet) return { status: "error", message: "Sheet tidak ada" };
  const data = sheet.getDataRange().getValues();
  const records = [];
  for (let i = data.length - 1; i >= 1; i--) {
    let rowDate = data[i][2];
    if (rowDate instanceof Date) rowDate = Utilities.formatDate(rowDate, CONFIG.TIMEZONE, "yyyy-MM-dd");
    if (tanggal && rowDate !== tanggal) continue;
    records.push({
      logId: data[i][0], timestamp: data[i][1], tanggal: rowDate, jam: data[i][3],
      idAnggota: data[i][4], nama: data[i][5], kelas: data[i][6], status: data[i][7],
      sesi: data[i][8], petugas: data[i][9], catatan: data[i][10]
    });
  }
  return { status: "success", records: records };
}

function handleVerifyMember(id, sig) {
  if (!verifySignature(id, sig)) return { status: "invalid", valid: false };
  return { status: "success", valid: true };
}

function handleRecordAttendance(payload) {
  const id = payload.id;
  const sig = payload.sig;
  if (!verifySignature(id, sig)) {
    return { status: "error", message: "Tanda tangan digital kartu tidak valid!" };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetMembers = ss.getSheetByName(CONFIG.SHEET_MEMBERS);
  const sheetAttendance = ss.getSheetByName(CONFIG.SHEET_ATTENDANCE);

  let nama = "Anggota (" + id + ")";
  let kelas = "-";
  const membersData = sheetMembers.getDataRange().getValues();
  for (let i = 1; i < membersData.length; i++) {
    if (String(membersData[i][0]).toUpperCase() === String(id).toUpperCase()) {
      nama = membersData[i][1];
      kelas = membersData[i][2];
      break;
    }
  }

  const now = new Date();
  const dateStr = Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyy-MM-dd");
  const timeStr = Utilities.formatDate(now, CONFIG.TIMEZONE, "HH:mm:ss");

  // Cek duplikat absen hari ini
  const attendData = sheetAttendance.getDataRange().getValues();
  for (let a = attendData.length - 1; a >= 1; a--) {
    let rowDate = attendData[a][2];
    if (rowDate instanceof Date) rowDate = Utilities.formatDate(rowDate, CONFIG.TIMEZONE, "yyyy-MM-dd");
    if (rowDate === dateStr && String(attendData[a][4]).toUpperCase() === String(id).toUpperCase()) {
      return { status: "already_recorded", message: "Anggota sudah absen hari ini jam " + attendData[a][3], member: { id, nama, kelas } };
    }
  }

  const logId = "LOG-" + Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyyMMdd-HHmmss");
  sheetAttendance.appendRow([
    logId, now, dateStr, timeStr, id, nama, kelas,
    payload.statusKehadiran || "Hadir", payload.sesi || "Pertemuan Rutin", payload.petugas || "Kakak Senior", payload.catatan || "-"
  ]);

  return {
    status: "success",
    data: { id, nama, kelas, tanggal: dateStr, jam: timeStr, status: payload.statusKehadiran || "Hadir" }
  };
}
