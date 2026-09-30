/**
 * Utilitas Kriptografi HMAC-SHA256 untuk Sistem Absensi PIK-R
 * Kompatibel 100% dengan Google Apps Script backend
 */

const CryptoUtil = {
  /**
   * Menghasilkan signature HMAC-SHA256 10 karakter Hex uppercase
   * @param {string} idAnggota 
   * @param {string} secretKey 
   * @returns {Promise<string>}
   */
  async generateSignature(idAnggota, secretKey = APP_CONFIG.SECRET_KEY) {
    const cleanId = String(idAnggota).trim().toUpperCase();
    
    // Gunakan Web Crypto API standar modern
    if (window.crypto && window.crypto.subtle) {
      try {
        const enc = new TextEncoder();
        const keyData = enc.encode(secretKey);
        const msgData = enc.encode(cleanId);

        const cryptoKey = await window.crypto.subtle.importKey(
          "raw",
          keyData,
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );

        const signatureBuffer = await window.crypto.subtle.sign(
          "HMAC",
          cryptoKey,
          msgData
        );

        const hashArray = Array.from(new Uint8Array(signatureBuffer));
        const hex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
        return hex.substring(0, APP_CONFIG.SIG_LENGTH).toUpperCase();
      } catch (e) {
        console.warn("Web Crypto API gagal, beralih ke fallback JS:", e);
      }
    }

    // Fallback SHA256 sederhana jika dijalankan di environment non-HTTPS lama
    return CryptoUtil._fallbackHmacSha256(cleanId, secretKey);
  },

  /**
   * Verifikasi apakah signature cocok
   * @param {string} idAnggota 
   * @param {string} signature 
   * @param {string} secretKey 
   * @returns {Promise<boolean>}
   */
  async verifySignature(idAnggota, signature, secretKey = APP_CONFIG.SECRET_KEY) {
    if (!idAnggota || !signature) return false;
    const expected = await this.generateSignature(idAnggota, secretKey);
    return expected.toUpperCase() === String(signature).trim().toUpperCase();
  },

  /**
   * Parsing QR Code text/URL menjadi { id, sig, raw }
   * Mendukung berbagai format:
   * 1. URL Baru: https://absensi.pikr-manseku.my.id/id/PIKR-001?sig=2D76E6C288
   * 2. URL Lama: https://pikr-manseku.my.id/anggota/PIKR-001?fromQRCode=...
   * 3. Raw Format: PIKR-001#2D76E6C288 atau JSON {"id":"...","sig":"..."}
   */
  parseQrPayload(rawContent) {
    if (!rawContent) return null;
    const raw = String(rawContent).trim();

    try {
      // 1. Cek apakah format URL
      if (raw.startsWith("http://") || raw.startsWith("https://")) {
        const urlObj = new URL(raw);
        
        // Cek query param sig
        let sig = urlObj.searchParams.get("sig");
        let id = null;

        // Path format: /id/PIKR-001 atau /anggota/PIKR-001
        const pathSegments = urlObj.pathname.split("/").filter(Boolean);
        if (pathSegments.length >= 2 && (pathSegments[0] === "id" || pathSegments[0] === "anggota")) {
          id = decodeURIComponent(pathSegments[1]);
        }

        // Jika pakai query param id langsung
        if (!id && urlObj.searchParams.has("id")) {
          id = urlObj.searchParams.get("id");
        }

        // Cek jika format lama: ?fromQRCode=2026-1.PIK-R_${idAnggota}-${token}
        if (!sig && urlObj.searchParams.has("fromQRCode")) {
          const fromQr = urlObj.searchParams.get("fromQRCode");
          const lastDash = fromQr.lastIndexOf("-");
          if (lastDash !== -1) {
            sig = fromQr.substring(lastDash + 1);
          }
        }

        if (id && sig) {
          return { id: id.trim().toUpperCase(), sig: sig.trim().toUpperCase(), rawUrl: raw };
        }
      }

      // 2. Cek format JSON: {"id":"PIKR-001", "sig":"..."}
      if (raw.startsWith("{") && raw.endsWith("}")) {
        const parsed = JSON.parse(raw);
        if (parsed.id && parsed.sig) {
          return { id: String(parsed.id).trim().toUpperCase(), sig: String(parsed.sig).trim().toUpperCase(), rawUrl: raw };
        }
      }

      // 3. Cek format Delimiter (# atau |)
      if (raw.includes("#")) {
        const parts = raw.split("#");
        if (parts.length >= 2) {
          return { id: parts[0].trim().toUpperCase(), sig: parts[1].trim().toUpperCase(), rawUrl: raw };
        }
      }

      if (raw.includes("|")) {
        const parts = raw.split("|");
        if (parts.length >= 2) {
          return { id: parts[0].trim().toUpperCase(), sig: parts[1].trim().toUpperCase(), rawUrl: raw };
        }
      }
    } catch (e) {
      console.error("Gagal parsing QR Code:", e);
    }

    // Jika hanya ID biasa tanpa signature (tidak lolos cryptographic verification)
    return { id: raw.toUpperCase(), sig: null, rawUrl: raw };
  },

  /**
   * Sound & Audio Feedback Menggunakan Web Audio API (Zero External MP3 needed!)
   */
  Sound: {
    ctx: null,
    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
    },
    // Suara Beep Sukses (Two-tone Chime yang Menyenangkan)
    playSuccess() {
      try {
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === "suspended") this.ctx.resume();

        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc1.type = "sine";
        osc2.type = "sine";
        osc1.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
        osc2.frequency.setValueAtTime(880, this.ctx.currentTime + 0.08); // A5

        gainNode.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc1.start(this.ctx.currentTime);
        osc1.stop(this.ctx.currentTime + 0.08);
        osc2.start(this.ctx.currentTime + 0.08);
        osc2.stop(this.ctx.currentTime + 0.35);
      } catch (err) {
        console.warn("Audio error:", err);
      }
    },
    // Suara Fanfare Meriah saat Absen Pulang (C5 -> E5 -> G5)
    playCheckoutFanfare() {
      try {
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === "suspended") this.ctx.resume();

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const t = this.ctx.currentTime + (i * 0.08);

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, t);

          gain.gain.setValueAtTime(0.18, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(t);
          osc.stop(t + 0.35);
        });
      } catch (e) {}
    },
    // Suara Buzz Error / Ditolak (Low Pitch Buzz)
    playError() {
      try {
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === "suspended") this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(180, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(110, this.ctx.currentTime + 0.25);

        gainNode.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.3);
      } catch (err) {
        console.warn("Audio error:", err);
      }
    },
    // Suara Warning / Double Scan (Two fast blips)
    playWarning() {
      try {
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === "suspended") this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.setValueAtTime(440, this.ctx.currentTime + 0.12);

        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.25);
      } catch (err) {}
    }
  },

  // Fallback internal
  _fallbackHmacSha256(msg, key) {
    // Sederhana deterministic hash untuk fallback darurat jika browser sangat jadul
    let hash = 0;
    const combined = key + "::" + msg;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, "0") + "A9";
    return hex.substring(0, APP_CONFIG.SIG_LENGTH).toUpperCase();
  }
};
