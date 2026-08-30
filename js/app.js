/**
 * Main Application Orchestrator: จัดการมุมมอง (Views), Routing, Modals, และ Events ทั่วทั้งระบบ
 */

import { FirebaseService } from "./firebase-service.js";
import { AppStore } from "./store.js";
import { GoogleDriveService } from "./gdrive-service.js";
import { StudentController } from "./student.js";
import { ScoreboardController } from "./scoreboard.js";
import { TeacherController } from "./teacher.js";
import { Popup } from "./popup-util.js";
import { RUBRIC_CATEGORIES } from "./rubric-data.js";

class App {
  constructor() {
    this.firebaseService = new FirebaseService();
    this.store = new AppStore(this.firebaseService);
    this.gdriveService = new GoogleDriveService(
      () => this.store.getSettings(),
      (newSettings) => this.store.updateSettings(newSettings)
    );

    this.currentView = "showcase"; // showcase, submit, scoreboard, teacher
    this.studentController = null;
    this.scoreboardController = null;
    this.teacherController = null;
    this.radarChartInstance = null;

    this.init();
  }

  init() {
    this.initControllers();
    this.bindGlobalEvents();
    this.renderShowcase();
    this.updateHeader();

    // ฟังการเปลี่ยนแปลงข้อมูลใน Store เพื่อ re-render อัตโนมัติ
    this.store.subscribe(({ projects, settings }) => {
      this.updateHeader();
      if (this.currentView === "showcase") this.renderShowcase();
      if (this.currentView === "scoreboard") this.scoreboardController?.render();
      if (this.currentView === "teacher") this.teacherController?.render();
    });
  }

  initControllers() {
    this.studentController = new StudentController({
      store: this.store,
      gdriveService: this.gdriveService,
      showToast: (msg, type) => this.showToast(msg, type),
      navigateTo: (view) => this.switchView(view)
    });

    this.scoreboardController = new ScoreboardController({
      store: this.store,
      showToast: (msg, type) => this.showToast(msg, type),
      openProjectDetail: (id) => this.openProjectDetailModal(id)
    });

    this.teacherController = new TeacherController({
      store: this.store,
      gdriveService: this.gdriveService,
      showToast: (msg, type) => this.showToast(msg, type),
      openProjectDetail: (id) => this.openProjectDetailModal(id)
    });
  }

