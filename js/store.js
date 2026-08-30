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
  scoreboardEnabled: false, // เริ่มต้นซ่อนคะแนนไว้ (อยู่ในระหว่างการพิจารณา)
  teacherPassword: "admin", // รหัสผ่านตั้งต้นสำหรับผู้ดูแลระบบ
  firebaseConfig: {
    apiKey: "AIzaSyBiMR94Ys76e7QrZPlzsyngsf3FoViZi0g",
    authDomain: "project-5358a.firebaseapp.com",
    projectId: "project-5358a",
    storageBucket: "project-5358a.firebasestorage.app",
    messagingSenderId: "321138149600",
    appId: "1:321138149600:web:6a34392a076ae176762885"
  }
};

// ข้อมูลตัวอย่างเริ่มต้น (Sample Data) เพื่อให้เห็นการทำงานทันที
const SAMPLE_PROJECTS = [
  {
    id: "proj-101",
    passcode: "1234",
    title: "ระบบรดน้ำพืชอัจฉริยะด้วย IoT และพลังงานแสงอาทิตย์",
    titleEn: "Smart IoT Plant Irrigation System with Solar Power",
    type: "invention", // invention หรือ software
    description: "ระบบควบคุมการจ่ายน้ำสำหรับแปลงเกษตรโรงเรียนอัตโนมัติ โดยตรวจวัดความชื้นในดินและพยากรณ์อากาศผ่านเซนเซอร์ เพื่อประหยัดน้ำและพลังงาน",
    gradeLevel: "ม.5",
    classroom: "ม.5/1",
    demoUrl: "https://youtu.be/sample-demo",
    githubUrl: "https://github.com/sample/smart-farm",
    createdAt: "2026-08-28T09:30:00.000Z",
    updatedAt: "2026-08-29T14:20:00.000Z",
    status: "evaluated", // pending, evaluated
    reportFile: {
      fileName: "เล่มรายงาน_ระบบรดน้ำพืชอัจฉริยะด้วย IoT_2026-08-28_09-30.pdf",
      folderName: "เล่มรายงานโครงงาน",
      viewUrl: "https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      sizeText: "2.4 MB"
    },
    slideFile: {
      fileName: "สื่อนำเสนอ_ระบบรดน้ำพืชอัจฉริยะด้วย IoT_2026-08-28_09-30.pdf",
      folderName: "สื่อนำเสนอโครงงาน",
      viewUrl: "https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      sizeText: "5.1 MB"
    },
    members: [
      {
        id: "m1",
        title: "นาย",
        fullName: "ภูมิพัฒน์ รักการเรียน",
        studentId: "45001",
        grade: "ม.5",
        room: "1",
        number: "1",
        role: "หัวหน้าโครงงาน / วงจรอิเล็กทรอนิกส์",
        photoUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=300&q=80"
      },
      {
        id: "m2",
        title: "นางสาว",
        fullName: "กัญญารัตน์ ใจดี",
        studentId: "45002",
        grade: "ม.5",
        room: "1",
        number: "2",
        role: "ผู้พัฒนาซอฟต์แวร์ Dashboard",
        photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80"
      },
      {
        id: "m3",
        title: "นาย",
        fullName: "ชัชวาลย์ มั่นคง",
        studentId: "45003",
        grade: "ม.5",
        room: "1",
        number: "3",
        role: "ออกแบบโครงสร้างและกล่องกันน้ำ",
        photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80"
      }
    ],
    evaluation: {
      evaluatedAt: "2026-08-29T16:00:00.000Z",
      evaluatorName: "ครูผู้สอน",
      scores: {
        product_tech: 4,
        impact_problem: 4,
        project_report: 3,
        presentation_qa: 4,
        teamwork_responsibility: 4
      },
      bonusScore: 1, // Bonus Resilience
      totalScore: 20, // 19 + 1 = 20 (Max 20 + bonus)
      feedback: "ผลงานยอดเยี่ยมมาก นวัตกรรมใช้งานได้จริงในการทดลองภาคสนาม การตอบคำถามชัดเจนดี ขอให้เพิ่มสถิติการประหยัดน้ำลงในบทที่ 4 ให้สมบูรณ์ยิ่งขึ้น",
      gradeBadge: "ดีเยี่ยม (A)"
    }
  },
  {
    id: "proj-102",
    passcode: "5678",
    title: "แอปพลิเคชันคัดแยกขยะรีไซเคิลด้วย AI และสะสมแต้มแลกรางวัล",
    titleEn: "Smart AI Waste Sorting & Reward Platform (RecycleHero)",
    type: "software",
    description: "แพลตฟอร์มบนมือถือที่ช่วยให้ผู้ใช้สแกนขยะเพื่อระบุประเภทขยะด้วย Machine Learning พร้อมระบบ Gamification สะสมเหรียญแลกของรางวัลในโรงเรียน",
    gradeLevel: "ม.5",
    classroom: "ม.5/2",
    demoUrl: "https://recyclehero-demo.web.app",
    githubUrl: "https://github.com/sample/recycle-hero",
    createdAt: "2026-08-28T11:15:00.000Z",
    updatedAt: "2026-08-28T11:15:00.000Z",
    status: "evaluated",
    reportFile: {
      fileName: "เล่มรายงาน_แอปพลิเคชันคัดแยกขยะรีไซเคิลด้วย AI_2026-08-28_11-15.pdf",
      folderName: "เล่มรายงานโครงงาน",
      viewUrl: "https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      sizeText: "3.8 MB"
    },
    slideFile: {
      fileName: "สื่อนำเสนอ_แอปพลิเคชันคัดแยกขยะรีไซเคิลด้วย AI_2026-08-28_11-15.pdf",
      folderName: "สื่อนำเสนอโครงงาน",
      viewUrl: "https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      sizeText: "8.2 MB"
    },
    members: [
      {
        id: "m4",
        title: "นางสาว",
        fullName: "ณิชารีย์ สว่างวงศ์",
        studentId: "45015",
        grade: "ม.5",
        room: "2",
        number: "5",
        role: "หัวหน้าทีม / UI UX Designer",
        photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"
      },
      {
        id: "m5",
        title: "นาย",
        fullName: "ธนกฤต วิเศษศิลป์",
        studentId: "45016",
        grade: "ม.5",
        room: "2",
        number: "6",
        role: "AI Model & Fullstack Developer",
        photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80"
      }
    ],
    evaluation: {
      evaluatedAt: "2026-08-29T16:30:00.000Z",
      evaluatorName: "ครูผู้สอน",
      scores: {
        product_tech: 4,
        impact_problem: 3,
        project_report: 4,
        presentation_qa: 3,
        teamwork_responsibility: 4
      },
      bonusScore: 0,
      totalScore: 18,
      feedback: "UI/UX ออกแบบได้สวยงาม ใช้งานง่ายมาก ตรวจจับขยะได้แม่นยำ แนะนำให้เพิ่มกรณีศึกษาการเชื่อมต่อกับร้านค้าสหกรณ์โรงเรียนจริงเพื่อขยายผล",
      gradeBadge: "ดีเยี่ยม (A)"
    }
  },
  {
    id: "proj-103",
    passcode: "9999",
    title: "เครื่องเตือนความจำกินยาอัตโนมัติสำหรับผู้สูงอายุ",
    titleEn: "Automatic Smart Medicine Reminder Box for Elderly",
    type: "invention",
    description: "กล่องจ่ายยาอัตโนมัติพร้อมแจ้งเตือนผ่านเสียงและส่งข้อความแจ้งเตือนทาง LINE ให้ผู้ดูแลเมื่อถึงเวลาหรือหากผู้สูงอายุลืมเปิดทานยา",
    gradeLevel: "ม.5",
    classroom: "ม.5/1",
    demoUrl: "",
    githubUrl: "",
    createdAt: "2026-08-29T10:00:00.000Z",
    updatedAt: "2026-08-29T10:00:00.000Z",
    status: "pending", // ยังไม่ประเมิน
    reportFile: {
      fileName: "เล่มรายงาน_เครื่องเตือนความจำกินยาอัตโนมัติ_2026-08-29_10-00.pdf",
      folderName: "เล่มรายงานโครงงาน",
      viewUrl: "https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      sizeText: "1.9 MB"
    },
    slideFile: {
      fileName: "สื่อนำเสนอ_เครื่องเตือนความจำกินยาอัตโนมัติ_2026-08-29_10-00.pdf",
      folderName: "สื่อนำเสนอโครงงาน",
      viewUrl: "https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      sizeText: "4.5 MB"
    },
    members: [
      {
        id: "m6",
        title: "นาย",
        fullName: "กิตติศักดิ์ พรหมดี",
        studentId: "45008",
        grade: "ม.5",
        room: "1",
        number: "8",
        role: "วิจัยและประกอบฮาร์ดแวร์",
        photoUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=300&q=80"
      },
      {
        id: "m7",
        title: "นางสาว",
        fullName: "ปิยะธิดา รัตนโชติ",
        studentId: "45009",
        grade: "ม.5",
        room: "1",
        number: "9",
        role: "เขียนโปรแกรม LINE Notify และรายงาน",
        photoUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80"
      }
    ],
    evaluation: null
  }
];

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

    // 2. โหลดโครงงานจาก LocalStorage
    try {
      const savedProjects = localStorage.getItem(STORAGE_KEYS.PROJECTS);
      if (savedProjects) {
        this.projects = JSON.parse(savedProjects);
      } else {
        // ใช้ Sample Data ในครั้งแรก
        this.projects = [...SAMPLE_PROJECTS];
        this.saveProjectsToLocal();
      }
    } catch (e) {
      console.warn("Load projects error", e);
      this.projects = [...SAMPLE_PROJECTS];
    }

    // 3. ตรวจสอบสถานะการล็อกอินของครู
    try {
      const isAuth = sessionStorage.getItem(STORAGE_KEYS.AUTH);
      if (isAuth === "true") {
        this.isTeacherLoggedIn = true;
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

  loginTeacher(password) {
    if (password === this.settings.teacherPassword) {
      this.isTeacherLoggedIn = true;
      try {
        sessionStorage.setItem(STORAGE_KEYS.AUTH, "true");
      } catch (e) {}
      this.notify();
      return true;
    }
    return false;
  }

  logoutTeacher() {
    this.isTeacherLoggedIn = false;
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

  resetToDefaultData() {
    this.projects = [...SAMPLE_PROJECTS];
    this.saveProjectsToLocal();
    this.notify();
  }
}
