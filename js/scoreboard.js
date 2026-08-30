/**
 * Scoreboard Controller: หน้าแสดงผลคะแนนและกระดานผู้นำ (Leaderboard)
 * รองรับการเปิด-ปิดการแสดงผลคะแนนตามการตั้งค่าของคุณครู
 */

import { RUBRIC_CATEGORIES } from "./rubric-data.js";
import { Popup } from "./popup-util.js";

export class ScoreboardController {
  constructor({ store, showToast, openProjectDetail }) {
    this.store = store;
    this.showToast = showToast;
    this.openProjectDetail = openProjectDetail;
    this.currentFilter = {
      search: "",
      classroom: "all",
      type: "all"
    };

    this.init();
  }

  init() {
    this.bindEvents();
    this.render();
  }

  bindEvents() {
    const searchInput = document.getElementById("scoreboard-search");
    const classFilter = document.getElementById("scoreboard-filter-class");
    const typeFilter = document.getElementById("scoreboard-filter-type");

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.currentFilter.search = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    if (classFilter) {
      classFilter.addEventListener("change", (e) => {
        this.currentFilter.classroom = e.target.value;
        this.render();
      });
    }

    if (typeFilter) {
      typeFilter.addEventListener("change", (e) => {
        this.currentFilter.type = e.target.value;
        this.render();
      });
    }
  }

  render() {
    const container = document.getElementById("scoreboard-content-area");
    if (!container) return;

    const settings = this.store.getSettings();
    const projects = this.store.getProjects();
    const isScoreboardEnabled = Boolean(settings.scoreboardEnabled);

    // อัปเดต Dropdown ห้องเรียนที่มีอยู่
    this.updateClassroomOptions(projects);

    if (!isScoreboardEnabled) {
      // โหมดปิดคะแนน: แสดงข้อความ "อยู่ในระหว่างการพิจารณา"
      container.innerHTML = `
        <div class="score-locked-banner animate-fade-in">
          <div class="lock-icon-circle">
            <i class="fas fa-hourglass-half animate-spin-slow text-warning"></i>
          </div>
          <h2 class="lock-title text-gradient">อยู่ในระหว่างการพิจารณา</h2>
          <p class="lock-subtitle">
            คณะกรรมการกำลังอยู่ระหว่างการตรวจและประเมินผลงานโครงงานตามเกณฑ์มาตรฐานการวัดและประเมินผลการเรียนรู้<br>
            ระบบจะประกาศผลการประเมินอย่างเป็นทางการเมื่อดำเนินการเสร็จสิ้นสมบูรณ์
          </p>
          <div class="lock-badges">
            <span class="badge badge-warning"><i class="fas fa-lock"></i> อยู่ในระหว่างการประเมิน</span>
            <span class="badge badge-info"><i class="fas fa-tasks"></i> ส่งผลงานแล้วทั้งหมด ${projects.length} โครงงาน</span>
          </div>

          <div class="pending-projects-preview mt-4">
            <h4 class="mb-3 text-start"><i class="fas fa-clipboard-list text-primary"></i> รายชื่อโครงงานที่ส่งเข้ารับการประเมิน</h4>
            <div class="project-grid-compact">
              ${this.renderPendingProjectList(projects)}
            </div>
          </div>
        </div>
      `;

      this.bindCardClicks(container);
      return;
    }

    // โหมดเปิดเผยคะแนน: แสดงกระดานคะแนนและสถิติเต็มรูปแบบ
    const filteredProjects = this.getFilteredProjects(projects);
    const evaluatedProjects = filteredProjects
      .filter(p => p.evaluation && p.evaluation.totalScore !== undefined)
      .sort((a, b) => (b.evaluation.totalScore || 0) - (a.evaluation.totalScore || 0));

    const pendingProjects = filteredProjects.filter(p => !p.evaluation || p.evaluation.totalScore === undefined);

    container.innerHTML = `
      <div class="scoreboard-active-wrapper animate-fade-in">
        <!-- สรุปหัวตารางและ Top 3 -->
        ${this.renderPodium(evaluatedProjects)}

        <!-- ตารางอันดับและผลคะแนนทั้งหมด -->
        <div class="scoreboard-main-card">
          <div class="card-header-bar">
            <div>
              <h3 class="card-title"><i class="fas fa-award text-warning"></i> ตารางสรุปคะแนนและผลการประเมิน</h3>
              <p class="text-sm text-muted">แสดงผลคะแนนตามเกณฑ์รูบริก 20 คะแนน (คะแนนเต็ม 20 + Bonus)</p>
            </div>
            <div class="count-badge">${evaluatedProjects.length} โครงงานที่ประเมินแล้ว</div>
          </div>

          ${evaluatedProjects.length === 0 ? `
            <div class="empty-state py-5 text-center">
              <i class="fas fa-inbox fa-3x text-muted mb-2"></i>
              <p class="text-muted">ไม่พบข้อมูลโครงงานที่ตรงกับเงื่อนไขการค้นหา</p>
            </div>
          ` : `
            <div class="table-responsive">
              <table class="table table-custom table-hover">
                <thead>
                  <tr>
                    <th class="text-center" width="70">อันดับ</th>
                    <th>ชื่อโครงงาน / ประเภท</th>
                    <th>ห้อง</th>
                    <th>สมาชิกในกลุ่ม</th>
                    <th class="text-center" width="120">คะแนนรวม</th>
                    <th class="text-center" width="120">ระดับผล</th>
                    <th class="text-center" width="100">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  ${evaluatedProjects.map((p, idx) => this.renderTableRow(p, idx + 1)).join("")}
                </tbody>
              </table>
            </div>
          `}
        </div>

        ${pendingProjects.length > 0 ? `
          <div class="pending-section mt-4">
            <h4 class="mb-3"><i class="fas fa-clock text-warning"></i> โครงงานที่รอรับการประเมิน (${pendingProjects.length})</h4>
            <div class="project-grid-compact">
              ${this.renderPendingProjectList(pendingProjects)}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    this.bindCardClicks(container);
  }

