/**
 * Store: Data layer จัดการข้อมูลโครงงาน คะแนน และการตั้งค่าระบบ
 * ทำงานร่วมกับ LocalStorage และ Firebase Firestore
 */

const STORAGE_KEYS = {
  PROJECTS: "project_eval_projects_v2",
  SETTINGS: "project_eval_settings_v2",
  AUTH: "project_eval_teacher_auth_v2"
};

const DEFAULT_SETTINGS = {
  schoolName: "โรงเรียนตัวอย่างวิทยาคม",
  academicYear: "2569",
  semester: "1",
  subjectName: "ออกแบบและวิทยาการคำนวณ 4 (ว30113)",
  scoreboardEnabled: false, // ปิดการแสดงผลคะแนนในหน้านักเรียนเป็นค่าเริ่มต้น (จนกว่าครูจะเปิดสวิตช์)
  adminEmails: ["peelaphat@psuwit.ac.th", "peelapatkaewkong@gmail.com"], // อีเมลที่ได้รับอนุญาตเข้าถึงระบบผู้ดูแลระบบ
  firebaseConfig: {
    apiKey: "AIzaSyBiMR94Ys76e7QrZPlzsyngsf3FoViZi0g",
    authDomain: "project-5358a.firebaseapp.com",
    projectId: "project-5358a",
    storageBucket: "project-5358a.firebasestorage.app",
    messagingSenderId: "321138149600",
    appId: "1:321138149600:web:6a34392a076ae176762885"
  }
};

// ข้อมูลตัวอย่างเริ่มต้น (เคลียร์เป็นค่าว่างสำหรับใช้งานจริง)
const SAMPLE_PROJECTS = [];

export class AppStore {
  constructor(firebaseService) {
    this.firebase = firebaseService;
    this.projects = [];
    this.settings = { ...DEFAULT_SETTINGS };
    this.isTeacherLoggedIn = false;
    this.listeners = [];

    this.init();
  }

