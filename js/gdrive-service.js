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
   * ดึงข้อมูลโปรไฟล์บัญชี Google จาก Token
   */
  async fetchUserInfo(token) {
    const t = token || this.accessToken;
    if (!t) return null;
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (res.ok) {
        const info = await res.json();
        this.userInfo = info;
        return info;
      }
    } catch (e) {
      console.warn("[Google Drive] fetchUserInfo error:", e);
    }
    return null;
  }

  /**
   * สั่งเปิดหน้าต่าง Authorize (Sign in with Google) พร้อมระบบตรวจสอบอีเมลผู้ดูแลระบบ
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

          if (checkAdmin && userInfo?.email) {
            const whitelist = (allowedEmails.length > 0 ? allowedEmails : ["peelaphat@psuwit.ac.th"])
              .map(e => e.trim().toLowerCase());

            if (!whitelist.includes(userInfo.email.trim().toLowerCase())) {
              // อีเมลไม่ได้รับอนุญาต -> ลบ Token และยกเลิกสิทธิ์ทันที
              this.signOut();
              const err = new Error(`บัญชี Google "${userInfo.email}" ไม่มีสิทธิ์เข้าถึงส่วนงานผู้ดูแลระบบ\nกรุณาเข้าสู่ระบบด้วยอีเมลของคุณครูผู้ดูแลระบบเท่านั้น (${whitelist.join(', ')})`);
              err.isUnauthorized = true;
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
    return folders;
  }

  async findOrCreateFolder(name, parentId = null) {
    const token = this.accessToken || window.gapi?.client?.getToken()?.access_token;
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

    const settings = this.getSettings();

    // =========================================================================
    // วิธีที่ 1: อัปโหลดผ่าน Google OAuth 2.0 (Multipart/Related มี Parents แน่นอน)
    // =========================================================================
    const activeToken = this.accessToken || window.gapi?.client?.getToken()?.access_token;
    if (activeToken && Date.now() < this.tokenExpiresAt) {
      try {
        if (onProgress) onProgress({ status: 'uploading', message: `กำลังส่ง "${formattedFileName}" เข้าโฟลเดอร์ ${folderNameThai}...` });

        const folders = this.folderCache || settings.gdriveFolders || await this.ensureDriveFolders();
        const targetParentId = folders[folderKey] || folders.mainFolderId || DEFAULT_PARENT_FOLDER_ID;

        // อ่านไฟล์เป็น Base64
        const { base64 } = await this.fileToBase64(file);

        // สร้าง Multipart Request Body สำหรับ Google Drive API v3
        const boundary = '-------ProjectEvalBoundary' + Date.now();
        const delimiter = "\r\n--" + boundary + "\r\n";
        const closeDelim = "\r\n--" + boundary + "--";

        const metadata = {
          name: formattedFileName,
          mimeType: file.type || 'application/octet-stream',
          parents: [targetParentId]
        };

        const multipartRequestBody =
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: ' + (file.type || 'application/octet-stream') + '\r\n' +
          'Content-Transfer-Encoding: base64\r\n\r\n' +
          base64 +
          closeDelim;

        const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,webContentLink,thumbnailLink', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${activeToken}`,
            'Content-Type': `multipart/related; boundary="${boundary}"`
          },
          body: multipartRequestBody
        });

        const uploadedFile = await uploadRes.json();
        if (uploadedFile.id) {
          // ตั้งค่าสิทธิ์ให้อ่านได้ (Reader for Anyone with Link)
          fetch(`https://www.googleapis.com/drive/v3/files/${uploadedFile.id}/permissions?supportsAllDrives=true`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${activeToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: 'reader', type: 'anyone' })
          }).catch(console.warn);

          const directView = `https://drive.google.com/file/d/${uploadedFile.id}/view`;
          const directPreview = `https://drive.google.com/file/d/${uploadedFile.id}/preview`;
          const downloadUrl = `https://drive.google.com/uc?export=download&id=${uploadedFile.id}`;

          if (onProgress) onProgress({ status: 'done', message: `บันทึก "${formattedFileName}" ลงโฟลเดอร์ "${folderNameThai}" สำเร็จ!` });

          return {
            success: true,
            isLocalFallback: false,
            fileId: uploadedFile.id,
            fileName: formattedFileName,
            folderName: folderNameThai,
            viewUrl: uploadedFile.webViewLink || directView,
            directViewUrl: directView,
            previewUrl: directPreview,
            downloadUrl: downloadUrl,
            thumbnailLink: uploadedFile.thumbnailLink || directView,
            originalName: file.name,
            size: file.size,
            mimeType: file.type,
            uploadedAt: new Date().toISOString()
          };
        } else {
          console.warn("[OAuth Upload Warning]:", uploadedFile);
        }
      } catch (err) {
        console.warn("[OAuth Upload Error, trying fallbacks]:", err);
      }
    }

    // =========================================================================
    // วิธีที่ 2: อัปโหลดผ่านเซิร์ฟเวอร์ Backend (/api/upload)
    // =========================================================================
    try {
      if (onProgress) onProgress({ status: 'uploading', message: `กำลังส่งไฟล์ "${formattedFileName}" ผ่านเซิร์ฟเวอร์ไปยัง Google Drive...` });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      formData.append('projectName', projectName);
      formData.append('studentName', studentName);
      formData.append('studentId', studentId);
      formData.append('parentFolderId', DEFAULT_PARENT_FOLDER_ID);

      const serverRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (serverRes.ok) {
        const serverData = await serverRes.json();
        if (serverData.status === 'success' && serverData.fileId) {
          if (onProgress) onProgress({ status: 'done', message: `บันทึก "${formattedFileName}" ลงโฟลเดอร์ "${serverData.folderName || folderNameThai}" สำเร็จ!` });

          return {
            success: true,
            isLocalFallback: false,
            fileId: serverData.fileId,
            fileName: serverData.fileName || formattedFileName,
            folderName: serverData.folderName || folderNameThai,
            viewUrl: serverData.viewUrl,
            directViewUrl: serverData.directViewUrl || serverData.viewUrl,
            previewUrl: serverData.previewUrl || serverData.viewUrl,
            downloadUrl: serverData.downloadUrl,
            thumbnailLink: serverData.thumbnailLink || serverData.viewUrl,
            originalName: file.name,
            size: file.size,
            mimeType: file.type,
            uploadedAt: new Date().toISOString()
          };
        }
      }
    } catch (serverErr) {
      console.warn("[Backend Upload Warning, trying local storage fallback]:", serverErr);
    }

    // =========================================================================
    // วิธีที่ 3: Local Storage DataURL Fallback
    // =========================================================================
    const { dataUrl } = await this.fileToBase64(file);
    if (onProgress) onProgress({ status: 'done', message: `บันทึกไฟล์สำเร็จในเครื่อง (Local Storage)` });

    return {
      success: true,
      isLocalFallback: true,
      fileId: `local_${Date.now()}`,
      fileName: formattedFileName,
      folderName: folderNameThai,
      viewUrl: dataUrl,
      directViewUrl: dataUrl,
      downloadUrl: dataUrl,
      thumbnailLink: dataUrl,
      originalName: file.name,
      size: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString()
    };
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
