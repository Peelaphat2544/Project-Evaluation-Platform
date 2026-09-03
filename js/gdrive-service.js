/**
 * =========================================================================
 * GOOGLE DRIVE API SERVICE (Google Identity Services GIS + GAPI)
 * =========================================================================
 * Client ID: 620808857902-m0t2m88gmo97i5adlt7agfnbjl3c2p98.apps.googleusercontent.com
 * Parent Folder ID: 1-oqEfzFm_khFiNZqBRCSfpNdqdFCZ0h4
 * 
 * ฟังก์ชันหลัก:
 * 1. สร้างและค้นหาโฟลเดอร์ย่อย 3 โฟลเดอร์ใน Google Drive ของคุณครู:
 *    - 📁 เล่มรายงานโครงงาน (Report Documents)
 *    - 📁 สื่อนำเสนอโครงงาน (Presentation Slides)
 *    - 📁 รูปภาพสมาชิกและโครงงาน (Member Photos)
 * 2. จัดรูปแบบชื่อไฟล์อัตโนมัติ:
 *    - เล่มโครงงาน: เล่มรายงาน_{ชื่อโครงงาน}_{วันที่และเวลาส่ง}.ext
 *    - สไลด์นำเสนอ: สื่อนำเสนอ_{ชื่อโครงงาน}_{วันที่และเวลาส่ง}.ext
 *    - รูปประจำตัว: รูปประจำตัว_{ชื่อโครงงาน}_{ชื่อสมาชิก}_{รหัสนักเรียน}.ext
 * 3. อัปโหลดไฟล์ด้วย Multipart/Related ไปยังโฟลเดอร์ปลายทางโดยตรง
 */

export const CLIENT_ID = '620808857902-m0t2m88gmo97i5adlt7agfnbjl3c2p98.apps.googleusercontent.com';
export const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
export const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid';
export const DEFAULT_PARENT_FOLDER_ID = '1-oqEfzFm_khFiNZqBRCSfpNdqdFCZ0h4';

export const FOLDER_NAMES = {
  MAIN: "Project Evaluation Platform",
  REPORT: "เล่มรายงานโครงงาน",
  PRESENTATION: "สื่อนำเสนอโครงงาน",
  PHOTO: "รูปภาพสมาชิกและโครงงาน"
};

/**
 * สกัด Google Drive File ID จาก URL รูปแบบต่างๆ หรือ Raw ID
 * @param {string} urlOrId
 * @returns {string} File ID (ถ้าไม่พบจะคืนค่าสตริงว่าง)
 */
export function extractDriveFileId(urlOrId) {
  if (!urlOrId || typeof urlOrId !== 'string') return '';
  const trimmed = urlOrId.trim();

  // กรณีเป็น File ID ดิบๆ (ตัวอักษรและเครื่องหมายขีดล่าง/ขีดกลางยาวเกิน 20 ตัว)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  // รูปแบบ drive.google.com/file/d/{id}/...
  const dMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch && dMatch[1]) return dMatch[1];

  // รูปแบบ /d/{id}/...
  const dShortMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dShortMatch && dShortMatch[1]) return dShortMatch[1];

  // รูปแบบ ?id={id} หรือ &id={id}
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];

  // รูปแบบ googleusercontent.com/d/{id}
  const lh3Match = trimmed.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lh3Match && lh3Match[1]) return lh3Match[1];

  return '';
}

/**
 * แปลง URL ของ Google Drive หรือ File ID ให้เป็น Direct Image CDN URL ที่สามารถโหลดในแท็ก <img> ได้ 100%
 * @param {string} urlOrId ลิงก์เดิมหรือ File ID
 * @param {number} size ขนาดความกว้าง/สูงสูงสุดของภาพ (default: 800)
 * @returns {string} Direct Image URL
 */
