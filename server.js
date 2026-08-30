/**
 * =========================================================================
 * BACKEND SERVER: ระบบประเมินผลงานโครงงาน (Node.js + Express + Google Drive API)
 * =========================================================================
 * รองรับการอัปโหลดไฟล์เข้า Google Drive ด้วย Google Service Account:
 * - แยก 3 โฟลเดอร์อัตโนมัติ:
 *   1. เล่มรายงานโครงงาน (Report Documents)
 *   2. สื่อนำเสนอโครงงาน (Presentation Slides)
 *   3. รูปภาพสมาชิกและโครงงาน (Member Photos)
 * - ตั้งชื่อไฟล์อัตโนมัติ:
 *   - เล่มโครงงาน: เล่มรายงาน_{ชื่อโครงงาน}_{วันที่และเวลาส่ง}.ext
 *   - สไลด์นำเสนอ: สื่อนำเสนอ_{ชื่อโครงงาน}_{วันที่และเวลาส่ง}.ext
 *   - รูปประจำตัว: รูปประจำตัว_{ชื่อโครงงาน}_{ชื่อสมาชิก}_{รหัสนักเรียน}.ext
 */

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const stream = require('stream');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS & JSON Parser
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static Files (Frontend UI)
app.use(express.static(path.join(__dirname)));

// Memory Storage for Multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // สูงสุด 50 MB
});

// Google Service Account Key Path
const KEY_FILE_NAME = 'project-evaluation-platform-93974edeed12.json';
const KEYFILEPATH = path.join(__dirname, KEY_FILE_NAME);

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file'
];

let driveClient = null;
let serviceAccountEmail = null;

// Initializing Google Auth with Service Account
try {
  if (fs.existsSync(KEYFILEPATH)) {
    const keyData = JSON.parse(fs.readFileSync(KEYFILEPATH, 'utf8'));
    serviceAccountEmail = keyData.client_email;

    const auth = new google.auth.GoogleAuth({
      keyFile: KEYFILEPATH,
      scopes: SCOPES,
    });

    driveClient = google.drive({ version: 'v3', auth });
    console.log(`[Google Drive] เชื่อมต่อสำเร็จด้วย Service Account: ${serviceAccountEmail}`);
  } else {
    console.warn(`[Google Drive] ไม่พบไฟล์ Service Account ที่: ${KEYFILEPATH}`);
  }
} catch (err) {
  console.error('[Google Drive Auth Error]:', err.message);
}

const DEFAULT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || "1-oqEfzFm_khFiNZqBRCSfpNdqdFCZ0h4";

// โฟลเดอร์หลักและโฟลเดอร์ย่อย
const FOLDERS = {
  MAIN: "ระบบประเมินโครงงาน_ผลงานนักเรียน",
  REPORT: "เล่มรายงานโครงงาน",
  PRESENTATION: "สื่อนำเสนอโครงงาน",
  PHOTO: "รูปภาพสมาชิกและโครงงาน"
};

// Cache เก็บ Folder IDs
const folderCache = {};

/**
 * ฟังก์ชันค้นหาหรือสร้างโฟลเดอร์บน Google Drive
 */
async function getOrCreateFolder(folderName, parentFolderId = null) {
  if (!driveClient) throw new Error('Google Drive Client ยังไม่ได้เชื่อมต่อ');

  const cacheKey = `${folderName}_${parentFolderId || 'root'}`;
  if (folderCache[cacheKey]) return folderCache[cacheKey];

  let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }

  try {
    const listRes = await driveClient.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    if (listRes.data.files && listRes.data.files.length > 0) {
      const id = listRes.data.files[0].id;
      folderCache[cacheKey] = id;
      return id;
    }
  } catch (e) {
    console.warn(`[Folder Search Warning]: ${e.message}`);
  }

  // ถ้ายังไม่มี ให้สร้างใหม่
  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentFolderId ? [parentFolderId] : []
  };

  const createRes = await driveClient.files.create({
    requestBody: fileMetadata,
    fields: 'id, name',
    supportsAllDrives: true
  });

  const newId = createRes.data.id;
  folderCache[cacheKey] = newId;

  // ตั้งสิทธิ์ให้อ่านได้
  try {
    await driveClient.permissions.create({
      fileId: newId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true
    });
  } catch (e) {}

  return newId;
}

