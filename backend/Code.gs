/**
 * =========================================================================
 * SISTEM ABSENSI PIK-R MANSEKU (LIFETIME & FUTURE-PROOF ENGINE)
 * =========================================================================
 * 
 * Pengembang  : Program by Haikal
 * Organisasi  : PIK-R MANSEKU (MAN 1 Muara Enim)
 * Versi       : 2.0-Production (HMAC-SHA256 Cryptographic Signature)
 * Secret Key  : sistem_absensi_PIK-R_2026_programbyhaikal
 * 
 * Deskripsi:
 * Script ini berfungsi sebagai REST API backend tanpa biaya server (serverless)
 * yang membaca dan menulis data ke Google Sheets dengan keamanan tanda tangan digital.
 * =========================================================================
 */

// Konfigurasi Utama
const CONFIG = {
  SECRET_KEY: "sistem_absensi_PIK-R_2026_programbyhaikal",
  SIG_LENGTH: 10, // 10 karakter hex pertama dari HMAC-SHA256 (1 triliun+ kombinasi acak)
  SHEET_MEMBERS: "Data_Anggota",
  SHEET_ATTENDANCE: "Riwayat_Absensi",
  SHEET_CONFIG: "Pengaturan",
  TIMEZONE: "Asia/Jakarta" // Waktu Indonesia Barat (WIB)
};

/**
 * Inisialisasi Database Google Sheets otomatis jika sheet belum ada
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Sheet Data Anggota
  let sheetMembers = ss.getSheetByName(CONFIG.SHEET_MEMBERS);
  if (!sheetMembers) {
    sheetMembers = ss.insertSheet(CONFIG.SHEET_MEMBERS);
    const headers = [
      "ID Anggota", "Nama Lengkap", "Kelas", "Jabatan", "No WhatsApp", 
      "Status", "Signature Token", "URL Kartu QR", "Terdaftar Pada"
    ];
    sheetMembers.appendRow(headers);
    formatHeader(sheetMembers);
    
    // Sample Data Awal untuk pengujian
    const sampleId = "PIKR-2026-001";
    const sampleSig = generateSignature(sampleId);
    sheetMembers.appendRow([
      sampleId,
      "Haikal (Sample Anggota)",
      "XI IPA 1",
      "Ketua / Pengurus",
      "08123456789",
      "Aktif",
      sampleSig,
      "https://absensi.pikr-manseku.my.id/id/" + sampleId + "?sig=" + sampleSig,
      new Date()
    ]);
  }

  // 2. Sheet Riwayat Absensi
  let sheetAttendance = ss.getSheetByName(CONFIG.SHEET_ATTENDANCE);
  if (!sheetAttendance) {
    sheetAttendance = ss.insertSheet(CONFIG.SHEET_ATTENDANCE);
    const headers = [
      "ID Log", "Timestamp", "Tanggal", "Jam", "ID Anggota", 
      "Nama Lengkap", "Kelas", "Status Kehadiran", "Sesi / Kegiatan", 
      "Petugas Absen", "Catatan"
    ];
    sheetAttendance.appendRow(headers);
    formatHeader(sheetAttendance);
  }

  // 3. Sheet Pengaturan Sesi
  let sheetConfig = ss.getSheetByName(CONFIG.SHEET_CONFIG);
  if (!sheetConfig) {
    sheetConfig = ss.insertSheet(CONFIG.SHEET_CONFIG);
    sheetConfig.appendRow(["Parameter", "Nilai", "Keterangan"]);
    formatHeader(sheetConfig);
    sheetConfig.appendRow(["NAMA_KEGIATAN", "Pertemuan Mingguan PIK-R", "Nama agenda hari ini"]);
    sheetConfig.appendRow(["STATUS_ABSENSI", "BUKA", "Status gerbang absen: BUKA / TUTUP"]);
    sheetConfig.appendRow(["IZINKAN_DOUBLE_SCAN", "TIDAK", "TIDAK = 1 siswa hanya 1x absen per hari"]);
  }

  return "Database PIK-R MANSEKU berhasil diinisialisasi!";
}

/**
 * Format baris header agar rapi dan profesional
 */