  init() {
    // 1. โหลดการตั้งค่าจาก LocalStorage
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (savedSettings) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
        if (!this.settings.firebaseConfig) {
          this.settings.firebaseConfig = DEFAULT_SETTINGS.firebaseConfig;
        }
      }
    } catch (e) {
      console.warn("Load settings error", e);
    }

    // 2. โหลดโครงงานจาก LocalStorage และล้างข้อมูลตัวอย่างเดิมออกให้หมด
    try {
      const savedProjects = localStorage.getItem(STORAGE_KEYS.PROJECTS);
      if (savedProjects) {
        const parsed = JSON.parse(savedProjects);
        // ลบข้อมูลตัวอย่างเดิม (proj-101, proj-102, proj-103) ออกอย่างถาวร
        this.projects = parsed.filter(p => !['proj-101', 'proj-102', 'proj-103'].includes(p.id));
      } else {
        this.projects = [];
      }
      this.saveProjectsToLocal();
    } catch (e) {
      console.warn("Load projects error", e);
      this.projects = [];
    }

    this.teacherUserInfo = null;

    // 3. ตรวจสอบสถานะการล็อกอินของผู้ดูแลระบบ
    try {
      const authStr = sessionStorage.getItem(STORAGE_KEYS.AUTH);
      if (authStr) {
        const authData = JSON.parse(authStr);
        if (authData && authData.loggedIn && authData.email) {
          const allowed = (this.settings.adminEmails || ["peelaphat@psuwit.ac.th"]).map(e => e.trim().toLowerCase());
          if (allowed.includes(authData.email.trim().toLowerCase())) {
            this.isTeacherLoggedIn = true;
            this.teacherUserInfo = authData.user || { email: authData.email };
          }
        }
      }
    } catch (e) {}

    // 4. เชื่อมต่อ Firebase หากมี Config
    if (this.settings.firebaseConfig) {
      this.firebase.init(this.settings.firebaseConfig).then(connected => {
        if (connected) {
          this.syncWithFirebase();
        }
      });
    }
  }

  async syncWithFirebase() {
    if (!this.firebase.isInitialized) return;
    try {
      // ดึงการตั้งค่า
      const remoteSettings = await this.firebase.getSettings();
      if (remoteSettings) {
        this.settings = { ...this.settings, ...remoteSettings };
        this.saveSettingsToLocal();
      }

      // ดึงโครงงาน
      const remoteProjects = await this.firebase.getAllProjects();
      if (remoteProjects && remoteProjects.length > 0) {
        this.projects = remoteProjects;
        this.saveProjectsToLocal();
        this.notify();
      }

      // ฟัง Realtime Updates
      this.firebase.subscribeProjects(updatedProjects => {
        if (updatedProjects) {
          this.projects = updatedProjects;
          this.saveProjectsToLocal();
          this.notify();
        }
      });
    } catch (e) {
      console.error("Sync with Firebase error:", e);
    }
  }

  saveProjectsToLocal() {
    try {
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(this.projects));
    } catch (e) {
      console.error("Save projects to localStorage error:", e);
    }
  }

  saveSettingsToLocal() {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (e) {
      console.error("Save settings to localStorage error:", e);
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => fn({ projects: this.projects, settings: this.settings }));
  }

  // ===================== CRUD โครงงาน =====================

  getProjects() {
    return [...this.projects];
  }

  getProjectById(id) {
    return this.projects.find(p => p.id === id) || null;
  }

  async saveProject(projectData) {
    const isNew = !projectData.id;
    const project = {
      ...projectData,
      id: isNew ? `proj-${Date.now()}` : projectData.id,
      passcode: projectData.passcode || Math.floor(1000 + Math.random() * 9000).toString(),
      updatedAt: new Date().toISOString(),
      createdAt: projectData.createdAt || new Date().toISOString(),
      status: projectData.evaluation ? "evaluated" : (projectData.status || "pending")
    };

    if (isNew) {
      this.projects.unshift(project);
    } else {
      const idx = this.projects.findIndex(p => p.id === project.id);
      if (idx !== -1) {
        this.projects[idx] = project;
      } else {
        this.projects.unshift(project);
      }
    }

    this.saveProjectsToLocal();
    if (this.firebase.isInitialized) {
      await this.firebase.saveProject(project);
    }

    this.notify();
    return project;
  }

  async deleteProject(id) {
    this.projects = this.projects.filter(p => p.id !== id);
    this.saveProjectsToLocal();
    if (this.firebase.isInitialized) {
      await this.firebase.deleteProject(id);
    }
    this.notify();
    return true;
  }

  async evaluateProject(projectId, evaluationData) {
    const project = this.getProjectById(projectId);
    if (!project) throw new Error("ไม่พบโครงงานที่ต้องการประเมิน");

    project.evaluation = {
      ...evaluationData,
      evaluatedAt: new Date().toISOString()
    };
    project.status = "evaluated";
    project.updatedAt = new Date().toISOString();

    return await this.saveProject(project);
  }

  // ===================== จัดการการตั้งค่า & สิทธิ์ =====================

  getSettings() {
    return { ...this.settings };
  }

  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettingsToLocal();
    if (this.firebase.isInitialized) {
      await this.firebase.saveSettings(this.settings);
    }
    this.notify();
    return this.settings;
  }

  async toggleScoreboard(enabled) {
    return await this.updateSettings({ scoreboardEnabled: Boolean(enabled) });
  }

  isEmailAllowed(email) {
    if (!email) return false;
    const clean = email.trim().toLowerCase();
    const allowed = (this.settings.adminEmails || ["peelaphat@psuwit.ac.th", "peelapatkaewkong@gmail.com"])
      .map(e => e.trim().toLowerCase());
    const isDomainMatch = clean.endsWith("@psuwit.ac.th");
    return isDomainMatch || allowed.includes(clean);
  }

  loginTeacherWithGoogle(userInfo) {
    if (!userInfo || !userInfo.email) return false;
    if (this.isEmailAllowed(userInfo.email)) {
      this.isTeacherLoggedIn = true;
      this.teacherUserInfo = userInfo;
      try {
        sessionStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify({
          loggedIn: true,
          email: userInfo.email,
          user: userInfo,
          loginAt: Date.now()
        }));
      } catch (e) {}
      this.notify();
      return true;
    }
    return false;
  }

  logoutTeacher() {
    this.isTeacherLoggedIn = false;
    this.teacherUserInfo = null;
    try {
      sessionStorage.removeItem(STORAGE_KEYS.AUTH);
    } catch (e) {}
    this.notify();
  }

  verifyProjectPasscode(projectId, passcode) {
    const project = this.getProjectById(projectId);
    if (!project) return false;
    return project.passcode === String(passcode).trim();
  }

  clearAllProjects() {
    this.projects = [];
    this.saveProjectsToLocal();
    this.notify();
  }

  resetToDefaultData() {
    this.clearAllProjects();
  }
}
