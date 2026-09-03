---
name: project-architecture
description: อธิบายสถาปัตยกรรม เทคโนโลยี กฎเกณฑ์ และข้อควรระวังในการพัฒนาโค้ดของ Project Evaluation Platform
---

# Project Evaluation Platform - Architecture & Guidelines

ทักษะ (Skill) นี้มีไว้เพื่อให้ AI Agent เข้าใจโครงสร้างและข้อจำกัดของโปรเจกต์ **ระบบประเมินคะแนนโครงงาน** ในการพัฒนาต่อยอดในอนาคต

## 🏗️ 1. สถาปัตยกรรมระบบ (System Architecture)
- **ประเภทโปรเจกต์**: Serverless Single Page Application (SPA)
- **Deployment**: ทำงานบน GitHub Pages (ฝั่ง Frontend ล้วน) ไม่มี Node.js Backend หรือ Server ประมวลผล
- **Database**: ใช้ **Firebase Firestore** ในการเก็บข้อมูลรายชื่อโครงงาน, การประเมิน, คะแนน และการตั้งค่าของระบบ (มี Real-time Sync)
- **Storage**: ใช้ **Google Drive API (Client-side)** ในการอัปโหลดไฟล์ (เล่มโครงงาน, สไลด์, รูปประจำตัว) โดยใช้ OAuth Token ของคุณครูที่ล็อกอิน
- **Authentication**: 
  - นักเรียน: ไม่ต้องล็อกอิน
  - ครู: ใช้ Google Identity Services (GIS) ตรวจสอบโดเมน (เช่น `@psuwit.ac.th`)

## 🛠️ 2. กฎการเขียนโค้ด (Coding Rules)

### กฎข้อที่ 1: ห้ามสร้างระบบที่ต้องพึ่งพา Backend Node.js
เนื่องจากระบบถูกนำไป Deploy บน GitHub Pages ซึ่งรันได้เฉพาะ HTML/CSS/JS (Static) 
- ❌ **ห้าม**: เพิ่มฟีเจอร์ที่ต้องรันผ่าน `/api/...` บน `server.js` 
- ✅ **ต้องทำ**: ทุกฟีเจอร์ที่เกี่ยวกับ Data ต้องยิงตรงไปที่ Firebase (ผ่าน `firebase-service.js`) หรือบริการภายนอกผ่าน REST API ตรงจาก Client เสมอ

### กฎข้อที่ 2: การอัปโหลดไฟล์เข้า Google Drive
- ❌ **ห้าม**: อัปโหลดไฟล์ด้วย Base64 ตรงๆ เพราะ Google Drive API v3 จะเกิดปัญหาไฟล์เสียหรือ Reject
- ✅ **ต้องทำ**: อัปโหลดไฟล์แบบ **Binary Blob Multipart/Related** โดยแยก Part Metadata (JSON) และ Part Data (Blob/File) อย่างชัดเจน
- ✅ **การตรวจสอบ Token**: ต้องเช็ค Expiry ของ OAuth Token เสมอผ่าน `getActiveToken()` ใน `gdrive-service.js` ก่อนอัปโหลด เพราะ Token มีอายุแค่ 1 ชม. หาก Token หมดอายุ ต้อง throw Error ให้ชัดเจนเพื่อให้นักเรียนไปแจ้งครูให้ล็อกอินใหม่

### กฎข้อที่ 3: ระบบแสดงผลคะแนน (Score Visibility)
- สถานะคะแนนของนักเรียนถูกควบคุมโดยตัวแปร `scoreboardEnabled` ใน `store.settings`
- หากค่านี้เป็น `false` ห้ามแสดงคะแนน (Rubric, Total Score, Rank) ให้นักเรียนเห็นโดยเด็ดขาด 
- ต้องตรวจสอบสถานะการเข้าสู่ระบบของคุณครูควบคู่ด้วยเสมอ (ครูมองเห็นได้ตลอด)

## 📁 3. โครงสร้างไฟล์ที่สำคัญ
- `js/app.js`: Controller หลักคอยจัดการ UI View และ Event Listeners ต่างๆ
- `js/store.js`: State Management กลางของแอพ คอยคุยกับ LocalStorage และ Firebase
- `js/firebase-service.js`: จัดการ Firebase SDK, Read/Write Data และ Real-time Sync
- `js/gdrive-service.js`: จัดการ Google Identity Services (Login) และ Google Drive API v3 Upload
- `css/responsive.css`: จัดการ Responsive Layout ให้แสดงผลได้ดีบนมือถือ

## 💡 4. การทดสอบและการเข้าใช้งาน
- หากมีการเปลี่ยนแปลงใดๆ ให้เน้นการทดสอบผ่าน Web Browser โดยเปิดไฟล์ `index.html` หรือรันผ่าน Live Server ก็ได้
- ฐานข้อมูล Firestore อาจถูกล็อกได้ (Permission Denied) หากหมดอายุช่วง Test Mode (30 วัน) หากนักเรียนส่งงานแล้วไม่ซิงค์ข้ามเครื่อง ให้แนะนำ User ให้เช็คแท็บ "Rules" ใน Firebase Console