  bindGlobalEvents() {
    // Navigation Tabs
    const navLinks = document.querySelectorAll(".nav-link[data-view]");
    navLinks.forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const targetView = link.dataset.view;
        this.switchView(targetView);
      });
    });

    // ปุ่มแก้ไขโครงงานด้วย Passcode
    const btnEditWithPasscode = document.getElementById("btn-edit-with-passcode");
    if (btnEditWithPasscode) {
      btnEditWithPasscode.addEventListener("click", () => this.openPasscodeModal());
    }

    // Hero CTA Buttons
    document.querySelectorAll("[data-navigate]").forEach(btn => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.navigate;
        if (view) this.switchView(view);
      });
    });

    // Showcase Search & Filter
    const showcaseSearch = document.getElementById("showcase-search");
    const showcaseClass = document.getElementById("showcase-filter-class");
    const showcaseType = document.getElementById("showcase-filter-type");

    if (showcaseSearch) showcaseSearch.addEventListener("input", () => this.renderShowcase());
    if (showcaseClass) showcaseClass.addEventListener("change", () => this.renderShowcase());
    if (showcaseType) showcaseType.addEventListener("change", () => this.renderShowcase());
  }

  switchView(viewName) {
    this.currentView = viewName;

    // ซ่อนทุกหน้า
    document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
    
    // แสดงหน้าที่เลือก
    const targetSec = document.getElementById(`view-${viewName}`);
    if (targetSec) targetSec.classList.add("active");

    // อัปเดต Active Nav Link
    document.querySelectorAll(".nav-link").forEach(link => {
      if (link.dataset.view === viewName) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    // Scroll ขึ้นด้านบน
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Refresh มุมมองตามหน้าที่เปิด
    if (viewName === "showcase") this.renderShowcase();
    if (viewName === "scoreboard") this.scoreboardController?.render();
    if (viewName === "teacher") this.teacherController?.render();
  }

  updateHeader() {
    const settings = this.store.getSettings();
    const subTitleEls = document.querySelectorAll(".app-subject-title");
    subTitleEls.forEach(el => {
      el.textContent = settings.subjectName || "โครงงานนวัตกรรม";
    });
  }

  // ===================== SHOWCASE VIEW =====================

  renderShowcase() {
    const container = document.getElementById("showcase-cards-container");
    if (!container) return;

    const projects = this.store.getProjects();
    const searchVal = document.getElementById("showcase-search")?.value.toLowerCase().trim() || "";
    const classVal = document.getElementById("showcase-filter-class")?.value || "all";
    const typeVal = document.getElementById("showcase-filter-type")?.value || "all";

    // อัปเดต Class Options
    const classFilter = document.getElementById("showcase-filter-class");
    if (classFilter && classFilter.children.length <= 1) {
      const classes = Array.from(new Set(projects.map(p => p.classroom).filter(Boolean))).sort();
      classes.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        classFilter.appendChild(opt);
      });
    }

    const filtered = projects.filter(p => {
      const matchClass = classVal === "all" || p.classroom === classVal;
      const matchType = typeVal === "all" || p.type === typeVal;
      let matchSearch = true;
      if (searchVal) {
        matchSearch = (p.title || "").toLowerCase().includes(searchVal) ||
          (p.titleEn || "").toLowerCase().includes(searchVal) ||
          (p.description || "").toLowerCase().includes(searchVal) ||
          (p.members || []).some(m => (m.fullName || "").toLowerCase().includes(searchVal));
      }
      return matchClass && matchType && matchSearch;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5 text-muted">
          <i class="fas fa-search fa-3x mb-3 text-secondary"></i>
          <h4>ไม่พบโครงงานที่ค้นหา</h4>
          <p>ลองเปลี่ยนคำค้นหาหรือตัวกรองห้องเรียน</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(p => {
      const typeBadge = p.type === "invention"
        ? `<span class="badge badge-primary"><i class="fas fa-microchip"></i> สิ่งประดิษฐ์</span>`
        : `<span class="badge badge-success"><i class="fas fa-laptop-code"></i> แพลตฟอร์ม</span>`;

      const isGraded = p.status === "evaluated" && p.evaluation;
      const isScoreboardOpen = this.store.getSettings().scoreboardEnabled;

      let statusBadge = `<span class="badge badge-warning"><i class="fas fa-hourglass-half"></i> อยู่ในระหว่างการพิจารณา</span>`;
      if (isScoreboardOpen && isGraded) {
        statusBadge = `<span class="badge badge-success"><i class="fas fa-star"></i> ประเมินแล้ว (${p.evaluation.totalScore}/20)</span>`;
      }

      const first3Members = (p.members || []).slice(0, 3);

      return `
        <div class="col-lg-4 col-md-6 mb-4">
          <div class="project-showcase-card h-100" data-id="${p.id}">
            <div class="card-top-badges">
              ${typeBadge}
              <span class="badge badge-light">${p.classroom || p.gradeLevel}</span>
            </div>

            <h4 class="showcase-title">${this.escapeHtml(p.title)}</h4>
            ${p.titleEn ? `<div class="showcase-title-en text-xs text-muted mb-2">${this.escapeHtml(p.titleEn)}</div>` : ''}

            <p class="showcase-desc text-sm text-muted">${this.escapeHtml(p.description || 'ไม่มีคำอธิบายย่อ')}</p>

            <div class="showcase-members-row">
              <div class="avatar-stack">
                ${first3Members.map(m => `
                  <div class="avatar-stack-item clickable-avatar" data-photo="${m.photoUrl || ''}" data-name="${this.escapeHtml(m.title || '')}${this.escapeHtml(m.fullName)}" data-id="${m.studentId || ''}" title="คลิกดูรูป: ${m.title || ''}${m.fullName}">
                    <img src="${m.photoUrl || 'assets/avatar-placeholder.svg'}" alt="${m.fullName}">
                  </div>
                `).join("")}
              </div>
              <div class="text-xs text-muted">
                ${(p.members || []).length} สมาชิก
              </div>
            </div>

            <div class="card-footer-bar">
              <div>${statusBadge}</div>
              <button type="button" class="btn btn-sm btn-outline-primary btn-view-proj" data-id="${p.id}">
                ดูรายละเอียด <i class="fas fa-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".project-showcase-card, .btn-view-proj").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = el.dataset.id || el.closest(".project-showcase-card")?.dataset.id;
        if (id) this.openProjectDetailModal(id);
      });
    });

    container.querySelectorAll(".avatar-stack-item").forEach(item => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const photo = item.dataset.photo;
        const name = item.dataset.name;
        const id = item.dataset.id;
        if (photo) {
          Popup.imagePreview({
            imageUrl: photo,
            title: name || "รูปประจำตัว",
            subtitle: id ? `รหัสนักเรียน: ${id}` : ""
          });
        }
      });
    });
  }

  // ===================== FILE & MEDIA HELPERS =====================

  resolveFileUrl(fileObj) {
    if (!fileObj) return null;
    if (typeof fileObj === 'string') return fileObj;
    if (fileObj.viewUrl) return fileObj.viewUrl;
    if (fileObj.directViewUrl) return fileObj.directViewUrl;
    if (fileObj.previewUrl) return fileObj.previewUrl;
    if (fileObj.downloadUrl) return fileObj.downloadUrl;
    if (fileObj.fileId && !fileObj.fileId.startsWith('local_')) {
      return `https://drive.google.com/file/d/${fileObj.fileId}/view`;
    }
    return null;
  }

  openFile(fileObj, defaultName = 'file') {
    const url = this.resolveFileUrl(fileObj);
    if (!url) {
      Popup.alert({
        title: "ไม่พบไฟล์",
        message: "โครงงานนี้ยังไม่ได้แนบไฟล์ดังกล่าว หรือไฟล์ยังไม่พร้อมใช้งาน",
        type: "warning"
      });
      return;
    }

    if (url.startsWith('data:')) {
      try {
        const arr = url.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        const win = window.open(blobUrl, '_blank');
        if (!win) {
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = fileObj?.fileName || defaultName;
          a.click();
        }
      } catch (e) {
        window.open(url, '_blank');
      }
    } else {
      window.open(url, '_blank');
    }
  }

  // ===================== PROJECT DETAIL MODAL =====================

  openProjectDetailModal(projectId) {
    const project = this.store.getProjectById(projectId);
    if (!project) return;

    const settings = this.store.getSettings();
    const isTeacher = this.store.isTeacherLoggedIn;
    const canSeeScore = Boolean(project.evaluation && (settings.scoreboardEnabled !== false || isTeacher));
    const evalData = project.evaluation;

    let modal = document.getElementById("modal-project-detail");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modal-project-detail";
      modal.className = "modal-overlay";
      document.body.appendChild(modal);
    }

    const hasReport = Boolean(this.resolveFileUrl(project.reportFile));
    const hasSlide = Boolean(this.resolveFileUrl(project.slideFile));

    modal.innerHTML = `
      <div class="modal-box modal-lg animate-scale-up">
        <div class="modal-header">
          <div>
            <span class="badge ${project.type === 'invention' ? 'badge-primary' : 'badge-success'} mb-1">
              ${project.type === 'invention' ? 'สิ่งประดิษฐ์' : 'แพลตฟอร์ม/ซอฟต์แวร์'}
            </span>
            <h3 class="modal-title">${this.escapeHtml(project.title)}</h3>
            ${project.titleEn ? `<div class="text-sm text-muted">${this.escapeHtml(project.titleEn)}</div>` : ''}
          </div>
          <button type="button" class="btn-close-modal" id="btn-close-detail">&times;</button>
        </div>

        <div class="modal-body">
          <!-- ข้อมูลทั่วไป -->
          <div class="detail-section mb-4">
            <h5 class="section-heading"><i class="fas fa-info-circle text-primary"></i> ข้อมูลโครงงาน</h5>
            <p class="text-secondary">${this.escapeHtml(project.description || 'ไม่มีรายละเอียด')}</p>
            <div class="d-flex gap-2 flex-wrap mt-2">
              <span class="badge badge-light"><i class="fas fa-school"></i> ระดับชั้น/ห้อง: <b>${project.classroom || project.gradeLevel}</b></span>
              <span class="badge badge-light"><i class="fas fa-calendar-alt"></i> วันที่ส่ง: ${new Date(project.createdAt).toLocaleDateString('th-TH')}</span>
              ${project.demoUrl ? `<a href="${project.demoUrl}" target="_blank" class="badge badge-primary"><i class="fas fa-external-link-alt"></i> ลิงก์สาธิตผลงาน</a>` : ''}
              ${project.githubUrl ? `<a href="${project.githubUrl}" target="_blank" class="badge badge-dark"><i class="fab fa-github"></i> ซอร์สโค้ด / ลิงก์โครงการ</a>` : ''}
            </div>
          </div>

          <!-- สมาชิกในกลุ่มพร้อมรูปถ่าย (คลิกดูภาพขนาดใหญ่ได้) -->
          <div class="detail-section mb-4">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h5 class="section-heading mb-0"><i class="fas fa-users text-primary"></i> สมาชิกในกลุ่ม (${(project.members || []).length} คน)</h5>
              <span class="text-xs text-muted"><i class="fas fa-search-plus"></i> คลิกที่รูปเพื่อดูภาพขนาดใหญ่</span>
            </div>
            <div class="members-avatar-grid">
              ${(project.members || []).map((m, mIdx) => `
                <div class="member-profile-card clickable-member-card" data-member-idx="${mIdx}" title="คลิกเพื่อดูรูปภาพขนาดใหญ่">
                  <img src="${m.photoUrl || 'assets/avatar-placeholder.svg'}" class="member-avatar-lg clickable-avatar" alt="${m.fullName}">
                  <div class="member-name-text">${this.escapeHtml(m.title || '')}${this.escapeHtml(m.fullName)}</div>
                  <div class="member-sub-text">รหัส: ${m.studentId || '-'} | ห้อง: ${m.room || '-'} เลขที่: ${m.number || '-'}</div>
                  ${m.role ? `<div class="member-role-badge">${this.escapeHtml(m.role)}</div>` : ''}
                </div>
              `).join("")}
            </div>
          </div>

          <!-- ไฟล์เล่มรายงานและสื่อนำเสนอ (Google Drive) -->
          <div class="detail-section mb-4">
            <h5 class="section-heading"><i class="fab fa-google-drive text-success"></i> เอกสารและสื่อนำเสนอ (Google Drive)</h5>
            <div class="row g-2">
              <div class="col-sm-6">
                <div class="file-download-box">
                  <i class="fas fa-file-pdf fa-2x text-danger"></i>
                  <div class="file-box-info">
                    <div class="font-bold text-sm">เล่มรายงานโครงงาน</div>
                    <div class="text-xs text-muted">${project.reportFile ? (project.reportFile.fileName || 'ไฟล์เล่มรายงาน') : 'ยังไม่ได้แนบไฟล์'}</div>
                  </div>
                  <button type="button" class="btn btn-sm btn-outline-danger" id="btn-open-report">
                    <i class="fas fa-external-link-alt"></i> เปิดดูไฟล์
                  </button>
                </div>
              </div>

              <div class="col-sm-6">
                <div class="file-download-box">
                  <i class="fas fa-file-powerpoint fa-2x text-warning"></i>
                  <div class="file-box-info">
                    <div class="font-bold text-sm">สื่อนำเสนอโครงงาน</div>
                    <div class="text-xs text-muted">${project.slideFile ? (project.slideFile.fileName || 'ไฟล์สื่อนำเสนอ') : 'ยังไม่ได้แนบไฟล์'}</div>
                  </div>
                  <button type="button" class="btn btn-sm btn-outline-warning" id="btn-open-slide">
                    <i class="fas fa-external-link-alt"></i> เปิดดูสไลด์
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- ผลการประเมินและคะแนน (แสดงผลคะแนนในหน้านักเรียน) -->
          <div class="detail-section">
            <h5 class="section-heading"><i class="fas fa-award text-warning"></i> ผลการประเมินคะแนน (Rubric 20 คะแนน)</h5>
            ${canSeeScore ? `
              <div class="score-report-card">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <div class="text-xs text-muted">คะแนนรวมทั้งหมด</div>
                    <div class="score-display-huge">${evalData.totalScore} <span class="text-sm text-muted">/ 20</span></div>
                    ${evalData.bonusScore ? `<span class="badge badge-success mt-1">+${evalData.bonusScore} คะแนนพิเศษ (Bonus)</span>` : ''}
                  </div>
                  <div class="text-end">
                    <div class="text-xs text-muted">ระดับผลการประเมิน</div>
                    <div class="badge badge-lg ${this.getGradeBadgeClass(evalData.gradeBadge)}">${evalData.gradeBadge}</div>
                  </div>
                </div>

                <!-- แจกแจงคะแนน 5 ด้าน -->
                <div class="rubric-breakdown-list mb-3">
                  ${RUBRIC_CATEGORIES.map(cat => {
                    const score = evalData.scores?.[cat.id] || 0;
                    const percent = (score / 4) * 100;
                    return `
                      <div class="breakdown-item mb-2">
                        <div class="d-flex justify-content-between text-xs font-bold mb-1">
                          <span>${cat.title}</span>
                          <span>${score} / 4</span>
                        </div>
                        <div class="progress" style="height: 8px;">
                          <div class="progress-bar bg-primary" style="width: ${percent}%"></div>
                        </div>
                      </div>
                    `;
                  }).join("")}
                </div>

                ${evalData.feedback ? `
                  <div class="feedback-box p-3 bg-light rounded mt-3">
                    <div class="font-bold text-xs text-primary mb-1"><i class="fas fa-quote-left"></i> ข้อเสนอแนะและข้อคิดเห็นเชิงพัฒนา:</div>
                    <p class="text-sm mb-0 text-dark">${this.escapeHtml(evalData.feedback)}</p>
                  </div>
                ` : ''}
              </div>
            ` : (
              project.status === "evaluated" && evalData ? `
                <div class="alert alert-info text-sm d-flex align-items-center gap-2">
                  <i class="fas fa-hourglass-start fa-2x text-warning"></i>
                  <div>
                    <b>อยู่ในระหว่างการพิจารณา</b><br>
                    ระบบยังไม่ได้ประกาศผลการประเมินอย่างเป็นทางการ กรุณารอประกาศจากทางรายวิชา
                  </div>
                </div>
              ` : `
                <div class="alert alert-warning text-sm d-flex align-items-center gap-2">
                  <i class="fas fa-clock fa-2x text-warning"></i>
                  <div>
                    <b>รอรับการประเมิน</b><br>
                    ผลงานโครงงานนี้อยู่ในระหว่างการรอรับการประเมินจากคณะกรรมการ
                  </div>
                </div>
              `
            )}
          </div>
        </div>

        <div class="modal-footer d-flex justify-content-between">
          <button type="button" class="btn btn-outline-secondary" id="btn-edit-this-proj" data-id="${project.id}">
            <i class="fas fa-key"></i> แก้ไขข้อมูลผลงานโครงงาน
          </button>
          <button type="button" class="btn btn-secondary" id="btn-close-detail-footer">ปิดหน้าต่าง</button>
        </div>
      </div>
    `;

    modal.classList.add("active");

    // Close handlers
    modal.querySelector("#btn-close-detail")?.addEventListener("click", () => modal.classList.remove("active"));
    modal.querySelector("#btn-close-detail-footer")?.addEventListener("click", () => modal.classList.remove("active"));
    
    // Edit handler
    modal.querySelector("#btn-edit-this-proj")?.addEventListener("click", () => {
      modal.classList.remove("active");
      this.openPasscodeModal(project.id);
    });

    // Report & Slide Buttons
    modal.querySelector("#btn-open-report")?.addEventListener("click", () => {
      this.openFile(project.reportFile, `เล่มรายงาน_${project.title}`);
    });

    modal.querySelector("#btn-open-slide")?.addEventListener("click", () => {
      this.openFile(project.slideFile, `สื่อนำเสนอ_${project.title}`);
    });

    // Member Photo Click Lightbox Preview
    modal.querySelectorAll(".clickable-member-card").forEach(card => {
      card.addEventListener("click", () => {
        const idx = parseInt(card.dataset.memberIdx, 10);
        const m = (project.members || [])[idx];
        if (m && m.photoUrl) {
          Popup.imagePreview({
            imageUrl: m.photoUrl,
            title: `${m.title || ''}${m.fullName}`,
            subtitle: `รหัสนักเรียน: ${m.studentId || '-'} | ระดับชั้น: ${m.grade || project.gradeLevel || 'ม.5'} ห้อง ${m.room || '-'} เลขที่: ${m.number || '-'}`
          });
        }
      });
    });
  }
  }

  // ===================== PASSCODE EDIT MODAL =====================

  openPasscodeModal(preselectedProjectId = null) {
    let modal = document.getElementById("modal-passcode-auth");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modal-passcode-auth";
      modal.className = "modal-overlay";
      document.body.appendChild(modal);
    }

    const projects = this.store.getProjects();

    modal.innerHTML = `
      <div class="modal-box modal-sm animate-scale-up">
        <div class="modal-header">
          <h4 class="modal-title"><i class="fas fa-key text-warning"></i> ยืนยันรหัสแก้ไขข้อมูลโครงงาน</h4>
          <button type="button" class="btn-close-modal" id="btn-close-passcode">&times;</button>
        </div>
        <div class="modal-body">
          <form id="passcode-verify-form">
            <div class="form-group mb-3">
              <label>เลือกผลงานโครงงาน <span class="required">*</span></label>
              <select class="form-control" id="passcode-project-select" required>
                <option value="">-- กรุณาเลือกโครงงาน --</option>
                ${projects.map(p => `
                  <option value="${p.id}" ${p.id === preselectedProjectId ? 'selected' : ''}>
                    ${this.escapeHtml(p.title)} (${p.classroom || p.gradeLevel})
                  </option>
                `).join("")}
              </select>
            </div>

            <div class="form-group mb-3">
              <label>รหัสแก้ไขโครงงาน (Passcode 4 หลัก) <span class="required">*</span></label>
              <input type="password" maxlength="10" class="form-control text-center font-mono text-lg" id="passcode-input" placeholder="••••" required>
            </div>

            <div class="d-grid">
              <button type="submit" class="btn btn-primary font-bold">
                <i class="fas fa-unlock"></i> เข้าสู่หน้าแก้ไขข้อมูล
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    modal.classList.add("active");

    modal.querySelector("#btn-close-passcode")?.addEventListener("click", () => modal.classList.remove("active"));

    const form = modal.querySelector("#passcode-verify-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const projId = modal.querySelector("#passcode-project-select")?.value;
      const passcode = modal.querySelector("#passcode-input")?.value;

      if (!projId || !passcode) return;

      if (this.store.verifyProjectPasscode(projId, passcode)) {
        modal.classList.remove("active");
        const project = this.store.getProjectById(projId);
        this.switchView("submit");
        this.studentController.loadProjectForEdit(project);
      } else {
        Popup.alert({
          title: "รหัสผ่านไม่ถูกต้อง",
          message: "รหัสสำหรับแก้ไขข้อมูลโครงงาน (Passcode) ไม่ถูกต้อง กรุณาตรวจสอบรหัส 4 หลักที่ระบบจัดสรรให้อีกครั้ง",
          type: "error"
        });
      }
    });
  }

  // ===================== TOAST NOTIFICATIONS =====================

  showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type} animate-slide-in`;

    let icon = "info-circle";
    if (type === "success") icon = "check-circle";
    if (type === "error") icon = "exclamation-circle";
    if (type === "warning") icon = "exclamation-triangle";

    toast.innerHTML = `
      <i class="fas fa-${icon}"></i>
      <div class="toast-message">${this.escapeHtml(message)}</div>
      <button type="button" class="toast-close">&times;</button>
    `;

    container.appendChild(toast);

    toast.querySelector(".toast-close")?.addEventListener("click", () => toast.remove());

    setTimeout(() => {
      toast.classList.add("toast-fade-out");
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  getGradeBadgeClass(badgeStr) {
    if (!badgeStr) return "badge-light";
    if (badgeStr.includes("A")) return "badge-success";
    if (badgeStr.includes("B+")) return "badge-info";
    if (badgeStr.includes("B")) return "badge-primary";
    if (badgeStr.includes("C")) return "badge-warning";
    return "badge-danger";
  }

  escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
}

// เริ่มต้นการทำงานเมื่อโหลด DOM เสร็จสิ้น
document.addEventListener("DOMContentLoaded", () => {
  window.app = new App();
});