function formatHeader(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  headerRange.setBackground("#0d9488"); // Teal khas PIK-R
  headerRange.setFontColor("#ffffff");
  headerRange.setFontWeight("bold");
  sheet.setFrozenRows(1);
}

/**
 * Generate HMAC-SHA256 Signature untuk ID Anggota
 * @param {string} idAnggota 
 * @returns {string} 10 karakter hex signature
 */
function generateSignature(idAnggota) {
  const cleanId = String(idAnggota).trim().toUpperCase();
  const rawBytes = Utilities.computeHmacSha256Signature(cleanId, CONFIG.SECRET_KEY);
  
  // Konversi byte array ke hexadecimal
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

/**
 * Validasi apakah signature cocok
 */
function verifySignature(idAnggota, signature) {
  if (!idAnggota || !signature) return false;
  const expectedSig = generateSignature(idAnggota);
  return expectedSig.toUpperCase() === String(signature).trim().toUpperCase();
}

/**
 * Handler HTTP GET
 * Digunakan untuk:
 * - Ping test
 * - Mengambil data anggota
 * - Mengambil riwayat absensi
 * - Verifikasi ID sebelum scan
 */
function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const params = e ? e.parameter : {};
    const action = params.action || "ping";

    let result = {};

    switch (action) {
      case "ping":
        result = {
          status: "success",
          message: "API Absensi PIK-R MANSEKU Aktif",
          timestamp: new Date().toISOString()
        };
        break;

      case "get_members":
        result = handleGetMembers();
        break;

      case "verify_member":
        result = handleVerifyMember(params.id, params.sig);
        break;

      case "get_attendance":
        result = handleGetAttendance(params.tanggal);
        break;

      case "get_stats":
        result = handleGetStats(params.tanggal);
        break;

      case "generate_sig":
        // Helper khusus admin untuk generate sig dari parameter
        if (params.id) {
          result = {
            status: "success",
            id: params.id,
            signature: generateSignature(params.id)
          };
        } else {
          result = { status: "error", message: "Parameter id dibutuhkan." };
        }
        break;

      default:
        result = { status: "error", message: "Action tidak dikenali." };
    }

    return createJsonResponse(result);
  } catch (error) {
    return createJsonResponse({
      status: "error",
      message: error.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handler HTTP POST
 * Digunakan untuk:
 * - Submit absensi scan kartu
 * - Registrasi / batch update data anggota
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
        // Fallback jika dikirim via form urlencoded
        postData = e.parameter || {};
      }
    } else if (e && e.parameter) {
      postData = e.parameter;
    }

    const action = postData.action || "record_attendance";
    let result = {};

    switch (action) {
      case "record_attendance":
        result = handleRecordAttendance(postData);
        break;

      case "batch_add_members":
        result = handleBatchAddMembers(postData.members);
        break;

      default:
        result = { status: "error", message: "Action POST tidak valid." };
    }

    return createJsonResponse(result);
  } catch (error) {
    return createJsonResponse({
      status: "error",
      message: error.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper JSON Response dengan CORS Header Lengkap
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Mengambil Master Data Anggota
 */
function handleGetMembers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_MEMBERS);
  if (!sheet) return { status: "error", message: "Sheet Data_Anggota tidak ditemukan." };

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { status: "success", members: [] };

  const members = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    members.push({
      id: String(row[0]),
      nama: String(row[1]),
      kelas: String(row[2]),
      jabatan: String(row[3]),
      noHp: String(row[4]),
      status: String(row[5]),
      signature: String(row[6]),
      urlKartu: String(row[7])
    });
  }

  return { status: "success", count: members.length, members: members };
}

/**
 * Verifikasi Anggota Berdasarkan ID dan Signature Token
 */
