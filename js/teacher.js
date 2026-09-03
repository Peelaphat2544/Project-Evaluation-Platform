/**
 * Teacher Controller: ระบบหลังบ้านสำหรับคุณครูผู้สอน
 * จัดการภาพรวม, ประเมินคะแนนด้วย Interactive Rubric 20 คะแนน, สวิตช์เปิด/ปิดคะแนน, และตั้งค่า Cloud
 */

import { RUBRIC_CATEGORIES, GRADE_CRITERIA } from "./rubric-data.js";
import { ExportUtil } from "./export-util.js";
import { Popup } from "./popup-util.js";

export class TeacherController {
  constructor({ store, gdriveService, showToast, openProjectDetail }) {
    this.store = store;
    this.gdrive = gdriveService;
    this.showToast = showToast;
    this.openProjectDetail = openProjectDetail;
    this.currentGradingProject = null;
    this.currentGradingScores = {
      product_tech: 0,
      impact_problem: 0,
      project_report: 0,
      presentation_qa: 0,
      teamwork_responsibility: 0
    };
    this.currentBonusScore = 0;
    this.filter = {
      search: "",
      classroom: "all",
      type: "all",
      status: "all"
    };

    this.chartInstance = null;
    if (typeof window !== "undefined") {
      window.openRubricsModal = () => this.openRubricsModal();
    }
    this.init();
  }

  init() {
    this.bindEvents();
    this.render();
  }

  bindEvents() {
    // ปุ่มเข้าสู่ระบบผู้ดูแลระบบด้วย Google
    const googleLoginBtn = document.getElementById("btn-google-admin-login");
    if (googleLoginBtn) {
      googleLoginBtn.addEventListener("click", () => this.handleGoogleLogin());
    }

    // ปุ่มออกจากระบบ
    const logoutBtn = document.getElementById("btn-teacher-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => this.handleLogout());
    }

    // สวิตช์เปิด-ปิดคะแนน
    const toggleScoreboard = document.getElementById("toggle-scoreboard-visibility");
    if (toggleScoreboard) {
      toggleScoreboard.addEventListener("change", async (e) => {
        const isChecked = e.target.checked;
        await this.store.toggleScoreboard(isChecked);
        this.showToast(isChecked 
          ? "เปิดเผยคะแนนให้นักเรียนดูได้แล้ว" 
          : "ปิดการแสดงผลคะแนนแล้ว (แสดงสถานะ: อยู่ในระหว่างการพิจารณา)", 
          isChecked ? "success" : "info"
        );
        this.updateScoreToggleUI(isChecked);
      });
    }

    // Filters ในตารางครู
    const searchInput = document.getElementById("teacher-search-input");
    const classFilter = document.getElementById("teacher-filter-class");
    const typeFilter = document.getElementById("teacher-filter-type");
    const statusFilter = document.getElementById("teacher-filter-status");

    if (searchInput) searchInput.addEventListener("input", (e) => {
      this.filter.search = e.target.value.toLowerCase().trim();
      this.renderTable();
    });

    if (classFilter) classFilter.addEventListener("change", (e) => {
      this.filter.classroom = e.target.value;
      this.renderTable();
    });

    if (typeFilter) typeFilter.addEventListener("change", (e) => {
      this.filter.type = e.target.value;
      this.renderTable();
    });

    if (statusFilter) statusFilter.addEventListener("change", (e) => {
      this.filter.status = e.target.value;
      this.renderTable();
    });

    // ปุ่ม Export CSV & Print
    const exportCsvBtn = document.getElementById("btn-export-csv");
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener("click", () => {
        const projects = this.store.getProjects();
        const settings = this.store.getSettings();
        ExportUtil.exportToCSV(projects, settings);
        this.showToast("ส่งออกไฟล์ CSV สำหรับ Excel สำเร็จ", "success");
      });
    }

    const printBtn = document.getElementById("btn-print-report");
    if (printBtn) {
      printBtn.addEventListener("click", () => {
        const projects = this.store.getProjects();
        const settings = this.store.getSettings();
        ExportUtil.printReport(projects, settings);
      });
    }