/**
 * หานามสกุลไฟล์
 */
function getFileExtension(filename, mimetype = '') {
  if (filename && filename.includes('.')) {
    return filename.split('.').pop().toLowerCase();
  }
  if (mimetype.includes('pdf')) return 'pdf';
  if (mimetype.includes('word') || mimetype.includes('docx')) return 'docx';
  if (mimetype.includes('presentation') || mimetype.includes('pptx')) return 'pptx';
  if (mimetype.includes('jpeg') || mimetype.includes('jpg')) return 'jpg';
  if (mimetype.includes('png')) return 'png';
  return 'bin';
}

/**
 * ตัดอักขระพิเศษที่ไม่ปลอดภัย
 */
function sanitizeName(str) {
  if (!str) return 'unnamed';
  return String(str).replace(/[\/\\:*?"<>|#%]/g, '_').trim();
}

/**
 * จัด Format วันที่และเวลา: YYYY-MM-DD_HH-mm
 */
function getFormattedDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}_${hours}-${mins}`;
}

// ===================== API ENDPOINTS =====================

/**
 * API ตรวจสอบสถานะการเชื่อมต่อ
 */
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    service: 'ระบบประเมินผลงานโครงงาน API',
    googleDriveConnected: Boolean(driveClient),
    serviceAccountEmail: serviceAccountEmail || 'ยังไม่ได้ตั้งค่า',
    configuredFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
    timestamp: new Date().toISOString()
  });
});

/**
 * API อัปโหลดไฟล์เข้า Google Drive (รองรับทั้ง /api/upload และ /upload)
 */
const uploadHandler = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ status: 'error', message: 'ไม่พบไฟล์ที่ส่งมา (No file attached)' });
    }

    if (!driveClient) {
      throw new Error('Google Drive API ยังไม่ได้เชื่อมต่อ กรุณาตรวจสอบไฟล์ Service Account JSON');
    }

    const body = req.body || {};
    const fileType = body.type || 'report'; // 'report' | 'presentation' | 'photo'
    const projectName = sanitizeName(body.projectName || 'โครงงาน');
    const studentName = sanitizeName(body.studentName || 'นักเรียน');
    const studentId = sanitizeName(body.studentId || '');
    const baseFolderId = body.parentFolderId || body.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID || DEFAULT_FOLDER_ID || null;

    // 1. กำหนดโฟลเดอร์ปลายทาง
    let subFolderName = FOLDERS.REPORT;
    if (fileType === 'presentation') subFolderName = FOLDERS.PRESENTATION;
    if (fileType === 'photo') subFolderName = FOLDERS.PHOTO;

    let targetFolderId = null;
    if (baseFolderId) {
      // สร้างโฟลเดอร์ย่อยในโฟลเดอร์ที่แชร์ให้
      targetFolderId = await getOrCreateFolder(subFolderName, baseFolderId);
    } else {
      // โฟลเดอร์ตั้งต้น
      try {
        const mainFolderId = await getOrCreateFolder(FOLDERS.MAIN, null);
        targetFolderId = await getOrCreateFolder(subFolderName, mainFolderId);
      } catch (quotaErr) {
        // หากติด quota ให้ใช้ root หรือแนะนำแชร์โฟลเดอร์
        console.warn('Direct root create quota notice:', quotaErr.message);
      }
    }

    // 2. ตั้งชื่อไฟล์ตาม Format ที่กำหนด
    const nowStr = getFormattedDateTime();
    const ext = getFileExtension(file.originalname, file.mimetype);
    let formattedFileName = '';

    if (fileType === 'report') {
      formattedFileName = `เล่มรายงาน_${projectName}_${nowStr}.${ext}`;
    } else if (fileType === 'presentation') {
      formattedFileName = `สื่อนำเสนอ_${projectName}_${nowStr}.${ext}`;
    } else if (fileType === 'photo') {
      const idPart = studentId ? `_${studentId}` : '';
      formattedFileName = `รูปประจำตัว_${projectName}_${studentName}${idPart}.${ext}`;
    } else {
      formattedFileName = `ไฟล์_${projectName}_${nowStr}.${ext}`;
    }

    // 3. แปลง Buffer เป็น PassThrough Stream
    const bufferStream = new stream.PassThrough();
    bufferStream.end(file.buffer);

    // 4. บันทึกไฟล์ลง Google Drive
    const requestBody = {
      name: formattedFileName
    };
    if (targetFolderId) {
      requestBody.parents = [targetFolderId];
    }

    const createResponse = await driveClient.files.create({
      requestBody: requestBody,
      media: {
        mimeType: file.mimetype || 'application/octet-stream',
        body: bufferStream
      },
      fields: 'id, name, webViewLink, webContentLink, thumbnailLink',
      supportsAllDrives: true
    });

    const fileId = createResponse.data.id;

    // 5. ตั้งสิทธิ์ให้ทุกคนที่มีลิงก์เข้าถึงแบบ Reader
    try {
      await driveClient.permissions.create({
        fileId: fileId,
        requestBody: { role: 'reader', type: 'anyone' },
        supportsAllDrives: true
      });
    } catch (permErr) {
      console.warn('Set permission notice:', permErr.message);
    }

    const viewUrl = `https://drive.google.com/file/d/${fileId}/view`;
    const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const thumbnailLink = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;

    res.json({
      status: 'success',
      message: `อัปโหลดเข้า Google Drive โฟลเดอร์ "${subFolderName}" สำเร็จ!`,
      fileId: fileId,
      fileName: formattedFileName,
      folderName: subFolderName,
      viewUrl: createResponse.data.webViewLink || viewUrl,
      directViewUrl: viewUrl,
      previewUrl: previewUrl,
      downloadUrl: createResponse.data.webContentLink || downloadUrl,
      thumbnailLink: createResponse.data.thumbnailLink || thumbnailLink,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      uploadedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Upload Error]:', error.message);
    
    let tip = '';
    if (error.message && error.message.includes('storage quota')) {
      tip = ` (คำแนะนำ: กรุณาสร้างโฟลเดอร์ใน Google Drive ของคุณครู แล้วแชร์ให้ ${serviceAccountEmail || 'Service Account'} สิทธิ์ Editor จากนั้นใส่ Folder ID ใน .env หรือใช้ Google OAuth / Apps Script)`;
    }

    res.status(500).json({
      status: 'error',
      message: `เกิดข้อผิดพลาดในการอัปโหลด: ${error.message}${tip}`
    });
  }
};

