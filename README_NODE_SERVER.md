# 🚀 คู่มือการใช้งาน Node.js Express Backend Server & Google Drive Service Account

ระบบประเมินผลงานโครงงาน รายวิชา **ออกแบบและวิทยาการคำนวณ 4 (ว30113)** รองรับการทำงานแบบ Fullstack ด้วย Node.js + Express + Multer + Googleapis

---

## 📁 โครงสร้างระบบ Backend (`server.js`)

- **เซิร์ฟเวอร์**: Node.js & Express (Port: `3000`)
- **การรับไฟล์**: `multer` (รับไฟล์ผ่าน `multipart/form-data` สูงสุด 50MB)
- **การเชื่อมต่อ**: Google Drive REST API v3 ผ่าน Service Account (`project-evaluation-platform-93974edeed12.json`)
- **อีเมล Service Account**: 
  ```text
  project-evaluation@project-evaluation-platform.iam.gserviceaccount.com
  ```

---

## ⚙️ ขั้นตอนการตั้งค่า Google Drive ให้กับ Service Account (ครั้งแรกเท่านั้น)

เนื่องจาก Google กำหนดให้ Service Account ไม่มีพื้นที่ความจุส่วนตัวโดยตรง แต่จะสามารถอัปโหลดได้ไม่จำกัดเมื่ออัปโหลดลงใน **"โฟลเดอร์ของครูที่แชร์ให้"** หรือ **"Google Shared Drive"**

### ขั้นตอน:
1. เปิด **Google Drive** ของคุณครู (https://drive.google.com)
2. สร้างโฟลเดอร์ใหม่ เช่น ตั้งชื่อว่า **`ระบบประเมินโครงงาน_ผลงานนักเรียน`**
3. คลิกขวาที่โฟลเดอร์นั้น ➡️ เลือก **แชร์ (Share)**
4. ในช่องใส่อีเมล ให้ใส่อีเมล Service Account:
   ```text
   project-evaluation@project-evaluation-platform.iam.gserviceaccount.com
   ```
5. กำหนดสิทธิ์เป็น **"ผู้แก้ไข (Editor)"** ➡️ กดส่ง (Share)
6. คัดลอก **Folder ID** จาก URL ของโฟลเดอร์:
   - ตัวอย่าง URL: `https://drive.google.com/drive/folders/1A2B3C4D5E6F7G8H9I0J`
   - Folder ID คือ: `1A2B3C4D5E6F7G8H9I0J`
7. นำ Folder ID ไปใส่ในไฟล์ `.env`:
   ```env
   PORT=3000
   GOOGLE_DRIVE_FOLDER_ID=1A2B3C4D5E6F7G8H9I0J
   ```

---

## 🏃 วิธีการสั่งรันระบบ

### 1. ติดตั้ง Dependencies (ถ้ายังไม่ได้ติดตั้ง):
```bash
npm install
```

### 2. เริ่มต้นเซิร์ฟเวอร์:
```bash
npm start
```
หรือ
```bash
node server.js
```

### 3. เปิดใช้งานผ่านเบราว์เซอร์:
👉 เข้าสู่ระบบได้ที่: **`http://localhost:3000`**

---

## 🌟 ฟังก์ชันการจัดเก็บไฟล์อัตโนมัติ

เมื่อมีการส่งผลงานผ่านหน้าเว็บ ระบบจะแยกโฟลเดอร์ย่อย 3 โฟลเดอร์ให้อัตโนมัติ:
1. `📁 เล่มรายงานโครงงาน` ➡️ `เล่มรายงาน_{ชื่อโครงงาน}_{วันที่และเวลาส่ง}.pdf`
2. `📁 สื่อนำเสนอโครงงาน` ➡️ `สื่อนำเสนอ_{ชื่อโครงงาน}_{วันที่และเวลาส่ง}.pptx`
3. `📁 รูปภาพสมาชิกและโครงงาน` ➡️ `รูปประจำตัว_{ชื่อโครงงาน}_{ชื่อสมาชิก}_{รหัสนักเรียน}.jpg`

พร้อมกำหนดสิทธิ์เข้าถึงไฟล์ให้อัตโนมัติ (`anyoneWithLink: reader`) เพื่อให้สามารถคลิกเปิดดูไฟล์เล่มรายงานและสไลด์นำเสนอในระบบได้ทันที