    // ปุ่มเปิด Modal ตั้งค่าระบบ
    const settingsBtn = document.getElementById("btn-open-settings");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => this.openSettingsModal());
    }

    // ปุ่มเปิด Modal เกณฑ์การประเมิน (Rubrics)
    const rubricsBtn = document.getElementById("btn-open-rubrics");
    if (rubricsBtn) {
      rubricsBtn.addEventListener("click", () => this.openRubricsModal());
    }

    // ปุ่มสถานะและต่ออายุ Token ด่วน
    const quickTokenBtn = document.getElementById("btn-gdrive-token-quick");
    if (quickTokenBtn) {
      quickTokenBtn.addEventListener("click", () => this.handleQuickTokenRefresh());
    }

    // ตั้งเวลาตรวจสอบและพยายามต่ออายุ Token อัตโนมัติทุกๆ 1 นาที
    if (!this.tokenCheckInterval) {
      this.tokenCheckInterval = setInterval(() => this.updateTokenStatusUI(true), 60000);
    }
  }


  async handleGoogleLogin() {
    const settings = this.store.getSettings();
    const allowed = settings.adminEmails || ["peelaphat@psuwit.ac.th"];

    const loginBtn = document.getElementById("btn-google-admin-login");
    const origHtml = loginBtn?.innerHTML;
    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> กำลังเชื่อมต่อบัญชี Google...`;
    }

    try {
      const res = await this.gdrive.requestDriveAuth({
        prompt: 'select_account',
        checkAdmin: true,
        allowedEmails: allowed
      });

      if (res.userInfo && this.store.loginTeacherWithGoogle(res.userInfo)) {
        this.render();
        await Popup.alert({
          title: "ยืนยันตัวตนสำเร็จ",
          message: `ยินดีต้อนรับ คุณครู ${res.userInfo.name || res.userInfo.email}\nเชื่อมต่อระบบ Google Drive สำเร็จเรียบร้อยแล้ว`,
          type: "success"
        });
      } else {
        throw new Error(`บัญชีอีเมล ${res.userInfo?.email || ''} ไม่ได้รับอนุญาตให้เข้าสู่ระบบ`);
      }
    } catch (err) {
      console.error("Google admin login error:", err);
      await Popup.alert({
        title: err.isDomainInvalid 
          ? "⛔ ไม่อนุญาตให้เข้าใช้งาน (Invalid Domain)" 
          : (err.isUnauthorized ? "⛔ ปฏิเสธการเข้าถึง (Access Denied)" : "ไม่สามารถเข้าสู่ระบบได้"),
        message: err.message || "เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์การเข้าใช้งาน",
        type: "error",
        confirmText: "รับทราบ"
      });
    } finally {
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.innerHTML = origHtml;
      }
    }
  }

  async handleLogout() {
    const confirmed = await Popup.confirm({
      title: "ยืนยันการออกจากระบบ",
      message: "คุณต้องการออกจากระบบผู้ดูแลระบบใช่หรือไม่?",
      type: "warning",
      confirmText: "ออกจากระบบ",
      cancelText: "ยกเลิก"
    });

    if (confirmed) {
      this.store.logoutTeacher();
      if (this.gdrive && this.gdrive.signOut) {
        this.gdrive.signOut();
      }
      this.render();
      this.showToast("ออกจากระบบเรียบร้อยแล้ว", "info");
    }
  }

  render() {
    const isAuth = this.store.isTeacherLoggedIn;
    const loginSection = document.getElementById("teacher-login-section");
    const dashboardSection = document.getElementById("teacher-dashboard-section");

    if (!isAuth) {
      if (loginSection) loginSection.classList.remove("d-none");
      if (dashboardSection) dashboardSection.classList.add("d-none");
      return;
    }

    if (loginSection) loginSection.classList.add("d-none");
    if (dashboardSection) dashboardSection.classList.remove("d-none");

    // อัปเดตข้อมูลอีเมลแอดมินในส่วนหัว
    const userEmailSpan = document.getElementById("admin-user-email");
    if (userEmailSpan) {
      const email = this.store.teacherUserInfo?.email || "peelaphat@psuwit.ac.th";
      userEmailSpan.textContent = email;
    }

    const settings = this.store.getSettings();
    const projects = this.store.getProjects();

    // อัปเดตสถานะสวิตช์เปิด-ปิดคะแนน
    this.updateScoreToggleUI(settings.scoreboardEnabled);

    // อัปเดตสถิติ Dashboard
    this.renderStatistics(projects);

    // อัปเดตตารางรายการโครงงาน
    this.renderTable();

    // อัปเดตสถานะ Google Drive Token
    this.updateTokenStatusUI();
  }


  updateScoreToggleUI(isEnabled) {
    const toggle = document.getElementById("toggle-scoreboard-visibility");
    const statusText = document.getElementById("toggle-scoreboard-status-text");

    if (toggle) toggle.checked = Boolean(isEnabled);
    if (statusText) {
      if (isEnabled) {
        statusText.innerHTML = `<span class="badge badge-success"><i class="fas fa-eye"></i> เปิดเผยคะแนนให้นักเรียนดูได้</span>`;
      } else {
        statusText.innerHTML = `<span class="badge badge-warning"><i class="fas fa-eye-slash"></i> ซ่อนคะแนน (แสดง: อยู่ในระหว่างการพิจารณา)</span>`;
      }
    }
  }

  renderStatistics(projects) {
    const total = projects.length;
    const evaluated = projects.filter(p => p.status === "evaluated" && p.evaluation).length;
    const pending = total - evaluated;

    const evaluatedScores = projects
      .filter(p => p.evaluation && p.evaluation.totalScore !== undefined)
      .map(p => p.evaluation.totalScore);

    const avgScore = evaluatedScores.length > 0 
      ? (evaluatedScores.reduce((a, b) => a + b, 0) / evaluatedScores.length).toFixed(1) 
      : "0.0";

    const maxScore = evaluatedScores.length > 0 ? Math.max(...evaluatedScores) : 0;
    const minScore = evaluatedScores.length > 0 ? Math.min(...evaluatedScores) : 0;

    // ใส่ตัวเลขลง Dashboard
    const elTotal = document.getElementById("stat-total-projects");
    const elEvaluated = document.getElementById("stat-evaluated-projects");
    const elPending = document.getElementById("stat-pending-projects");
    const elAvg = document.getElementById("stat-avg-score");
    const elMax = document.getElementById("stat-max-score");

    if (elTotal) elTotal.textContent = total;
    if (elEvaluated) elEvaluated.textContent = evaluated;
    if (elPending) elPending.textContent = pending;
    if (elAvg) elAvg.textContent = `${avgScore} / 20`;
    if (elMax) elMax.textContent = `${maxScore} คะแนน`;

    // วาดกราฟการกระจายคะแนน
    this.renderScoreChart(projects);
  }

  renderScoreChart(projects) {
    const canvas = document.getElementById("chart-score-distribution");
    if (!canvas || typeof Chart === "undefined") return;

    const evaluated = projects.filter(p => p.evaluation && p.evaluation.totalScore !== undefined);
    
    // นับตามเกรด
    const gradeCounts = { "ดีเยี่ยม (A)": 0, "ดีมาก (B+)": 0, "ดี (B)": 0, "ผ่านเกณฑ์ (C)": 0, "ควรปรับปรุง (D)": 0 };
    evaluated.forEach(p => {
      const g = p.evaluation.gradeBadge || "ควรปรับปรุง (D)";
      if (gradeCounts[g] !== undefined) {
        gradeCounts[g]++;
      }
    });

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const ctx = canvas.getContext("2d");
    this.chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(gradeCounts),
        datasets: [{
          label: "จำนวนโครงงาน",
          data: Object.values(gradeCounts),
          backgroundColor: [
            "rgba(16, 185, 129, 0.8)", // Green
            "rgba(6, 182, 212, 0.8)",  // Cyan
            "rgba(59, 130, 246, 0.8)",  // Blue
            "rgba(245, 158, 11, 0.8)",  // Amber
            "rgba(239, 68, 68, 0.8)"    // Red
          ],
          borderRadius: 8,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  }

  renderTable() {
    const tbody = document.getElementById("teacher-projects-tbody");
    if (!tbody) return;

    const projects = this.store.getProjects();
    const filtered = this.getFilteredProjects(projects);

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-5 text-muted">
            <i class="fas fa-search fa-2x mb-2"></i><br>
            ไม่พบข้อมูลโครงงานตามเงื่อนไขที่เลือก
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((p, idx) => {
      const isGraded = p.status === "evaluated" && p.evaluation;
      const evalData = p.evaluation || {};
      const typeBadge = p.type === "invention"
        ? `<span class="badge badge-primary"><i class="fas fa-microchip"></i> สิ่งประดิษฐ์</span>`
        : `<span class="badge badge-success"><i class="fas fa-laptop-code"></i> แพลตฟอร์ม</span>`;

      const statusBadge = isGraded
        ? `<span class="badge badge-success"><i class="fas fa-check-circle"></i> ตรวจแล้ว (${evalData.totalScore} คะแนน)</span>`
        : `<span class="badge badge-warning"><i class="fas fa-clock"></i> รอการตรวจ</span>`;

      const reportLink = p.reportFile?.viewUrl || p.reportFile?.directViewUrl;
      const slideLink = p.slideFile?.viewUrl || p.slideFile?.directViewUrl;

      return `
        <tr class="align-middle">
          <td class="text-center font-bold">${idx + 1}</td>
          <td>
            <div class="font-bold text-dark">${this.escapeHtml(p.title)}</div>
            <div class="text-xs text-muted d-flex gap-2 align-items-center mt-1">
              ${typeBadge}
              <span><i class="fas fa-users"></i> ${(p.members || []).length} คน</span>
              <span class="text-xs text-secondary">รหัสแก้ไข: <b>${p.passcode || '-'}</b></span>
            </div>
          </td>
          <td><span class="badge badge-light">${p.classroom || p.gradeLevel || '-'}</span></td>
          <td>
            <div class="d-flex gap-1">
              ${reportLink ? `
                <a href="${reportLink}" target="_blank" class="btn-chip btn-chip-pdf" title="เปิดไฟล์เล่มรายงาน Google Drive">
                  <i class="fas fa-file-pdf"></i> เล่ม
                </a>
              ` : `<span class="text-xs text-muted">ไม่มีเล่ม</span>`}

              ${slideLink ? `
                <a href="${slideLink}" target="_blank" class="btn-chip btn-chip-ppt" title="เปิดไฟล์สื่อนำเสนอ Google Drive">
                  <i class="fas fa-file-powerpoint"></i> สไลด์
                </a>
              ` : `<span class="text-xs text-muted">ไม่มีสไลด์</span>`}
            </div>
          </td>
          <td class="text-center">${statusBadge}</td>
          <td class="text-center">
            ${isGraded ? `<span class="badge ${this.getGradeBadgeClass(evalData.gradeBadge)} font-bold">${evalData.gradeBadge}</span>` : '-'}
          </td>
          <td class="text-center">
            <div class="d-flex gap-1 justify-content-center">
              <button type="button" class="btn btn-sm btn-primary btn-grade" data-id="${p.id}" title="กรอก/แก้ไขคะแนน Rubric">
                <i class="fas fa-edit"></i> ${isGraded ? 'แก้คะแนน' : 'ตรวจให้คะแนน'}
              </button>
              <button type="button" class="btn-icon btn-view-card" data-id="${p.id}" title="ดูข้อมูลโครงงาน">
                <i class="fas fa-eye"></i>
              </button>
              <button type="button" class="btn-icon btn-delete-project text-danger" data-id="${p.id}" title="ลบโครงงานนี้">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Bind action buttons
    tbody.querySelectorAll(".btn-grade").forEach(btn => {
      btn.addEventListener("click", () => this.openGradingModal(btn.dataset.id));
    });

    tbody.querySelectorAll(".btn-view-card").forEach(btn => {
      btn.addEventListener("click", () => {
        if (this.openProjectDetail) this.openProjectDetail(btn.dataset.id);
      });
    });

    tbody.querySelectorAll(".btn-delete-project").forEach(btn => {
      btn.addEventListener("click", () => this.confirmDeleteProject(btn.dataset.id));
    });
  }

  getFilteredProjects(projects) {
    return projects.filter(p => {
      const matchClass = this.filter.classroom === "all" || p.classroom === this.filter.classroom;
      const matchType = this.filter.type === "all" || p.type === this.filter.type;
      
      let matchStatus = true;
      if (this.filter.status === "evaluated") matchStatus = p.status === "evaluated" && Boolean(p.evaluation);
      if (this.filter.status === "pending") matchStatus = p.status !== "evaluated" || !p.evaluation;

      let matchSearch = true;
      if (this.filter.search) {
        const s = this.filter.search;
        const inTitle = (p.title || "").toLowerCase().includes(s);
        const inTitleEn = (p.titleEn || "").toLowerCase().includes(s);
        const inMembers = (p.members || []).some(m => (m.fullName || "").toLowerCase().includes(s));
        matchSearch = inTitle || inTitleEn || inMembers;
      }

      return matchClass && matchType && matchStatus && matchSearch;
    });
  }

  // ===================== RUBRIC GRADING MODAL =====================

  openGradingModal(projectId) {
    const project = this.store.getProjectById(projectId);
    if (!project) return;

    this.currentGradingProject = project;
    const evalData = project.evaluation || {};
    const existingScores = evalData.scores || {};

    this.currentGradingScores = {
      product_tech: existingScores.product_tech || 0,
      impact_problem: existingScores.impact_problem || 0,
      project_report: existingScores.project_report || 0,
      presentation_qa: existingScores.presentation_qa || 0,
      teamwork_responsibility: existingScores.teamwork_responsibility || 0
    };
    this.currentBonusScore = evalData.bonusScore || 0;

    let modal = document.getElementById("modal-grading-rubric");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modal-grading-rubric";
      modal.className = "modal-overlay";
      document.body.appendChild(modal);
    }

    const reportLink = project.reportFile?.viewUrl || project.reportFile?.directViewUrl;
    const slideLink = project.slideFile?.viewUrl || project.slideFile?.directViewUrl;

    modal.innerHTML = `
      <div class="modal-box modal-xl animate-scale-up rubric-modal-box">
        <div class="modal-header">
          <div>
            <div class="text-xs text-primary font-bold"><i class="fas fa-clipboard-check"></i> ระบบประเมินคะแนนโครงงาน (Rubric 20 คะแนน)</div>
            <h3 class="modal-title">${this.escapeHtml(project.title)}</h3>
            <div class="text-sm text-muted">
              ประเภท: <span class="badge ${project.type === 'invention' ? 'badge-primary' : 'badge-success'}">${project.type === 'invention' ? 'สิ่งประดิษฐ์' : 'แพลตฟอร์ม/ซอฟต์แวร์'}</span>
              | ระดับชั้น: <b>${project.classroom || project.gradeLevel}</b>
              | สมาชิก: ${(project.members || []).map(m => m.fullName).join(", ")}
            </div>
          </div>
          <button type="button" class="btn-close-modal" id="btn-close-grading">&times;</button>
        </div>

        <div class="modal-body">
          <!-- แถบทางลัดดูไฟล์เล่มและสไลด์ -->
          <div class="file-action-bar mb-3 p-2 rounded bg-light d-flex gap-2 align-items-center">
            <span class="text-xs font-bold text-muted"><i class="fab fa-google-drive text-success"></i> ไฟล์บน Google Drive:</span>
            ${reportLink ? `<a href="${reportLink}" target="_blank" class="btn btn-sm btn-outline-danger"><i class="fas fa-file-pdf"></i> เปิดดูเล่มรายงาน</a>` : '<span class="badge badge-light">ไม่มีเล่ม</span>'}
            ${slideLink ? `<a href="${slideLink}" target="_blank" class="btn btn-sm btn-outline-warning"><i class="fas fa-file-powerpoint"></i> เปิดดูสื่อนำเสนอ</a>` : '<span class="badge badge-light">ไม่มีสไลด์</span>'}
            ${project.demoUrl ? `<a href="${project.demoUrl}" target="_blank" class="btn btn-sm btn-outline-primary"><i class="fas fa-external-link-alt"></i> ลิงก์สาธิต/เว็บจริง</a>` : ''}
          </div>

          <!-- ตาราง Interactive Rubric Matrix 5 ด้าน -->
          <div class="rubric-matrix-container">
            ${this.renderRubricMatrixRows(project.type)}
          </div>

          <!-- ส่วนคะแนนพิเศษจิตวิญญาณนวัตกร (Bonus) & ข้อเสนอแนะเชิงบวก (Feedback) -->
          <div class="rubric-extra-section mt-4 p-3 bg-light rounded">
            <div class="row g-3">
              <div class="col-md-4">
                <label class="font-bold mb-1"><i class="fas fa-fire text-danger"></i> คะแนนพิเศษจิตวิญญาณนวัตกร (Bonus)</label>
                <p class="text-xs text-muted">สำหรับทีมที่มีความพยายามสูงมาก ล้มเหลวแต่ไม่ยอมแพ้ (Resilience) (+1 หรือ +2 นอกเหนือจาก 20 คะแนน)</p>
                <div class="d-flex gap-2 mt-2">
                  <button type="button" class="btn-bonus-chip ${this.currentBonusScore === 0 ? 'active' : ''}" data-bonus="0">0 คะแนน</button>
                  <button type="button" class="btn-bonus-chip ${this.currentBonusScore === 1 ? 'active' : ''}" data-bonus="1">+1 คะแนน</button>
                  <button type="button" class="btn-bonus-chip ${this.currentBonusScore === 2 ? 'active' : ''}" data-bonus="2">+2 คะแนน</button>
                </div>
              </div>

              <div class="col-md-8">
                <label class="font-bold mb-1"><i class="fas fa-comment-dots text-primary"></i> ข้อเสนอแนะเชิงบวก (Constructive Feedback)</label>
                <p class="text-xs text-muted">คำแนะนำเพื่อสร้าง Growth Mindset สำหรับการนำไปพัฒนาต่อยอด</p>
                <textarea id="grading-feedback-input" class="form-control" rows="3" placeholder="ระบุข้อเสนอแนะเชิงสร้างสรรค์ จุดเด่น และสิ่งที่สามารถพัฒนาเพิ่มเติมได้...">${this.escapeHtml(evalData.feedback || '')}</textarea>
              </div>
            </div>
          </div>

          <!-- Live Score Summary Box -->
          <div class="rubric-summary-card mt-3">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <span class="text-muted text-sm">คะแนนรวมทั้งหมด</span>
                <div class="d-flex align-items-baseline gap-2">
                  <span class="rubric-live-score" id="rubric-total-score-val">0</span>
                  <span class="text-muted">/ 20 คะแนน</span>
                  <span id="rubric-bonus-badge" class="badge badge-success d-none">+0 Bonus</span>
                </div>
              </div>
              <div class="text-end">
                <span class="text-muted text-sm">ระดับผลการประเมิน</span>
                <div id="rubric-grade-badge" class="badge badge-lg badge-primary">-</div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="btn-cancel-grading">ยกเลิก</button>
          <button type="button" class="btn btn-success font-bold" id="btn-save-grading">
            <i class="fas fa-save"></i> บันทึกผลการประเมิน
          </button>
        </div>
      </div>
    `;

    modal.classList.add("active");

    // Bind Rubric Level Selection Clicks
    modal.querySelectorAll(".rubric-level-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const catId = btn.dataset.cat;
        const score = parseInt(btn.dataset.score, 10);
        this.currentGradingScores[catId] = score;

        // ปรับ Active State
        modal.querySelectorAll(`.rubric-level-btn[data-cat="${catId}"]`).forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        this.updateLiveRubricTotal();
      });
    });

    // Bind Bonus Chips
    modal.querySelectorAll(".btn-bonus-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        this.currentBonusScore = parseInt(chip.dataset.bonus, 10);
        modal.querySelectorAll(".btn-bonus-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        this.updateLiveRubricTotal();
      });
    });

    // Bind Close & Save
    modal.querySelector("#btn-close-grading")?.addEventListener("click", () => modal.classList.remove("active"));
    modal.querySelector("#btn-cancel-grading")?.addEventListener("click", () => modal.classList.remove("active"));
    modal.querySelector("#btn-save-grading")?.addEventListener("click", () => this.saveCurrentGrading());

    this.updateLiveRubricTotal();
  }

  renderRubricMatrixRows(projectType) {
    const categories = this.store.getRubricCategories();
    return categories.map(cat => {
      const currentScore = this.currentGradingScores[cat.id] || 0;
      
      // หา levels ตามประเภทโครงงาน (สำหรับ Product & Tech)
      let levels = [];
      if (cat.levels && !Array.isArray(cat.levels)) {
        levels = projectType === "software" ? (cat.levels.software || []) : (cat.levels.invention || []);
      } else if (Array.isArray(cat.levels)) {
        levels = cat.levels;
      }

      const maxScore = cat.maxScore || 4;

      return `
        <div class="rubric-category-block mb-3">
          <div class="rubric-cat-header d-flex justify-content-between align-items-center">
            <div>
              <div class="rubric-cat-title">${cat.title}</div>
              <div class="text-xs text-muted">${cat.description}</div>
            </div>
            <div class="rubric-cat-score-badge" id="cat-score-badge-${cat.id}">
              ${currentScore > 0 ? `${currentScore}/${maxScore} คะแนน` : '<span class="text-muted">ยังไม่ให้คะแนน</span>'}
            </div>
          </div>

          <div class="rubric-level-grid">
            ${levels.map(lvl => `
              <button type="button" 
                class="rubric-level-btn ${currentScore === lvl.score ? 'active' : ''}" 
                data-cat="${cat.id}" 
                data-score="${lvl.score}">
                <div class="level-header">
                  <span class="level-score-circle">${lvl.score}</span>
                  <span class="level-label">${lvl.label}</span>
                </div>
                <div class="level-desc">${lvl.desc}</div>
              </button>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");
  }


  updateLiveRubricTotal() {
    let rawTotal = 0;
    let filledCount = 0;
    const categories = this.store.getRubricCategories();

    Object.entries(this.currentGradingScores).forEach(([catId, score]) => {
      rawTotal += score;
      if (score > 0) filledCount++;
      const catObj = categories.find(c => c.id === catId);
      const maxScore = catObj?.maxScore || 4;
      const catBadge = document.getElementById(`cat-score-badge-${catId}`);
      if (catBadge) {
        catBadge.innerHTML = score > 0 ? `<b>${score}</b> / ${maxScore} คะแนน` : '<span class="text-muted">ยังไม่ให้คะแนน</span>';
      }
    });


    const totalWithBonus = rawTotal + this.currentBonusScore;

    const totalEl = document.getElementById("rubric-total-score-val");
    const bonusBadge = document.getElementById("rubric-bonus-badge");
    const gradeBadge = document.getElementById("rubric-grade-badge");

    if (totalEl) totalEl.textContent = totalWithBonus;

    if (bonusBadge) {
      if (this.currentBonusScore > 0) {
        bonusBadge.textContent = `+${this.currentBonusScore} Bonus`;
        bonusBadge.classList.remove("d-none");
      } else {
        bonusBadge.classList.add("d-none");
      }
    }

    if (gradeBadge) {
      const calculatedGrade = this.calculateGrade(totalWithBonus);
      gradeBadge.textContent = calculatedGrade.grade;
      gradeBadge.className = `badge badge-lg ${calculatedGrade.badgeClass}`;
    }
  }

  calculateGrade(score) {
    for (const crit of GRADE_CRITERIA) {
      if (score >= crit.min) return crit;
    }
    return GRADE_CRITERIA[GRADE_CRITERIA.length - 1];
  }

  async saveCurrentGrading() {
    if (!this.currentGradingProject) return;

    // ตรวจสอบว่าให้คะแนนครบ 5 ด้านหรือไม่
    const missingCats = Object.entries(this.currentGradingScores).filter(([_, score]) => score === 0);
    if (missingCats.length > 0) {
      if (!confirm("คุณยังไม่ได้ให้คะแนนครบทั้ง 5 ด้าน ต้องการบันทึกต่อไปหรือไม่?")) {
        return;
      }
    }

    const rawTotal = Object.values(this.currentGradingScores).reduce((a, b) => a + b, 0);
    const finalTotal = rawTotal + this.currentBonusScore;
    const grade = this.calculateGrade(finalTotal);
    const feedback = document.getElementById("grading-feedback-input")?.value.trim() || "";

    const evaluationPayload = {
      scores: { ...this.currentGradingScores },
      bonusScore: this.currentBonusScore,
      totalScore: finalTotal,
      gradeBadge: grade.grade,
      feedback: feedback,
      evaluatorName: "ครูผู้สอน"
    };

    try {
      await this.store.evaluateProject(this.currentGradingProject.id, evaluationPayload);
      
      const modal = document.getElementById("modal-grading-rubric");
      if (modal) modal.classList.remove("active");

      this.render();

      await Popup.alert({
        title: "บันทึกผลการประเมินสำเร็จ",
        message: `บันทึกการประเมินโครงงาน "${this.currentGradingProject.title}" เรียบร้อยแล้ว\nคะแนนรวม: ${finalTotal}/20 คะแนน (ระดับ ${grade.grade})`,
        type: "success"
      });
    } catch (e) {
      await Popup.alert({
        title: "เกิดข้อผิดพลาดในการบันทึก",
        message: e.message,
        type: "error"
      });
    }
  }

  async confirmDeleteProject(projectId) {
    const project = this.store.getProjectById(projectId);
    if (!project) return;

    const confirmed = await Popup.confirm({
      title: "ยืนยันการลบผลงานโครงงาน",
      message: `คุณแน่ใจหรือไม่ว่าต้องการลบโครงงาน "${project.title}"?\n\n* ระบบจะทำการลบไฟล์เล่มรายงาน สื่อนำเสนอ และรูปภาพทั้งหมดออกจาก Google Drive ให้โดยอัตโนมัติ`,
      type: "warning",
      confirmText: "ลบโครงงานนี้",
      cancelText: "ยกเลิก"
    });

    if (!confirmed) return;

    this.showToast("กำลังลบไฟล์ใน Google Drive และข้อมูลโครงงาน...", "info");
    
    try {
      if (this.gdrive && this.gdrive.deleteProjectFiles) {
        await this.gdrive.deleteProjectFiles(project);
      }
    } catch (err) {
      console.warn("Delete drive files warning:", err);
    }

    await this.store.deleteProject(projectId);
    this.render();

    await Popup.alert({
      title: "ลบโครงงานสำเร็จ",
      message: `ลบผลงานโครงงาน "${project.title}" และไฟล์ที่เกี่ยวข้องออกจากระบบและ Google Drive เรียบร้อยแล้ว`,
      type: "success"
    });
  }

  // ===================== SETTINGS & CLOUD CONFIG =====================

  openSettingsModal() {
    const settings = this.store.getSettings();

    let modal = document.getElementById("modal-system-settings");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modal-system-settings";
      modal.className = "modal-overlay";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-box modal-lg animate-scale-up">
        <div class="modal-header">
          <h3 class="modal-title"><i class="fas fa-cog text-primary"></i> ตั้งค่าระบบ & การเชื่อมต่อ Google Drive / Firebase</h3>
          <button type="button" class="btn-close-modal" id="btn-close-settings">&times;</button>
        </div>

        <div class="modal-body">
          <!-- หมวดที่ 1: Google Drive OAuth 2.0 (Client ID) -->
          <div class="p-3 mb-3 bg-light rounded border">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <label class="font-bold mb-0 text-dark">
                <i class="fab fa-google-drive text-success"></i> Google Drive API (OAuth 2.0)
              </label>
              <span class="badge badge-info">Folder ID: 1-oqEfzFm_khFiNZqBRCSfpNdqdFCZ0h4</span>
            </div>
            <p class="text-xs text-muted mb-2">
              เชื่อมต่อ Google Drive ของคุณครูผ่าน Google Cloud Client ID (<code>620808857902-...apps.googleusercontent.com</code>)
            </p>
            <div class="d-flex gap-2 align-items-center">
              <button type="button" class="btn btn-sm btn-outline-success font-bold" id="btn-oauth-gdrive">
                <i class="fab fa-google"></i> เชื่อมต่อ Google Drive (Sign In with Google)
              </button>
              <div id="gdrive-oauth-status" class="text-xs">
                ${this.gdrive.accessToken ? '<span class="badge badge-success"><i class="fas fa-check-circle"></i> เชื่อมต่อ Google Drive เรียบร้อย</span>' : '<span class="badge badge-light">ยังไม่ได้เข้าสู่ระบบ Google</span>'}
              </div>
            </div>
          </div>

          <hr class="my-3">

          <div class="form-group mb-3">
            <label class="font-bold"><i class="fas fa-fire text-warning"></i> Firebase Firestore Config (JSON)</label>
            <p class="text-xs text-muted">
              เชื่อมต่อฐานข้อมูลออนไลน์แบบ Real-time (โปรเจกต์ <code>project-5358a</code>)
            </p>
            <textarea id="setting-firebase-config" class="form-control font-mono text-xs" rows="5" placeholder='{\n  "apiKey": "AIzaSy...",\n  "projectId": "my-project",\n  "storageBucket": "my-project.appspot.com"\n}'>${settings.firebaseConfig ? JSON.stringify(settings.firebaseConfig, null, 2) : ''}</textarea>
          </div>

          <hr class="my-3">

          <div class="row g-3">
            <div class="col-md-6">
              <div class="form-group">
                <label class="font-bold"><i class="fas fa-user-shield text-primary"></i> อีเมลผู้ดูแลระบบ (คั่นด้วยจุลภาค ,)</label>
                <input type="text" id="setting-admin-emails" class="form-control font-mono text-sm" value="${this.escapeHtml((settings.adminEmails || ['peelaphat@psuwit.ac.th']).join(', '))}" placeholder="peelaphat@psuwit.ac.th">
                <small class="text-muted text-xs">ระบุบัญชี Google ที่ได้รับสิทธิ์เข้าถึงระบบผู้ดูแลระบบ</small>
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-group">
                <label class="font-bold"><i class="fas fa-book text-primary"></i> ชื่อวิชา / กิจกรรม</label>
                <input type="text" id="setting-subject-name" class="form-control" value="${this.escapeHtml(settings.subjectName || '')}">
                <small class="text-muted text-xs">ชื่อรายวิชาที่เป็นทางการ</small>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer d-flex justify-content-between">
          <button type="button" class="btn btn-outline-danger btn-sm" id="btn-reset-sample-data">
            <i class="fas fa-trash-alt"></i> ล้างข้อมูลโครงงานทั้งหมด
          </button>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-secondary" id="btn-cancel-settings">ยกเลิก</button>
            <button type="button" class="btn btn-primary" id="btn-save-settings">
              <i class="fas fa-save"></i> บันทึกการตั้งค่า
            </button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add("active");

    modal.querySelector("#btn-close-settings")?.addEventListener("click", () => modal.classList.remove("active"));
    modal.querySelector("#btn-cancel-settings")?.addEventListener("click", () => modal.classList.remove("active"));

    // Google Drive OAuth 2.0 Sign-In
    modal.querySelector("#btn-oauth-gdrive")?.addEventListener("click", async () => {
      const statusEl = modal.querySelector("#gdrive-oauth-status");
      if (statusEl) statusEl.innerHTML = `<span class="text-primary"><i class="fas fa-spinner fa-spin"></i> กำลังเปิดหน้าต่าง Google Login...</span>`;
      try {
        const allowed = (modal.querySelector("#setting-admin-emails")?.value || "")
          .split(",").map(e => e.trim()).filter(Boolean);

        const result = await this.gdrive.requestDriveAuth({
          prompt: 'select_account',
          checkAdmin: true,
          allowedEmails: allowed.length > 0 ? allowed : ["peelaphat@psuwit.ac.th"]
        });

        if (statusEl) {
          statusEl.innerHTML = `<span class="badge badge-success"><i class="fas fa-check-circle"></i> เชื่อมต่อ (${result.userInfo?.email || 'สำเร็จ'})</span>`;
        }
        this.showToast("เชื่อมต่อ Google Drive ของคุณครูสำเร็จเรียบร้อยแล้ว", "success");
      } catch (err) {
        if (statusEl) {
          statusEl.innerHTML = `<span class="text-danger"><i class="fas fa-exclamation-circle"></i> เกิดข้อผิดพลาด (${err.message})</span>`;
        }
      }
    });

    // บันทึกการตั้งค่า
    modal.querySelector("#btn-save-settings")?.addEventListener("click", async () => {
      const adminEmailsRaw = modal.querySelector("#setting-admin-emails")?.value || "";
      const adminEmails = adminEmailsRaw.split(",").map(e => e.trim()).filter(Boolean);
      const subjectName = modal.querySelector("#setting-subject-name")?.value.trim() || "";
      const firebaseRaw = modal.querySelector("#setting-firebase-config")?.value.trim();

      let fbConfig = null;
      if (firebaseRaw) {
        try {
          fbConfig = JSON.parse(firebaseRaw);
        } catch (e) {
          this.showToast("รูปแบบ Firebase Config JSON ไม่ถูกต้อง", "error");
          return;
        }
      }

      await this.store.updateSettings({
        adminEmails: adminEmails.length > 0 ? adminEmails : ["peelaphat@psuwit.ac.th"],
        subjectName: subjectName,
        firebaseConfig: fbConfig
      });

      this.showToast("บันทึกการตั้งค่าเรียบร้อยแล้ว", "success");
      modal.classList.remove("active");
      this.render();
    });

    // ล้างข้อมูลโครงงานทั้งหมด
    modal.querySelector("#btn-reset-sample-data")?.addEventListener("click", async () => {
      const confirmed = await Popup.confirm({
        title: "ยืนยันการล้างข้อมูลโครงงาน",
        message: "คุณต้องการล้างข้อมูลโครงงานทั้งหมดออกจากระบบใช่หรือไม่?\n\n* ข้อมูลโครงงานทั้งหมดจะถูกลบและไม่สามารถกู้คืนได้",
        type: "danger",
        confirmText: "ล้างข้อมูลทั้งหมด",
        cancelText: "ยกเลิก"
      });

      if (confirmed) {
        this.store.clearAllProjects();
        modal.classList.remove("active");
        this.render();
        await Popup.alert({
          title: "ล้างข้อมูลสำเร็จ",
          message: "ล้างข้อมูลโครงงานทั้งหมดในระบบเรียบร้อยแล้ว",
          type: "success"
        });
      }
    });
  }

  // ===================== GOOGLE DRIVE TOKEN STATUS & QUICK REFRESH =====================

  updateTokenStatusUI(isBackgroundCheck = false) {
    if (!this.gdrive || !this.gdrive.getTokenStatus) return;
    const status = this.gdrive.getTokenStatus();
    const btn = document.getElementById("btn-gdrive-token-quick");
    const textSpan = document.getElementById("gdrive-quick-status-text");

    if (!btn || !textSpan) return;

    btn.classList.remove("btn-outline-success", "btn-outline-warning", "btn-outline-danger");

    if (!status.connected) {
      btn.classList.add("btn-outline-danger");
      textSpan.innerHTML = `<span class="text-danger font-bold"><i class="fas fa-exclamation-circle"></i> Drive หมดอายุ (คลิกต่ออายุ)</span>`;
      btn.title = "สิทธิ์ Google Drive หมดอายุแล้ว นักเรียนจะไม่สามารถส่งไฟล์ได้ คลิกเพื่อต่ออายุทันที";
    } else if (status.remainingMinutes < 15) {
      btn.classList.add("btn-outline-warning");
      textSpan.innerHTML = `<span class="text-warning font-bold"><i class="fas fa-clock"></i> Drive เหลือ ${status.remainingMinutes} น. (ต่ออายุ)</span>`;
      btn.title = `Google Drive ใกล้หมดอายุ (เหลือ ${status.remainingMinutes} นาที) คลิกเพื่อต่ออายุล่วงหน้า`;

      // ต่ออายุ Token อัตโนมัติในพื้นหลัง (Silent Refresh) ถ้าคุณครูกำลังใช้งานอยู่
      if (isBackgroundCheck && this.store.isTeacherLoggedIn && this.gdrive.silentRefreshToken) {
        this.gdrive.silentRefreshToken().then(token => {
          if (token) this.updateTokenStatusUI(false);
        });
      }
    } else {
      btn.classList.add("btn-outline-success");
      textSpan.innerHTML = `<i class="fas fa-check-circle text-success"></i> Drive เหลือ ${status.remainingMinutes} น.`;
      btn.title = `Google Drive เชื่อมต่อปกติ (เหลืออายุการใช้งาน ${status.remainingMinutes} นาที)`;
    }
  }

  async handleQuickTokenRefresh() {
    const status = this.gdrive.getTokenStatus();
    const settings = this.store.getSettings();
    const allowed = settings.adminEmails || ["peelaphat@psuwit.ac.th"];

    if (status.connected && status.remainingMinutes >= 15) {
      const wantRenew = await Popup.confirm({
        title: "สถานะการเชื่อมต่อ Google Drive",
        message: `Google Drive ของคุณครูยังเชื่อมต่ออยู่ตามปกติ\n(เหลือเวลาการใช้งานอีก ${status.remainingMinutes} นาที)\n\nคุณต้องการต่ออายุ Token เพิ่มอีก 1 ชั่วโมงล่วงหน้าเลยหรือไม่?`,
        confirmText: "ต่ออายุทันที",
        cancelText: "ปิดหน้าต่าง",
        type: "confirm"
      });
      if (!wantRenew) return;
    }

    try {
      this.showToast("กำลังเปิดหน้าต่างยืนยันสิทธิ์ Google Drive...", "info");
      const res = await this.gdrive.requestDriveAuth({
        prompt: 'select_account',
        checkAdmin: true,
        allowedEmails: allowed
      });
      this.updateTokenStatusUI();
      await Popup.alert({
        title: "เชื่อมต่อสำเร็จ",
        message: `ต่ออายุสิทธิ์ Google Drive เรียบร้อยแล้ว!\nระบบพร้อมรับการอัปโหลดไฟล์จากนักเรียนได้อีก 1 ชั่วโมง\n(บัญชี: ${res.userInfo?.email || 'Google'})`,
        type: "success"
      });
    } catch (err) {
      console.error("Quick token refresh error:", err);
      await Popup.alert({
        title: "ไม่สามารถต่ออายุได้",
        message: err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ Google Drive",
        type: "error"
      });
    }
  }

  // ===================== RUBRICS MANAGEMENT MODAL =====================

  openRubricsModal() {
    let modal = document.getElementById("modal-rubrics-management");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modal-rubrics-management";
      modal.className = "modal-overlay active animate-fade-in";
      document.body.appendChild(modal);
    } else {
      modal.classList.add("active");
    }

    let activeTab = "view"; // "view" | "edit"
    let viewFilter = "all"; // "all" | "invention" | "software"
    let editMode = "form"; // "form" | "json"
    let categories = JSON.parse(JSON.stringify(this.store.getRubricCategories()));

    const renderViewTab = () => {
      return `
        <!-- Filter Pills & Total Score Summary -->
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4 p-3 bg-light rounded border">
          <div class="d-flex align-items-center gap-2">
            <span class="text-xs font-bold text-muted"><i class="fas fa-filter"></i> เลือกแสดงตามประเภท:</span>
            <div class="btn-group btn-group-sm">
              <button type="button" class="btn ${viewFilter === 'all' ? 'btn-primary' : 'btn-outline-secondary'} btn-sm filter-pill" data-filter="all">ดูทุกประเภท</button>
              <button type="button" class="btn ${viewFilter === 'invention' ? 'btn-primary' : 'btn-outline-secondary'} btn-sm filter-pill" data-filter="invention"><i class="fas fa-microchip"></i> สิ่งประดิษฐ์</button>
              <button type="button" class="btn ${viewFilter === 'software' ? 'btn-primary' : 'btn-outline-secondary'} btn-sm filter-pill" data-filter="software"><i class="fas fa-laptop-code"></i> แพลตฟอร์ม/ซอฟต์แวร์</button>
            </div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="badge badge-success" style="font-size: 0.9rem;"><i class="fas fa-star"></i> คะแนนรวม 20 คะแนน (5 ด้าน ด้านละ 4 คะแนน)</span>
          </div>
        </div>

        <!-- Category Cards List -->
        <div class="rubric-categories-display">
          ${categories.map((cat, idx) => {
            const isProductTech = cat.id === "product_tech";
            let levelsToRender = [];

            if (isProductTech && cat.levels && !Array.isArray(cat.levels)) {
              if (viewFilter === "all") {
                levelsToRender = [
                  { typeName: "🤖 ด้านสิ่งประดิษฐ์ (Hardware / Device / STEM)", levels: cat.levels.invention || [] },
                  { typeName: "💻 ด้านแพลตฟอร์ม / ซอฟต์แวร์ (Web / Mobile / AI)", levels: cat.levels.software || [] }
                ];
              } else if (viewFilter === "invention") {
                levelsToRender = [{ typeName: "🤖 ด้านสิ่งประดิษฐ์ (Invention)", levels: cat.levels.invention || [] }];
              } else {
                levelsToRender = [{ typeName: "💻 ด้านแพลตฟอร์ม / ซอฟต์แวร์ (Software)", levels: cat.levels.software || [] }];
              }
            } else {
              levelsToRender = [{ typeName: "", levels: Array.isArray(cat.levels) ? cat.levels : [] }];
            }

            return `
              <div class="rubric-view-card">
                <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
                  <div>
                    <h5 class="font-bold text-dark mb-1"><i class="fas fa-check-circle text-primary"></i> ${this.escapeHtml(cat.title)}</h5>
                    <p class="text-xs text-muted mb-0">${this.escapeHtml(cat.description || '')}</p>
                  </div>
                  <span class="badge badge-primary font-bold">คะแนนเต็ม ${cat.maxScore || 4} คะแนน</span>
                </div>

                ${levelsToRender.map(sec => `
                  ${sec.typeName ? `<div class="text-xs font-bold text-primary mt-3 mb-1"><i class="fas fa-layer-group"></i> ${sec.typeName}</div>` : ''}
                  <div class="rubric-levels-display-grid">
                    ${sec.levels.map(lvl => `
                      <div class="rubric-level-card level-${lvl.score}">
                        <div class="rubric-level-badge">
                          <i class="fas fa-circle"></i> ${lvl.label || `${lvl.score} คะแนน`}
                        </div>
                        <div class="rubric-level-desc-text">${this.escapeHtml(lvl.desc || '')}</div>
                      </div>
                    `).join("")}
                  </div>
                `).join("")}
              </div>
            `;
          }).join("")}
        </div>

        <!-- Grade Cutoffs & Evaluator Guidance -->
        <div class="row g-3 mt-2">
          <div class="col-md-6">
            <div class="card p-3 h-100 border bg-white shadow-sm rounded-lg">
              <h6 class="font-bold text-dark mb-2"><i class="fas fa-award text-warning"></i> เกณฑ์การตัดระดับผลการเรียน (Grade Criteria)</h6>
              <div class="table-responsive">
                <table class="table table-sm text-xs mb-0">
                  <thead>
                    <tr>
                      <th>ช่วงคะแนน</th>
                      <th>ระดับผล</th>
                      <th>ความหมาย</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td><b>18 - 20 คะแนน</b></td><td><span class="badge badge-success">ดีเยี่ยม (A)</span></td><td>นวัตกรรมสมบูรณ์แบบ แก้ปัญหาได้จริง</td></tr>
                    <tr><td><b>15 - 17 คะแนน</b></td><td><span class="badge badge-info">ดีมาก (B+)</span></td><td>ผลงานดี มีจุดที่พัฒนาต่อยอดได้</td></tr>
                    <tr><td><b>13 - 14 คะแนน</b></td><td><span class="badge badge-primary">ดี (B)</span></td><td>ผ่านเกณฑ์มาตรฐานอย่างดี</td></tr>
                    <tr><td><b>10 - 12 คะแนน</b></td><td><span class="badge badge-warning">ผ่านเกณฑ์ (C)</span></td><td>ใช้งานได้บางส่วน ต้องปรับปรุงเพิ่มเติม</td></tr>
                    <tr><td><b>0 - 9 คะแนน</b></td><td><span class="badge badge-danger">ควรปรับปรุง (D)</span></td><td>ชิ้นงานยังไม่สมบูรณ์ ขาดองค์ประกอบหลัก</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="card p-3 h-100 border bg-white shadow-sm rounded-lg">
              <h6 class="font-bold text-primary mb-2"><i class="fas fa-lightbulb text-warning"></i> ข้อแนะนำสำหรับคุณครูผู้ประเมิน</h6>
              <ul class="text-xs text-muted mb-0 ps-3" style="line-height: 1.7;">
                <li><b>คะแนนพิเศษ (Bonus Points +1 หรือ +2):</b> อาจพิจารณาให้คะแนนพิเศษสำหรับทีมที่มีความพยายามสูงมาก (Resilience & Growth Mindset) ล้มเหลวหลายครั้งแต่ไม่ยอมแพ้</li>
                <li><b>Constructive Feedback:</b> ควรระบุข้อเสนอแนะเชิงบวกและข้อควรปรับปรุงเพื่อให้นักเรียนนำไปต่อยอดได้จริง</li>
                <li><b>การแสดงผลคะแนน:</b> หากปิดสวิตช์ Scoreboard ในหน้าหลัก นักเรียนจะยังไม่เห็นคะแนนจนกว่าการประเมินจะเสร็จสิ้นครบทุกกลุ่ม</li>
              </ul>
            </div>
          </div>
        </div>
      `;
    };

    const renderEditTab = () => {
      return `
        <!-- Switch Edit Mode (Visual Form vs Raw JSON) -->
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div class="alert alert-info py-2 px-3 text-xs mb-0 d-flex align-items-center gap-2">
            <i class="fas fa-info-circle fa-lg"></i>
            <span>คุณครูสามารถปรับแต่งข้อความเกณฑ์ คำอธิบาย และคะแนนเต็มในแต่ละด้านได้ ข้อมูลจะถูกบันทึกและซิงค์ทันที</span>
          </div>
          <div class="btn-group btn-group-sm">
            <button type="button" class="btn ${editMode === 'form' ? 'btn-primary' : 'btn-outline-secondary'} btn-sm" id="btn-edit-mode-form">
              <i class="fas fa-th-list"></i> โหมดฟอร์ม (Visual Form)
            </button>
            <button type="button" class="btn ${editMode === 'json' ? 'btn-primary' : 'btn-outline-secondary'} btn-sm" id="btn-edit-mode-json">
              <i class="fas fa-code"></i> โหมดโค้ด (JSON Editor)
            </button>
          </div>
        </div>

        ${editMode === 'form' ? renderEditForm() : renderEditJson()}
      `;
    };

    const renderEditForm = () => {
      return `
        <div id="rubric-form-container">
          ${categories.map((cat, catIdx) => {
            const isProductTech = cat.id === "product_tech";
            return `
              <div class="rubric-edit-accordion">
                <div class="rubric-edit-accordion-header" data-target="body-cat-${catIdx}">
                  <div class="d-flex align-items-center gap-2">
                    <span class="badge badge-primary">${catIdx + 1}</span>
                    <b class="text-dark">${this.escapeHtml(cat.title)}</b>
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    <span class="badge badge-light border">${cat.maxScore || 4} คะแนน</span>
                    <i class="fas fa-chevron-down text-muted"></i>
                  </div>
                </div>

                <div class="rubric-edit-accordion-body" id="body-cat-${catIdx}">
                  <div class="row g-2 mb-3">
                    <div class="col-md-9">
                      <label class="text-xs font-bold text-muted mb-1">ชื่อด้านการประเมิน (Title)</label>
                      <input type="text" class="form-control form-control-sm cat-title-input" data-cat-idx="${catIdx}" value="${this.escapeHtml(cat.title)}">
                    </div>
                    <div class="col-md-3">
                      <label class="text-xs font-bold text-muted mb-1">คะแนนเต็ม (Max Score)</label>
                      <input type="number" min="1" max="20" class="form-control form-control-sm cat-maxscore-input" data-cat-idx="${catIdx}" value="${cat.maxScore || 4}">
                    </div>
                    <div class="col-12">
                      <label class="text-xs font-bold text-muted mb-1">คำอธิบายภาพรวม (Description)</label>
                      <input type="text" class="form-control form-control-sm cat-desc-input" data-cat-idx="${catIdx}" value="${this.escapeHtml(cat.description || '')}">
                    </div>
                  </div>

                  <!-- Levels Editing -->
                  ${isProductTech && cat.levels && !Array.isArray(cat.levels) ? `
                    <div class="p-2 mb-3 bg-light rounded border">
                      <b class="text-xs text-primary d-block mb-2"><i class="fas fa-microchip"></i> เกณฑ์สำหรับ: สิ่งประดิษฐ์ (Invention)</b>
                      <div class="row g-2">
                        ${(cat.levels.invention || []).map((lvl, lIdx) => `
                          <div class="col-md-6 mb-2">
                            <label class="text-xs font-bold mb-1">${lvl.score} คะแนน: ป้ายชื่อ (Label)</label>
                            <input type="text" class="form-control form-control-sm mb-1 inv-lvl-label" data-cat-idx="${catIdx}" data-lvl-idx="${lIdx}" value="${this.escapeHtml(lvl.label)}">
                            <label class="text-xs text-muted mb-1">คำอธิบายเกณฑ์</label>
                            <textarea class="form-control form-control-sm inv-lvl-desc" rows="2" data-cat-idx="${catIdx}" data-lvl-idx="${lIdx}">${this.escapeHtml(lvl.desc)}</textarea>
                          </div>
                        `).join("")}
                      </div>
                    </div>

                    <div class="p-2 bg-light rounded border">
                      <b class="text-xs text-success d-block mb-2"><i class="fas fa-laptop-code"></i> เกณฑ์สำหรับ: แพลตฟอร์ม/ซอฟต์แวร์ (Software)</b>
                      <div class="row g-2">
                        ${(cat.levels.software || []).map((lvl, lIdx) => `
                          <div class="col-md-6 mb-2">
                            <label class="text-xs font-bold mb-1">${lvl.score} คะแนน: ป้ายชื่อ (Label)</label>
                            <input type="text" class="form-control form-control-sm mb-1 soft-lvl-label" data-cat-idx="${catIdx}" data-lvl-idx="${lIdx}" value="${this.escapeHtml(lvl.label)}">
                            <label class="text-xs text-muted mb-1">คำอธิบายเกณฑ์</label>
                            <textarea class="form-control form-control-sm soft-lvl-desc" rows="2" data-cat-idx="${catIdx}" data-lvl-idx="${lIdx}">${this.escapeHtml(lvl.desc)}</textarea>
                          </div>
                        `).join("")}
                      </div>
                    </div>
                  ` : `
                    <div class="row g-2">
                      ${(Array.isArray(cat.levels) ? cat.levels : []).map((lvl, lIdx) => `
                        <div class="col-md-6 mb-2">
                          <label class="text-xs font-bold mb-1">${lvl.score} คะแนน: ป้ายชื่อ (Label)</label>
                          <input type="text" class="form-control form-control-sm mb-1 std-lvl-label" data-cat-idx="${catIdx}" data-lvl-idx="${lIdx}" value="${this.escapeHtml(lvl.label)}">
                          <label class="text-xs text-muted mb-1">คำอธิบายเกณฑ์</label>
                          <textarea class="form-control form-control-sm std-lvl-desc" rows="2" data-cat-idx="${catIdx}" data-lvl-idx="${lIdx}">${this.escapeHtml(lvl.desc)}</textarea>
                        </div>
                      `).join("")}
                    </div>
                  `}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    };

    const renderEditJson = () => {
      return `
        <div>
          <label class="text-xs font-bold text-muted mb-1">JSON Schema ของเกณฑ์การประเมิน</label>
          <textarea id="rubric-json-editor" class="form-control font-mono text-xs" rows="18" style="white-space: pre;">${JSON.stringify(categories, null, 2)}</textarea>
          <small class="text-muted text-xs mt-1 d-block">ระวัง: กรุณาตรวจสอบวงเล็บปีกกาและเครื่องหมายจุลภาคให้ถูกต้องตามมาตรฐาน JSON</small>
        </div>
      `;
    };

    const bindModalEvents = () => {
      // Close Modal
      modal.querySelector("#btn-close-rubrics")?.addEventListener("click", () => modal.classList.remove("active"));
      modal.querySelector("#btn-rubric-close-footer")?.addEventListener("click", () => modal.classList.remove("active"));
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("active");
      });
      modal.querySelector("#btn-rubric-cancel")?.addEventListener("click", () => {
        activeTab = "view";
        renderModal();
      });

      // Switch Tab
      modal.querySelector("#tab-btn-view")?.addEventListener("click", () => {
        activeTab = "view";
        renderModal();
      });

      modal.querySelector("#tab-btn-edit")?.addEventListener("click", () => {
        activeTab = "edit";
        renderModal();
      });

      // Filter in View Tab
      modal.querySelectorAll(".filter-pill").forEach(btn => {
        btn.addEventListener("click", () => {
          viewFilter = btn.dataset.filter;
          renderModal();
        });
      });

      // Switch Edit Mode
      modal.querySelector("#btn-edit-mode-form")?.addEventListener("click", () => {
        editMode = "form";
        renderModal();
      });

      modal.querySelector("#btn-edit-mode-json")?.addEventListener("click", () => {
        editMode = "json";
        renderModal();
      });

      // Toggle Accordion in Form
      modal.querySelectorAll(".rubric-edit-accordion-header").forEach(header => {
        header.addEventListener("click", () => {
          const targetId = header.dataset.target;
          const body = modal.querySelector(`#${targetId}`);
          if (body) {
            body.classList.toggle("d-none");
            const icon = header.querySelector(".fa-chevron-down, .fa-chevron-up");
            if (icon) {
              icon.classList.toggle("fa-chevron-down");
              icon.classList.toggle("fa-chevron-up");
            }
          }
        });
      });

      // Save Rubrics Button
      modal.querySelector("#btn-rubric-save")?.addEventListener("click", async () => {
        let updated = null;

        if (editMode === "json") {
          const jsonText = modal.querySelector("#rubric-json-editor")?.value.trim();
          try {
            updated = JSON.parse(jsonText);
          } catch (e) {
            await Popup.alert({
              title: "รูปแบบ JSON ไม่ถูกต้อง",
              message: `เกิดข้อผิดพลาดในการแปลผล JSON: ${e.message}`,
              type: "error"
            });
            return;
          }
        } else {
          // Read from visual form
          updated = JSON.parse(JSON.stringify(categories));
          updated.forEach((cat, catIdx) => {
            const titleInput = modal.querySelector(`.cat-title-input[data-cat-idx="${catIdx}"]`);
            const descInput = modal.querySelector(`.cat-desc-input[data-cat-idx="${catIdx}"]`);
            const maxScoreInput = modal.querySelector(`.cat-maxscore-input[data-cat-idx="${catIdx}"]`);

            if (titleInput) cat.title = titleInput.value.trim();
            if (descInput) cat.description = descInput.value.trim();
            if (maxScoreInput) cat.maxScore = parseInt(maxScoreInput.value, 10) || 4;

            if (cat.id === "product_tech" && cat.levels && !Array.isArray(cat.levels)) {
              // Invention
              (cat.levels.invention || []).forEach((lvl, lIdx) => {
                const labelIn = modal.querySelector(`.inv-lvl-label[data-cat-idx="${catIdx}"][data-lvl-idx="${lIdx}"]`);
                const descIn = modal.querySelector(`.inv-lvl-desc[data-cat-idx="${catIdx}"][data-lvl-idx="${lIdx}"]`);
                if (labelIn) lvl.label = labelIn.value.trim();
                if (descIn) lvl.desc = descIn.value.trim();
              });
              // Software
              (cat.levels.software || []).forEach((lvl, lIdx) => {
                const labelIn = modal.querySelector(`.soft-lvl-label[data-cat-idx="${catIdx}"][data-lvl-idx="${lIdx}"]`);
                const descIn = modal.querySelector(`.soft-lvl-desc[data-cat-idx="${catIdx}"][data-lvl-idx="${lIdx}"]`);
                if (labelIn) lvl.label = labelIn.value.trim();
                if (descIn) lvl.desc = descIn.value.trim();
              });
            } else if (Array.isArray(cat.levels)) {
              cat.levels.forEach((lvl, lIdx) => {
                const labelIn = modal.querySelector(`.std-lvl-label[data-cat-idx="${catIdx}"][data-lvl-idx="${lIdx}"]`);
                const descIn = modal.querySelector(`.std-lvl-desc[data-cat-idx="${catIdx}"][data-lvl-idx="${lIdx}"]`);
                if (labelIn) lvl.label = labelIn.value.trim();
                if (descIn) lvl.desc = descIn.value.trim();
              });
            }
          });
        }

        try {
          await this.store.saveRubricCategories(updated);
          categories = JSON.parse(JSON.stringify(updated));
          this.showToast("บันทึกเกณฑ์การประเมินโครงงานเรียบร้อยแล้ว", "success");
          activeTab = "view";
          renderModal();
          this.render();
        } catch (saveErr) {
          await Popup.alert({
            title: "ไม่สามารถบันทึกได้",
            message: saveErr.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล",
            type: "error"
          });
        }
      });

      // Reset Default Button
      modal.querySelector("#btn-rubric-reset-default")?.addEventListener("click", async () => {
        const confirmed = await Popup.confirm({
          title: "คืนค่าเกณฑ์เริ่มต้น",
          message: "คุณต้องการคืนค่าเกณฑ์การประเมินเป็นค่าเริ่มต้น (5 ด้าน 20 คะแนนมาตรฐานตามหลักสูตร) ใช่หรือไม่?",
          type: "warning",
          confirmText: "คืนค่าเริ่มต้น",
          cancelText: "ยกเลิก"
        });

        if (confirmed) {
          const defCats = await this.store.resetRubricCategories();
          categories = JSON.parse(JSON.stringify(defCats));
          this.showToast("คืนค่าเกณฑ์การประเมินเริ่มต้นเรียบร้อยแล้ว", "success");
          activeTab = "view";
          renderModal();
          this.render();
        }
      });
    };

    renderModal();
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