  renderPodium(projects) {
    if (projects.length === 0) return "";
    const top3 = projects.slice(0, 3);

    // เรียง podium 2 (Silver), 1 (Gold), 3 (Bronze)
    const gold = top3[0] || null;
    const silver = top3[1] || null;
    const bronze = top3[2] || null;

    return `
      <div class="podium-container mb-4">
        <!-- อันดับ 2 Silver -->
        ${silver ? `
          <div class="podium-card rank-2" data-id="${silver.id}">
            <div class="podium-crown silver"><i class="fas fa-medal"></i> อันดับ 2</div>
            <div class="podium-project-title">${this.escapeHtml(silver.title)}</div>
            <div class="podium-room text-sm">${silver.classroom || silver.gradeLevel}</div>
            <div class="podium-score text-gradient-silver">${silver.evaluation.totalScore} <span class="text-xs">คะแนน</span></div>
            <div class="podium-grade">${silver.evaluation.gradeBadge || ''}</div>
          </div>
        ` : `<div class="podium-placeholder"></div>`}

        <!-- อันดับ 1 Gold -->
        ${gold ? `
          <div class="podium-card rank-1" data-id="${gold.id}">
            <div class="podium-crown gold"><i class="fas fa-trophy"></i> อันดับ 1 ยอดเยี่ยม</div>
            <div class="podium-project-title">${this.escapeHtml(gold.title)}</div>
            <div class="podium-room text-sm">${gold.classroom || gold.gradeLevel}</div>
            <div class="podium-score text-gradient-gold">${gold.evaluation.totalScore} <span class="text-xs">คะแนน</span></div>
            <div class="podium-grade">${gold.evaluation.gradeBadge || ''}</div>
          </div>
        ` : `<div class="podium-placeholder"></div>`}

        <!-- อันดับ 3 Bronze -->
        ${bronze ? `
          <div class="podium-card rank-3" data-id="${bronze.id}">
            <div class="podium-crown bronze"><i class="fas fa-award"></i> อันดับ 3</div>
            <div class="podium-project-title">${this.escapeHtml(bronze.title)}</div>
            <div class="podium-room text-sm">${bronze.classroom || bronze.gradeLevel}</div>
            <div class="podium-score text-gradient-bronze">${bronze.evaluation.totalScore} <span class="text-xs">คะแนน</span></div>
            <div class="podium-grade">${bronze.evaluation.gradeBadge || ''}</div>
          </div>
        ` : `<div class="podium-placeholder"></div>`}
      </div>
    `;
  }