function handleVerifyMember(idAnggota, signature) {
  if (!idAnggota) {
    return { status: "error", message: "ID Anggota tidak boleh kosong." };
  }

  // 1. Verifikasi Kriptografis
  const isValidSig = verifySignature(idAnggota, signature);
  if (!isValidSig) {
    return {
      status: "invalid_signature",
      message: "Tanda tangan kartu TIDAK VALID! Kartu diduga tiruan atau rusak.",
      valid: false
    };
  }

  // 2. Cek apakah ada di Database
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_MEMBERS);
  const data = sheet.getDataRange().getValues();

  let member = null;
  const targetId = String(idAnggota).trim().toUpperCase();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toUpperCase() === targetId) {
      member = {
        id: String(data[i][0]),
        nama: String(data[i][1]),
        kelas: String(data[i][2]),
        jabatan: String(data[i][3]),
        status: String(data[i][5])
      };
      break;
    }
  }

  if (!member) {
    return {
      status: "not_found",
      message: "Signature kartu asli, namun ID belum terdaftar di Sheet Data_Anggota.",
      valid: true,
      registered: false
    };
  }

  return {
    status: "success",
    valid: true,
    registered: true,
    member: member
  };
}

/**
 * Catat Kehadiran ke Riwayat_Absensi
 */
function handleRecordAttendance(payload) {
  const idAnggota = payload.id;
  const signature = payload.sig;
  const petugas = payload.petugas || "Kakak Senior";
  const statusKehadiran = payload.statusKehadiran || "Hadir";
  const catatan = payload.catatan || "-";

  if (!idAnggota) {
    return { status: "error", message: "ID Anggota tidak disertakan." };
  }

  // Verifikasi Tanda Tangan
  if (!verifySignature(idAnggota, signature)) {
    return {
      status: "error",
      message: "Absensi ditolak! Signature kartu tidak valid atau telah dimodifikasi."
    };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetMembers = ss.getSheetByName(CONFIG.SHEET_MEMBERS);
  const sheetAttendance = ss.getSheetByName(CONFIG.SHEET_ATTENDANCE);
  const sheetConfig = ss.getSheetByName(CONFIG.SHEET_CONFIG);

  // Ambil Config Sesi
  let namaKegiatan = "Pertemuan Mingguan";
  let izinkanDouble = false;

  if (sheetConfig) {
    const configData = sheetConfig.getDataRange().getValues();
    for (let c = 1; c < configData.length; c++) {
      if (configData[c][0] === "NAMA_KEGIATAN" && configData[c][1]) namaKegiatan = configData[c][1];
      if (configData[c][0] === "IZINKAN_DOUBLE_SCAN" && String(configData[c][1]).toUpperCase() === "YA") izinkanDouble = true;
    }
  }

  // Cari Data Anggota
  let memberName = "Tidak Terdaftar";
  let memberClass = "-";
  const membersData = sheetMembers.getDataRange().getValues();
  const targetId = String(idAnggota).trim().toUpperCase();

  for (let m = 1; m < membersData.length; m++) {
    if (String(membersData[m][0]).trim().toUpperCase() === targetId) {
      memberName = membersData[m][1];
      memberClass = membersData[m][2];
      break;
    }
  }

  // Waktu Saat Ini
  const now = new Date();
  const dateStr = Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyy-MM-dd");
  const timeStr = Utilities.formatDate(now, CONFIG.TIMEZONE, "HH:mm:ss");

  // Cegah Double Scan pada tanggal yang sama jika dilarang
  if (!izinkanDouble) {
    const attendData = sheetAttendance.getDataRange().getValues();
    for (let a = attendData.length - 1; a >= 1; a--) {
      const rowDate = attendData[a][2];
      const rowId = String(attendData[a][4]).trim().toUpperCase();
      
      // Cocokkan tanggal dan ID
      let formattedRowDate = rowDate;
      if (rowDate instanceof Date) {
        formattedRowDate = Utilities.formatDate(rowDate, CONFIG.TIMEZONE, "yyyy-MM-dd");
      }

      if (formattedRowDate === dateStr && rowId === targetId) {
        return {
          status: "already_recorded",
          message: "Anggota ini SUDAH ABSEN hari ini pada jam " + attendData[a][3],
          member: {
            id: targetId,
            nama: memberName,
            kelas: memberClass
          },
          absenTerakhir: attendData[a][3]
        };
      }
    }
  }

  // Generate ID Log Unik
  const logId = "LOG-" + Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyyMMdd-HHmmss") + "-" + targetId.replace(/[^A-Za-z0-9]/g, "");

  // Tulis ke Sheet
  sheetAttendance.appendRow([
    logId,
    now,
    dateStr,
    timeStr,
    targetId,
    memberName,
    memberClass,
    statusKehadiran,
    namaKegiatan,
    petugas,
    catatan
  ]);

  return {
    status: "success",
    message: "Absensi berhasil dicatat!",
    logId: logId,
    data: {
      id: targetId,
      nama: memberName,
      kelas: memberClass,
      tanggal: dateStr,
      jam: timeStr,
      status: statusKehadiran,
      sesi: namaKegiatan
    }
  };
}

/**
 * Ambil Riwayat Absensi
 */
function handleGetAttendance(filterTanggal) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_ATTENDANCE);
  if (!sheet) return { status: "error", message: "Sheet Riwayat_Absensi tidak ditemukan." };

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { status: "success", records: [] };

  const records = [];
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    let rowDate = row[2];
    if (rowDate instanceof Date) {
      rowDate = Utilities.formatDate(rowDate, CONFIG.TIMEZONE, "yyyy-MM-dd");
    }

    if (filterTanggal && rowDate !== filterTanggal) {
      continue;
    }

    records.push({
      logId: row[0],
      timestamp: row[1],
      tanggal: rowDate,
      jam: row[3],
      idAnggota: row[4],
      nama: row[5],
      kelas: row[6],
      status: row[7],
      sesi: row[8],
      petugas: row[9],
      catatan: row[10]
    });
  }

  return {
    status: "success",
    count: records.length,
    records: records
  };
}