// Bind Endpoints for Multer fields
app.post('/api/upload', upload.single('file'), uploadHandler);
app.post('/upload', upload.any(), (req, res, next) => {
  if (req.files && req.files.length > 0) {
    req.file = req.files[0];
  }
  uploadHandler(req, res);
});

/**
 * API ลบไฟล์ออกจาก Google Drive
 */
app.delete('/api/files/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    if (!fileId || fileId.startsWith('local_')) {
      return res.json({ status: 'success', message: 'Ignored local file' });
    }

    if (!driveClient) {
      return res.status(500).json({ status: 'error', message: 'Google Drive ยังไม่ได้เชื่อมต่อ' });
    }

    await driveClient.files.delete({
      fileId: fileId,
      supportsAllDrives: true
    });

    console.log(`[Google Drive] ลบไฟล์ ID ${fileId} เรียบร้อยแล้ว`);
    res.json({ status: 'success', message: `ลบไฟล์ ${fileId} จาก Google Drive เรียบร้อยแล้ว` });
  } catch (err) {
    console.warn(`[Delete File Warning]:`, err.message);
    res.json({ status: 'error', message: err.message });
  }
});

// Fallback Route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 เซิร์ฟเวอร์ระบบประเมินผลงานโครงงาน ทำงานที่พอร์ต: ${PORT}`);
  console.log(`👉 เปิดใช้งานได้ที่: http://localhost:${PORT}`);
  console.log(`📁 Service Account: ${serviceAccountEmail || 'None'}`);
  console.log(`=======================================================`);
});