  renderTableRow(project, rank) {
    const evalData = project.evaluation;
    const typeBadge = project.type === "invention" 
      ? `<span class="badge badge-outline-primary"><i class="fas fa-microchip"></i> สิ่งประดิษฐ์</span>`
      : `<span class="badge badge-outline-success"><i class="fas fa-laptop-code"></i> แพลตฟอร์ม</span>`;

    let rankBadge = `<span class="rank-number">${rank}</span>`;
    if (rank === 1) rankBadge = `<span class="rank-badge rank-1-bg"><i class="fas fa-trophy"></i> 1</span>`;
    else if (rank === 2) rankBadge = `<span class="rank-badge rank-2-bg"><i class="fas fa-medal"></i> 2</span>`;
    else if (rank === 3) rankBadge = `<span class="rank-badge rank-3-bg"><i class="fas fa-award"></i> 3</span>`;

    const memberAvatars = (project.members || []).slice(0, 3).map(m => `
      <div class="avatar-stack-item clickable-avatar" data-photo="${m.photoUrl || ''}" data-name="${this.escapeHtml(m.title || '')}${this.escapeHtml(m.fullName)}" data-id="${m.studentId || ''}" title="คลิกดูรูป: ${m.title || ''}${m.fullName}">
        <img src="${m.photoUrl || 'assets/avatar-placeholder.svg'}" alt="${m.fullName}">
      </div>
    `).join("");

    const extraMemberCount = (project.members || []).length > 3 ? `+${(project.members || []).length - 3}` : "";

    return `
      <tr class="project-row" data-id="${project.id}">
        <td class="text-center">${rankBadge}</td>
        <td>
          <div class="font-bold text-dark">${this.escapeHtml(project.title)}</div>
          <div class="text-xs text-muted d-flex gap-2 align-items-center mt-1">
            ${typeBadge}
            ${project.titleEn ? `<span>${this.escapeHtml(project.titleEn)}</span>` : ''}
          </div>
        </td>
        <td><span class="badge badge-light">${project.classroom || project.gradeLevel || '-'}</span></td>
        <td>
          <div class="avatar-stack">
            ${memberAvatars}
            ${extraMemberCount ? `<span class="avatar-more">${extraMemberCount}</span>` : ''}
          </div>
        </td>
        <td class="text-center">
          <div class="score-pill">
            <span class="score-val">${evalData.totalScore}</span>
            <span class="score-max">/20</span>
          </div>
          ${evalData.bonusScore ? `<span class="bonus-indicator text-xs text-success">+${evalData.bonusScore} Bonus</span>` : ''}
        </td>
        <td class="text-center">
          <span class="badge ${this.getGradeBadgeClass(evalData.gradeBadge)}">${evalData.gradeBadge || '-'}</span>
        </td>
        <td class="text-center">
          <button type="button" class="btn-icon btn-view-detail" data-id="${project.id}" title="ดูรายละเอียดคะแนน">
            <i class="fas fa-chart-pie"></i>
          </button>
        </td>
      </tr>
    `;
  }

  renderPendingProjectList(projects) {
    if (projects.length === 0) {
      return `<p class="text-muted text-sm">ยังไม่มีโครงงานที่ส่งเข้ามาในขณะนี้</p>`;
    }

    return projects.map(p => {
      const isGraded = Boolean(p.status === "evaluated" && p.evaluation && p.evaluation.totalScore !== undefined);
      return `
        <div class="project-card-mini" data-id="${p.id}">
          <div class="mini-header">
            <span class="badge badge-sm ${p.type === 'invention' ? 'badge-primary' : 'badge-success'}">
              ${p.type === 'invention' ? 'สิ่งประดิษฐ์' : 'แพลตฟอร์ม'}
            </span>
            <span class="text-xs text-muted">${p.classroom || p.gradeLevel}</span>
          </div>
          <div class="mini-title">${this.escapeHtml(p.title)}</div>
          <div class="mini-members text-xs text-muted">
            <i class="fas fa-users"></i> ${(p.members || []).map(m => m.fullName).join(", ")}
          </div>
          <div class="mini-status mt-2">
            ${isGraded ? `
              <span class="badge badge-success text-xs"><i class="fas fa-check-circle"></i> ได้รับการประเมินแล้ว</span>
            ` : `
              <span class="badge badge-warning text-xs"><i class="fas fa-hourglass-start"></i> อยู่ในระหว่างการพิจารณา</span>
            `}
          </div>
        </div>
      `;
    }).join("");
  }

  bindCardClicks(container) {
    const items = container.querySelectorAll("[data-id]");
    items.forEach(el => {
      el.addEventListener("click", () => {
        const id = el.dataset.id;
        if (id && this.openProjectDetail) {
          this.openProjectDetail(id);
        }
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

  getFilteredProjects(projects) {
    return projects.filter(p => {
      const matchClass = this.currentFilter.classroom === "all" || p.classroom === this.currentFilter.classroom;
      const matchType = this.currentFilter.type === "all" || p.type === this.currentFilter.type;
      
      let matchSearch = true;
      if (this.currentFilter.search) {
        const s = this.currentFilter.search;
        const inTitle = (p.title || "").toLowerCase().includes(s);
        const inTitleEn = (p.titleEn || "").toLowerCase().includes(s);
        const inDesc = (p.description || "").toLowerCase().includes(s);
        const inMembers = (p.members || []).some(m => 
          (m.fullName || "").toLowerCase().includes(s) || 
          (m.studentId || "").toLowerCase().includes(s)
        );
        matchSearch = inTitle || inTitleEn || inDesc || inMembers;
      }

      return matchClass && matchType && matchSearch;
    });
  }

  updateClassroomOptions(projects) {
    const classFilter = document.getElementById("scoreboard-filter-class");
    if (!classFilter) return;

    const currentVal = classFilter.value;
    const classes = Array.from(new Set(projects.map(p => p.classroom).filter(Boolean))).sort();

    classFilter.innerHTML = `<option value="all">ทุกห้องเรียน</option>` +
      classes.map(c => `<option value="${c}" ${c === currentVal ? 'selected' : ''}>${c}</option>`).join("");
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