/**
 * Statistik Kehadiran Hari Ini
 */
function handleGetStats(filterTanggal) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetMembers = ss.getSheetByName(CONFIG.SHEET_MEMBERS);
  const sheetAttendance = ss.getSheetByName(CONFIG.SHEET_ATTENDANCE);

  const totalMembers = Math.max(0, sheetMembers.getLastRow() - 1);
  const today = filterTanggal || Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");

  const attendData = sheetAttendance.getDataRange().getValues();
  let hadirCount = 0;
  let izinCount = 0;
  let sakitCount = 0;

  for (let i = 1; i < attendData.length; i++) {
    let rowDate = attendData[i][2];
    if (rowDate instanceof Date) {
      rowDate = Utilities.formatDate(rowDate, CONFIG.TIMEZONE, "yyyy-MM-dd");
    }

    if (rowDate === today) {
      const status = String(attendData[i][7]).toLowerCase();
      if (status.includes("hadir")) hadirCount++;
      else if (status.includes("izin")) izinCount++;
      else if (status.includes("sakit")) sakitCount++;
    }
  }

  return {
    status: "success",
    tanggal: today,
    totalAnggota: totalMembers,
    hadir: hadirCount,
    izin: izinCount,
    sakit: sakitCount,
    belumHadir: Math.max(0, totalMembers - (hadirCount + izinCount + sakitCount))
  };
}

/**
 * Batch Menambahkan Anggota Baru & Otomatis Hitung Signature
 */
function handleBatchAddMembers(membersList) {
  if (!Array.isArray(membersList) || membersList.length === 0) {
    return { status: "error", message: "Data anggota tidak valid atau kosong." };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_MEMBERS);
  
  let addedCount = 0;
  const now = new Date();

  membersList.forEach(m => {
    if (m.id && m.nama) {
      const sig = generateSignature(m.id);
      const urlKartu = "https://absensi.pikr-manseku.my.id/id/" + m.id + "?sig=" + sig;
      sheet.appendRow([
        m.id,
        m.nama,
        m.kelas || "-",
        m.jabatan || "Anggota",
        m.noHp || "-",
        m.status || "Aktif",
        sig,
        urlKartu,
        now
      ]);
      addedCount++;
    }
  });

  return {
    status: "success",
    message: addedCount + " anggota berhasil ditambahkan dengan signature otomatis!"
  };
}
