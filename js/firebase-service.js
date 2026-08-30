/**
 * Firebase Firestore Service สำหรับจัดเก็บและซิงค์ข้อมูลโครงงานแบบ Realtime
 * รองรับการเชื่อมต่อกับ Firebase Web SDK v9 / v10 ผ่าน CDN
 */

export class FirebaseService {
  constructor() {
    this.db = null;
    this.app = null;
    this.isInitialized = false;
    this.listeners = [];
  }

  /**
   * เริ่มต้นการทำงานของ Firebase ด้วย Config จากคุณครู
   */
  async init(config) {
    if (!config || !config.apiKey || !config.projectId) {
      this.isInitialized = false;
      this.db = null;
      return false;
    }

    try {
      // ตรวจสอบว่ามี Firebase App อยู่แล้วหรือไม่
      if (window.firebase) {
        if (window.firebase.apps && window.firebase.apps.length > 0) {
          this.app = window.firebase.apps[0];
        } else {
          this.app = window.firebase.initializeApp(config);
        }
        this.db = window.firebase.firestore();
        this.isInitialized = true;
        console.log("Firebase Firestore เชื่อมต่อสำเร็จสำหรับโปรเจกต์:", config.projectId);
        return true;
      } else {
        console.warn("Firebase SDK ยังไม่ได้โหลดในหน้าต่างเบราว์เซอร์");
        this.isInitialized = false;
        return false;
      }
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการเชื่อมต่อ Firebase:", error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * ดึงรายการโครงงานทั้งหมดจาก Firestore
   */
  async getAllProjects() {
    if (!this.isInitialized || !this.db) return null;
    try {
      const snapshot = await this.db.collection("projects").get();
      const projects = [];
      snapshot.forEach(doc => {
        projects.push({ id: doc.id, ...doc.data() });
      });
      return projects;
    } catch (e) {
      console.error("Firestore get error:", e);
      return null;
    }
  }

  /**
   * บันทึกหรืออัปเดตโครงงาน
   */
  async saveProject(project) {
    if (!this.isInitialized || !this.db) return null;
    try {
      const docRef = this.db.collection("projects").doc(project.id);
      await docRef.set(project, { merge: true });
      return true;
    } catch (e) {
      console.error("Firestore save error:", e);
      return false;
    }
  }

  /**
   * ลบโครงงาน
   */
  async deleteProject(projectId) {
    if (!this.isInitialized || !this.db) return null;
    try {
      await this.db.collection("projects").doc(projectId).delete();
      return true;
    } catch (e) {
      console.error("Firestore delete error:", e);
      return false;
    }
  }

  /**
   * บันทึกการตั้งค่าระบบ (เช่น เปิด-ปิดคะแนน, URL Apps Script)
   */
  async saveSettings(settings) {
    if (!this.isInitialized || !this.db) return null;
    try {
      await this.db.collection("system").doc("settings").set(settings, { merge: true });
      return true;
    } catch (e) {
      console.error("Firestore saveSettings error:", e);
      return false;
    }
  }

  /**
   * ดึงการตั้งค่าระบบจาก Firestore
   */
  async getSettings() {
    if (!this.isInitialized || !this.db) return null;
    try {
      const doc = await this.db.collection("system").doc("settings").get();
      if (doc.exists) {
        return doc.data();
      }
      return null;
    } catch (e) {
      console.error("Firestore getSettings error:", e);
      return null;
    }
  }

  /**
   * ฟังการเปลี่ยนแปลงข้อมูลแบบ Realtime
   */
  subscribeProjects(callback) {
    if (!this.isInitialized || !this.db) return () => {};
    const unsubscribe = this.db.collection("projects").onSnapshot(snapshot => {
      const projects = [];
      snapshot.forEach(doc => {
        projects.push({ id: doc.id, ...doc.data() });
      });
      callback(projects);
    }, error => {
      console.error("Firestore snapshot error:", error);
    });
    return unsubscribe;
  }
}