export function formatDriveImageUrl(urlOrId, size = 800) {
  if (!urlOrId) return 'assets/avatar-placeholder.svg';
  if (typeof urlOrId !== 'string') return 'assets/avatar-placeholder.svg';

  const trimmed = urlOrId.trim();
  // ถ้าเป็น Data URL (Base64), Blob หรือไฟล์ Local อยู่แล้ว ให้คืนค่าเดิม
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:') || trimmed.startsWith('assets/')) {
    return trimmed;
  }

  const fileId = extractDriveFileId(trimmed);
  if (fileId) {
    // ใช้ Google Image CDN (lh3.googleusercontent.com/d/{id}=s{size}) ซึ่งไม่ติดปัญหาคุกกี้และรวดเร็วที่สุด
    return `https://lh3.googleusercontent.com/d/${fileId}=s${size}`;
  }

  return trimmed;
}


export class GoogleDriveService {
  constructor(getSettingsFn, updateSettingsFn) {
    this.getSettings = getSettingsFn;
    this.updateSettings = updateSettingsFn;
    this.tokenClient = null;
    this.gapiInited = false;
    this.gisInited = false;
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.folderCache = null;
    this.userInfo = null;

    // กู้คืน Token ที่บันทึกไว้ใน LocalStorage
    try {
      const cachedToken = localStorage.getItem('project_eval_gdrive_token');
      const cachedExp = localStorage.getItem('project_eval_gdrive_token_exp');
      const cachedFolders = localStorage.getItem('project_eval_gdrive_folders');
      const cachedUser = localStorage.getItem('project_eval_gdrive_user');
      if (cachedToken && cachedExp && Date.now() < parseInt(cachedExp, 10)) {
        this.accessToken = cachedToken;
        this.tokenExpiresAt = parseInt(cachedExp, 10);
        if (cachedFolders) this.folderCache = JSON.parse(cachedFolders);
        if (cachedUser) this.userInfo = JSON.parse(cachedUser);
        console.log("[Google Drive] กู้คืน Active OAuth Token จาก LocalStorage สำเร็จ!");
      }
    } catch (e) {}

    this.initLibraries();
  }

  /**
   * โหลดและเริ่มต้น GAPI และ GIS Client
   */
  initLibraries() {
    const checkGapi = () => {
      if (window.gapi) {
        window.gapi.load('client', async () => {
          try {
            await window.gapi.client.init({
              discoveryDocs: [DISCOVERY_DOC],
            });
            this.gapiInited = true;
            if (this.accessToken && window.gapi.client) {
              window.gapi.client.setToken({ access_token: this.accessToken });
            }
            console.log("[GAPI] Drive Client พร้อมทำงานแล้ว");
          } catch (e) {
            console.warn("[GAPI Init Warning]:", e);
          }
        });
      } else {
        setTimeout(checkGapi, 300);
      }
    };

    const checkGis = () => {
      if (window.google?.accounts?.oauth2) {
        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (tokenResponse) => {
            if (tokenResponse.error !== undefined) {
              console.error("[GIS Error]:", tokenResponse);
              if (this.onAuthError) this.onAuthError(tokenResponse);
              return;
            }
            this.accessToken = tokenResponse.access_token;
            this.tokenExpiresAt = Date.now() + (parseInt(tokenResponse.expires_in, 10) || 3600) * 1000;
            if (window.gapi?.client) {
              window.gapi.client.setToken(tokenResponse);
            }

            // บันทึก Token ลง LocalStorage และส่งให้ Server
            try {
              localStorage.setItem('project_eval_gdrive_token', this.accessToken);
              localStorage.setItem('project_eval_gdrive_token_exp', String(this.tokenExpiresAt));
              fetch('/api/auth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken: this.accessToken, expiresIn: tokenResponse.expires_in })
              }).catch(() => {});
            } catch (e) {}

            console.log("[GIS] Google Drive Token ได้รับสำเร็จ!");
            if (this.onAuthSuccess) this.onAuthSuccess(this.accessToken);
          }
        });
        this.gisInited = true;
        console.log("[GIS] Google Identity Services พร้อมทำงานแล้ว");
      } else {
        setTimeout(checkGis, 300);
      }
    };

    checkGapi();
    checkGis();
  }

  /**
   * ดึงข้อมูลโปรไฟล์บัญชี Google จาก Token (รองรับทั้ง userinfo และ tokeninfo)
   */
  async fetchUserInfo(token) {
    const t = token || this.accessToken;
    if (!t) return null;

    // วิธีที่ 1: Google OAuth2 v3 userinfo
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (res.ok) {
        const info = await res.json();
        if (info && info.email) {
          this.userInfo = info;
          return info;
        }
      }
    } catch (e) {
      console.warn("[Google Drive] fetchUserInfo v3 error:", e);
    }

    // วิธีที่ 2: Google Tokeninfo (Fallback ให้ได้รับ Email เสมอ)
    try {
      const res2 = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${t}`);
      if (res2.ok) {
        const tokenInfo = await res2.json();
        if (tokenInfo && tokenInfo.email) {
          const info = {
            email: tokenInfo.email,
            name: tokenInfo.email.split('@')[0],
            picture: ''
          };
          this.userInfo = info;
          return info;
        }
      }
    } catch (e) {
      console.warn("[Google Drive] tokeninfo fallback error:", e);
    }

    return this.userInfo || null;
  }

  /**
   * สั่งเปิดหน้าต่าง Authorize (Sign in with Google) พร้อมระบบตรวจสอบโดเมน @psuwit.ac.th
   */
  requestDriveAuth(options = {}) {
    const { prompt = 'select_account', checkAdmin = false, allowedEmails = [] } = options;

    return new Promise((resolve, reject) => {
      if (!this.gisInited || !this.tokenClient) {
        this.initLibraries();
      }

      this.onAuthSuccess = async (token) => {
        try {
          const userInfo = await this.fetchUserInfo(token);

          if (checkAdmin) {
            const userEmail = (userInfo?.email || "").trim().toLowerCase();
            const whitelist = (allowedEmails.length > 0 ? allowedEmails : ["peelaphat@psuwit.ac.th", "peelapatkaewkong@gmail.com"])
              .map(e => e.trim().toLowerCase());

            const isDomainMatch = userEmail.endsWith("@psuwit.ac.th");
            const isWhitelistMatch = whitelist.includes(userEmail);

            // อนุญาตถ้าเป็นโดเมน @psuwit.ac.th หรืออยู่ใน Whitelist
            const isAllowed = isDomainMatch || isWhitelistMatch;

            if (!isAllowed) {
              // อีเมลไม่ได้อยู่ภายใต้โดเมน @psuwit.ac.th -> ลบ Token ทันที
              this.signOut();
              const err = new Error(`บัญชี Google "${userInfo?.email || 'นี้'}" ไม่ได้อยู่ภายใต้โดเมน @psuwit.ac.th\n\nระบบอนุญาตเฉพาะบัญชีอีเมล Google Workspace ของโรงเรียน (@psuwit.ac.th) เท่านั้น`);
              err.isUnauthorized = true;
              err.isDomainInvalid = !isDomainMatch;
              err.email = userInfo.email;
              reject(err);
              return;
            }
          }

          const folders = await this.ensureDriveFolders();
          this.folderCache = folders;
          if (this.updateSettings) {
            await this.updateSettings({
              gdriveOAuthConnected: true,
              gdriveAccessToken: token,
              gdriveTokenExp: this.tokenExpiresAt,
              gdriveFolders: folders
            });
          }
          resolve({ token, userInfo, folders });
        } catch (e) {
          reject(e);
        }
      };

      this.onAuthError = (err) => {
        reject(new Error(err.message || err.error || "เกิดข้อผิดพลาดในการยืนยันสิทธิ์ Google"));
      };

      this.tokenClient.requestAccessToken({ prompt });
    });
  }

  /**
   * ซิงค์ Token และ Folder จาก Settings ใน Cloud
   * ตรวจสอบ Token Expiry ก่อนรับ — ถ้าหมดอายุแล้วจะไม่รับ Token เก่ามาใช้
   */
  syncFromSettings(settings) {
    if (!settings) return;
    if (settings.gdriveAccessToken) {
      const expiry = parseInt(settings.gdriveTokenExp, 10) || 0;
      // ตรวจสอบว่า Token ยังไม่หมดอายุ (เผื่อเวลา 60 วินาที)
      if (expiry > Date.now() + 60000) {
        this.accessToken = settings.gdriveAccessToken;
        this.tokenExpiresAt = expiry;
        if (settings.gdriveFolders) this.folderCache = settings.gdriveFolders;
        if (window.gapi?.client) {
          window.gapi.client.setToken({ access_token: this.accessToken });
        }
        console.log(`[Google Drive] ซิงค์ Active Token จาก Cloud สำเร็จ (หมดอายุ: ${new Date(expiry).toLocaleTimeString()})`);
      } else {
        console.warn(`[Google Drive] Token จาก Cloud หมดอายุแล้ว (${expiry ? new Date(expiry).toLocaleTimeString() : 'ไม่ทราบ'}) → ไม่รับ Token เก่ามาใช้`);
        // เก็บ folder cache ไว้ใช้ (ไม่เปลี่ยน)
        if (settings.gdriveFolders && !this.folderCache) {
          this.folderCache = settings.gdriveFolders;
        }
      }
    }
  }

  /**
   * Sign out / Revoke token
   */
  signOut() {
    if (this.accessToken) {
      window.google?.accounts?.oauth2?.revoke(this.accessToken, () => {
        console.log("[GIS] Google Drive Token Revoked");
      });
      this.accessToken = null;
      this.tokenExpiresAt = 0;
      if (window.gapi?.client) {
        window.gapi.client.setToken('');
      }
    }
  }

  /**
   * ตรวจสอบว่าระบบพร้อมบันทึกลง Google Drive หรือไม่
   */
  isConfigured() {
    return Boolean(this.accessToken && Date.now() < this.tokenExpiresAt);
  }

  /**
   * ตรวจสอบ Token กับ Google API ว่ายังใช้ได้จริง
   */
  async validateToken(token) {
    if (!token) return false;
    try {
      const res = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
      if (res.ok) {
        const data = await res.json();
        return data && data.expires_in > 30;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * ดึง Active Token ที่ยังไม่หมดอายุ ดึงจากหลายแหล่ง พร้อมเช็ค expiry
   */
  getActiveToken() {
    // 1. Token จาก instance (ได้จาก requestDriveAuth หรือ syncFromSettings)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    // 2. Token จาก GAPI client (ถ้า user ใช้ GAPI)
    const gapiToken = window.gapi?.client?.getToken()?.access_token;
    if (gapiToken) return gapiToken;

    // 3. Token จาก Settings (Firestore/localStorage)
    const settings = this.getSettings();
    const settingsExp = parseInt(settings?.gdriveTokenExp, 10) || 0;
    if (settings?.gdriveAccessToken && settingsExp > Date.now() + 60000) {
      this.accessToken = settings.gdriveAccessToken;
      this.tokenExpiresAt = settingsExp;
      return this.accessToken;
    }

    // 4. Token จาก localStorage (ฝั่ง client cache)
    try {
      const cached = localStorage.getItem('project_eval_gdrive_token');
      const cachedExp = parseInt(localStorage.getItem('project_eval_gdrive_token_exp'), 10) || 0;
      if (cached && cachedExp > Date.now() + 60000) {
        this.accessToken = cached;
        this.tokenExpiresAt = cachedExp;
        return cached;
      }
    } catch (e) {}

    return null;
  }

  /**
   * คำนวณจำนวนวินาทีที่เหลือก่อน Google Drive Token จะหมดอายุ
   * @returns {number} วินาทีที่เหลือ (0 หากหมดอายุแล้วหรือไม่พบ)
   */
  getTokenRemainingSeconds() {
    const activeToken = this.getActiveToken();
    if (!activeToken || !this.tokenExpiresAt) return 0;
    return Math.max(0, Math.round((this.tokenExpiresAt - Date.now()) / 1000));
  }

  /**
   * ตรวจสอบสถานะการเชื่อมต่อ Google Drive แบบสรุปสำหรับแสดงใน UI
   * @returns {{ connected: boolean, remainingMinutes: number, text: string, badgeClass: string }}
   */
  getTokenStatus() {
    const remainingSec = this.getTokenRemainingSeconds();
    if (remainingSec <= 0) {
      return {
        connected: false,
        remainingMinutes: 0,
        text: 'สิทธิ์การเชื่อมต่อหมดอายุแล้ว (กรุณาต่ออายุ)',
        badgeClass: 'badge-danger'
      };
    }

    const minutes = Math.floor(remainingSec / 60);
    if (minutes < 15) {
      return {
        connected: true,
        remainingMinutes: minutes,
        text: `ใกล้หมดอายุ (เหลือ ${minutes} นาที)`,
        badgeClass: 'badge-warning'
      };
    }

    return {
      connected: true,
      remainingMinutes: minutes,
      text: `เชื่อมต่อ Google Drive แล้ว (เหลือ ${minutes} นาที)`,
      badgeClass: 'badge-success'
    };
  }

  /**
   * ขอ Token ใหม่แบบเงียบ (Silent Token Refresh) โดยไม่ต้องมี Popup เด้ง
   * ใช้เมื่อคุณครูเปิดใช้งานหน้าเว็บอยู่ เพื่อรักษาการเชื่อมต่อให้คงอยู่ตลอดเวลา
   */
  async silentRefreshToken() {
    if (!this.tokenClient) {
      console.warn("[Google Drive] tokenClient ยังไม่พร้อมสำหรับ Silent Refresh");
      return null;
    }

    return new Promise((resolve) => {
      const origSuccess = this.onAuthSuccess;
      const origError = this.onAuthError;

      const timeout = setTimeout(() => {
        this.onAuthSuccess = origSuccess;
        this.onAuthError = origError;
        resolve(null);
      }, 8000);

      this.onAuthSuccess = async (token) => {
        clearTimeout(timeout);
        this.onAuthSuccess = origSuccess;
        this.onAuthError = origError;

        try {
          if (this.updateSettings) {
            await this.updateSettings({
              gdriveOAuthConnected: true,
              gdriveAccessToken: token,
              gdriveTokenExp: this.tokenExpiresAt,
              gdriveFolders: this.folderCache
            });
          }
          console.log("[Google Drive] Silent Refresh สำเร็จ! Token ต่ออายุอีก 1 ชั่วโมง");
        } catch (e) {
          console.warn("[Google Drive] บันทึกผล Silent Refresh ไม่สำเร็จ:", e);
        }

        resolve(token);
      };

      this.onAuthError = (err) => {
        clearTimeout(timeout);
        this.onAuthSuccess = origSuccess;
        this.onAuthError = origError;
        console.warn("[Google Drive] Silent Refresh ไม่สำเร็จ (อาจต้อง Login ใหม่):", err);
        resolve(null);
      };

      // prompt: '' ขอแบบเงียบโดยไม่ต้องเลือกบัญชีใหม่
      this.tokenClient.requestAccessToken({ prompt: '' });
    });
  }


  /**
   * ค้นหาหรือสร้าง 3 โฟลเดอร์ใน Google Drive ของคุณครู
   */
  async ensureDriveFolders() {
    const mainFolderId = DEFAULT_PARENT_FOLDER_ID;

    // หาหรือสร้างโฟลเดอร์ย่อย 3 โฟลเดอร์ข้างใน Folder ID ของครู
    const reportFolderId = await this.findOrCreateFolder(FOLDER_NAMES.REPORT, mainFolderId);
    const presentationFolderId = await this.findOrCreateFolder(FOLDER_NAMES.PRESENTATION, mainFolderId);
    const photoFolderId = await this.findOrCreateFolder(FOLDER_NAMES.PHOTO, mainFolderId);

    const folders = {
      mainFolderId,
      reportFolderId,
      presentationFolderId,
      photoFolderId
    };

    this.folderCache = folders;
    try {
      localStorage.setItem('project_eval_gdrive_folders', JSON.stringify(folders));
    } catch (e) {}
    return folders;
  }

  async findOrCreateFolder(name, parentId = null) {
    const settings = this.getSettings();
    const token = this.accessToken || settings?.gdriveAccessToken || window.gapi?.client?.getToken()?.access_token || localStorage.getItem('project_eval_gdrive_token');
    if (!token) throw new Error("ไม่พบ Google Drive Access Token กรุณากดเชื่อมต่อ Google Drive ในหน้าระบบผู้ดูแลระบบ");

    let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }

    try {
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }

      // สร้างโฟลเดอร์ใหม่
      const createRes = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: name,
          mimeType: "application/vnd.google-apps.folder",
          parents: parentId ? [parentId] : []
        })
      });
      const createData = await createRes.json();
      return createData.id;
    } catch (e) {
      console.error("[Folder Create Error]:", e);
      throw e;
    }
  }

  /**
   * อัปโหลดไฟล์เข้า Google Drive และบันทึกลงในโฟลเดอร์ที่ถูกต้อง
   * ตรวจสอบ Token ก่อนอัปโหลด — ถ้าหมดอายุจะแจ้ง Error ชัดเจน
   */
  async uploadFile({ file, type, projectName, studentName = '', studentId = '', onProgress = null }) {
    if (!file) throw new Error("ไม่พบไฟล์ที่ต้องการอัปโหลด");

    if (onProgress) onProgress({ status: 'reading', message: `กำลังเตรียมไฟล์: ${file.name}...` });

    const nowStr = this.getFormattedDateTime();
    const cleanProject = this.sanitizeName(projectName || "โครงงาน");
    const cleanStudent = this.sanitizeName(studentName || "นักเรียน");
    const cleanId = this.sanitizeName(studentId || "");
    const ext = this.getFileExtension(file.name);

    let formattedFileName = "";
    let folderKey = "reportFolderId";
    let folderNameThai = FOLDER_NAMES.REPORT;

    if (type === "report") {
      formattedFileName = `เล่มรายงาน_${cleanProject}_${nowStr}.${ext}`;
      folderKey = "reportFolderId";
      folderNameThai = FOLDER_NAMES.REPORT;
    } else if (type === "presentation") {
      formattedFileName = `สื่อนำเสนอ_${cleanProject}_${nowStr}.${ext}`;
      folderKey = "presentationFolderId";
      folderNameThai = FOLDER_NAMES.PRESENTATION;
    } else {
      const idPart = cleanId ? `_${cleanId}` : "";
      formattedFileName = `รูปประจำตัว_${cleanProject}_${cleanStudent}${idPart}.${ext}`;
      folderKey = "photoFolderId";
      folderNameThai = FOLDER_NAMES.PHOTO;
    }

    // =========================================================================
    // ขั้นตอนที่ 0: ตรวจสอบ Active Token ที่ยังไม่หมดอายุ
    // =========================================================================
    if (onProgress) onProgress({ status: 'checking', message: 'กำลังตรวจสอบสิทธิ์การเชื่อมต่อ Google Drive...' });
    
    const activeToken = this.getActiveToken();
    
    if (!activeToken) {
      console.error("[Google Drive] ไม่พบ Token ที่ยังไม่หมดอายุ");
      const err = new Error(
        "ไม่สามารถอัปโหลดไฟล์เข้า Google Drive ได้\n\n" +
        "สาเหตุ: สิทธิ์การเชื่อมต่อ Google Drive หมดอายุแล้ว\n\n" +
        "วิธีแก้ไข: กรุณาแจ้งคุณครูผู้ดูแลระบบให้เข้าสู่ระบบ\nและกดปุ่ม 'เชื่อมต่อ Google Drive' อีกครั้ง\nจากนั้นลองส่งผลงานใหม่"
      );
      err.isTokenExpired = true;
      throw err;
    }

    // =========================================================================
    // ขั้นตอนที่ 1: อัปโหลดผ่าน Google OAuth 2.0 (Binary Blob Multipart)
    // =========================================================================
    if (onProgress) onProgress({ status: 'uploading', message: `กำลังส่ง "${formattedFileName}" เข้าโฟลเดอร์ ${folderNameThai}...` });

    const settings = this.getSettings();
    let folders = this.folderCache || settings.gdriveFolders;
    if (!folders) {
      try {
        folders = await this.ensureDriveFolders();
      } catch (folderErr) {
        console.warn("[Folder Ensure Warning]:", folderErr);
      }
    }
    const targetParentId = folders?.[folderKey] || folders?.mainFolderId || DEFAULT_PARENT_FOLDER_ID;

    // สร้าง Multipart Request Body (Binary Blob)
    const boundary = '-------ProjectEvalBoundary' + Date.now();
    const metadata = {
      name: formattedFileName,
      mimeType: file.type || 'application/octet-stream'
    };
    if (targetParentId) {
      metadata.parents = [targetParentId];
    }

    const buildMultipartBody = (meta) => {
      return new Blob([
        `--${boundary}\r\n`,
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        JSON.stringify(meta),
        `\r\n--${boundary}\r\n`,
        `Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`,
        file,
        `\r\n--${boundary}--`
      ]);
    };

    const uploadHeaders = {
      Authorization: `Bearer ${activeToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    };
    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,webContentLink,thumbnailLink';

    let uploadedFile = null;

    // ลองอัปโหลดเข้าโฟลเดอร์ปลายทาง
    try {
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: uploadHeaders,
        body: buildMultipartBody(metadata)
      });

      if (res.ok) {
        uploadedFile = await res.json();
      } else {
        const errStatus = res.status;
        const errText = await res.text();
        console.warn(`[Google Drive Upload Error]: ${errStatus}`, errText);

        // 401 = Token หมดอายุจริงๆ (แม้ local expiry ยังไม่ถึง)
        if (errStatus === 401 || errStatus === 403) {
          // ลบ Token เก่าออก
          this.accessToken = null;
          this.tokenExpiresAt = 0;
          try {
            localStorage.removeItem('project_eval_gdrive_token');
            localStorage.removeItem('project_eval_gdrive_token_exp');
          } catch (e) {}

          const tokenErr = new Error(
            "สิทธิ์การเชื่อมต่อ Google Drive หมดอายุแล้ว\n\n" +
            "กรุณาแจ้งคุณครูผู้ดูแลระบบให้กดปุ่ม 'เชื่อมต่อ Google Drive' อีกครั้ง\n" +
            "จากนั้นลองส่งผลงานใหม่"
          );
          tokenErr.isTokenExpired = true;
          throw tokenErr;
        }

        // ข้อผิดพลาดอื่น (เช่น parent folder ไม่มีสิทธิ์) → ลองอัปโหลดไม่ระบุ parent
        if (errStatus === 404 || errStatus === 400) {
          const noParentMeta = { name: formattedFileName, mimeType: file.type || 'application/octet-stream' };
          const retryRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: uploadHeaders,
            body: buildMultipartBody(noParentMeta)
          });
          if (retryRes.ok) {
            uploadedFile = await retryRes.json();
          } else {
            console.error("[Google Drive Retry Failed]:", retryRes.status);
          }
        }
      }
    } catch (uploadErr) {
      // ถ้าเป็น tokenExpired error ที่เราสร้างขึ้น → throw ต่อ
      if (uploadErr.isTokenExpired) throw uploadErr;
      console.warn("[Google Drive Upload Exception]:", uploadErr);
    }

    // =========================================================================
    // อัปโหลดสำเร็จ → ตั้งสิทธิ์ Reader แล้ว Return
    // =========================================================================
    if (uploadedFile && uploadedFile.id) {
      const fileId = uploadedFile.id;

      // ตั้งค่าสิทธิ์ให้อ่านได้ (Reader for Anyone with Link) พร้อม await
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${activeToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ role: 'reader', type: 'anyone' })
        });
      } catch (permErr) {
        console.warn("[Google Drive] ไม่สามารถตั้งสิทธิ์ anyone ได้ทันที (อาจถูกจำกัดโดยนโยบายโดเมนของโรงเรียน):", permErr);
      }

      const directView = `https://drive.google.com/file/d/${fileId}/view`;
      const directPreview = `https://drive.google.com/file/d/${fileId}/preview`;
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const imageCdnUrl = formatDriveImageUrl(fileId, 800);
      const thumbnailLink = imageCdnUrl;

      if (onProgress) onProgress({ status: 'done', message: `บันทึก "${formattedFileName}" ลงโฟลเดอร์ "${folderNameThai}" สำเร็จ!` });

      return {
        success: true,
        isLocalFallback: false,
        fileId: fileId,
        fileName: formattedFileName,
        folderName: folderNameThai,
        viewUrl: uploadedFile.webViewLink || directView,
        directViewUrl: directView,
        previewUrl: directPreview,
        downloadUrl: downloadUrl,
        thumbnailLink: thumbnailLink,
        imageCdnUrl: imageCdnUrl,
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString()
      };
    }

    // =========================================================================
    // ถ้ามาถึงตรงนี้ = อัปโหลดไม่สำเร็จเลย → แจ้ง Error
    // =========================================================================
    const finalErr = new Error(
      "ไม่สามารถอัปโหลดไฟล์เข้า Google Drive ได้\n\n" +
      "กรุณาลองอีกครั้ง หรือแจ้งคุณครูผู้ดูแลระบบให้เชื่อมต่อ Google Drive ใหม่"
    );
    finalErr.isUploadFailed = true;
    throw finalErr;
  }

  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64Data = result.split(',')[1];
        resolve({ base64: base64Data, dataUrl: result });
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  getFormattedDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}_${hours}-${mins}`;
  }

  sanitizeName(str) {
    if (!str) return "unnamed";
    return String(str).replace(/[\/\\:*?"<>|#%]/g, "_").trim();
  }

  getFileExtension(filename) {
    if (!filename) return "dat";
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : "dat";
  }

  /**
   * ลบไฟล์เดี่ยวจาก Google Drive
   */
  async deleteFile(fileId) {
    if (!fileId || typeof fileId !== 'string' || fileId.startsWith('local_')) {
      return { success: true, message: 'Ignored local or empty fileId' };
    }

    console.log(`[Google Drive] กำลังลบไฟล์ ID: ${fileId}...`);

    // 1. ลองลบผ่าน Backend Server API ก่อน
    try {
      const serverRes = await fetch(`/api/files/${encodeURIComponent(fileId)}`, {
        method: 'DELETE'
      });
      if (serverRes.ok) {
        console.log(`[Google Drive] ลบไฟล์ ID ${fileId} ผ่าน Backend Server สำเร็จ`);
        return { success: true };
      }
    } catch (e) {
      // Backend not available
    }

    // 2. ลองลบผ่าน Google Drive Client-Side OAuth Token
    const token = this.accessToken || window.gapi?.client?.getToken()?.access_token;
    if (token) {
      try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok || res.status === 204 || res.status === 404) {
          console.log(`[Google Drive] ลบไฟล์ ID ${fileId} ผ่าน OAuth Token สำเร็จ`);
          return { success: true };
        }
      } catch (err) {
        console.warn(`[Google Drive Delete Error]:`, err);
      }
    }

    return { success: false };
  }

  /**
   * ลบไฟล์ทั้งหมดที่ผูกกับโครงงาน (เล่มรายงาน, สไลด์, รูปสมาชิก) ออกจาก Google Drive
   */
  async deleteProjectFiles(project) {
    if (!project) return;

    const fileIds = [];

    // เล่มรายงาน
    if (project.reportFile?.fileId) {
      fileIds.push(project.reportFile.fileId);
    }

    // สื่อนำเสนอ
    if (project.slideFile?.fileId) {
      fileIds.push(project.slideFile.fileId);
    }

    // รูปถ่ายสมาชิก
    if (Array.isArray(project.members)) {
      project.members.forEach(m => {
        if (m.photoFileId) {
          fileIds.push(m.photoFileId);
        }
      });
    }

    console.log(`[Google Drive] กำลังลบไฟล์ทั้งหมด ${fileIds.length} ไฟล์ของโครงงาน "${project.title}"...`);

    const results = await Promise.allSettled(
      fileIds.map(fId => this.deleteFile(fId))
    );

    return results;
  }
}
