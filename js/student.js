import { Popup, UploadProgressModal } from "./popup-util.js";

/**
 * Student Controller: จัดการแบบฟอร์มส่งโครงงานและแก้ไขข้อมูลโดยนักเรียน
 */

export class StudentController {
  constructor({ store, gdriveService, showToast, navigateTo }) {
    this.store = store;
    this.gdrive = gdriveService;
    this.showToast = showToast;
    this.navigateTo = navigateTo;
    this.currentEditingProjectId = null;
    this.uploadedFiles = {
      report: null,
      presentation: null
    };
    this.memberPhotos = {}; // index -> file/url object
    this.progressModal = new UploadProgressModal();

    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    // ฟอร์มส่งโครงงาน
    const form = document.getElementById("student-project-form");
    if (form) {
      form.addEventListener("submit", (e) => this.handleSubmit(e));
    }

    // ปุ่มเพิ่มสมาชิก
    const addMemberBtn = document.getElementById("btn-add-member");
    if (addMemberBtn) {
      addMemberBtn.addEventListener("click", () => this.addMemberRow());
    }

    // ปุ่มยกเลิก/ล้างฟอร์ม
    const resetBtn = document.getElementById("btn-reset-form");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => this.resetForm());
    }

    // Drag & Drop / File inputs สำหรับเล่มและสไลด์
    this.setupFileInput("report-file-input", "report-file-preview", "report");
    this.setupFileInput("slide-file-input", "slide-file-preview", "presentation");
  }

  setupFileInput(inputId, previewId, type) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;

    input.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        // ตรวจสอบขนาดไฟล์ไม่เกิน 50MB
        if (file.size > 50 * 1024 * 1024) {
          this.showToast("ขนาดไฟล์ต้องไม่เกิน 50 MB", "error");
          input.value = "";
          return;
        }

        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        this.uploadedFiles[type] = {
          file: file,
          originalName: file.name,
          sizeText: `${sizeMB} MB`
        };

        preview.innerHTML = `
          <div class="file-badge">
            <i class="fas ${type === 'report' ? 'fa-file-pdf text-danger' : 'fa-file-powerpoint text-warning'}"></i>
            <div class="file-info">
              <span class="file-name">${this.escapeHtml(file.name)}</span>
              <span class="file-size">${sizeMB} MB (พร้อมส่งเข้า Google Drive)</span>
            </div>
            <button type="button" class="btn-remove-file" data-type="${type}">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `;

        preview.querySelector(".btn-remove-file")?.addEventListener("click", () => {
          this.uploadedFiles[type] = null;
          input.value = "";
          preview.innerHTML = "";
        });
      }
    });
  }

  addMemberRow(data = null) {
    const container = document.getElementById("members-container");
    if (!container) return;

    const memberIndex = container.children.length;
    const memberId = `member_${Date.now()}_${memberIndex}`;

    const memberEl = document.createElement("div");
    memberEl.className = "member-card animate-fade-in";
    memberEl.id = memberId;
    memberEl.dataset.index = memberIndex;

    const defaultTitle = data?.title || "นาย";
    const fullName = data?.fullName || "";
    const studentId = data?.studentId || "";
    const grade = data?.grade || "ม.5";
    const room = data?.room || "1";
    const number = data?.number || "";
    const role = data?.role || "";
    const photoUrl = data?.photoUrl || "";

    memberEl.innerHTML = `
      <div class="member-card-header">
        <div class="member-order"><i class="fas fa-user-graduate"></i> สมาชิกคนที่ <span class="member-num">${memberIndex + 1}</span></div>
        ${memberIndex > 0 ? `<button type="button" class="btn-icon btn-delete-member" title="ลบสมาชิกคนนี้"><i class="fas fa-trash-alt"></i></button>` : ''}
      </div>
      
      <div class="member-grid">
        <div class="member-photo-col">
          <div class="photo-uploader" id="photo-box-${memberIndex}">
            <img src="${photoUrl || 'assets/avatar-placeholder.svg'}" class="avatar-preview ${!photoUrl ? 'd-none' : ''}" id="avatar-img-${memberIndex}" alt="รูปประจำตัว">
            <div class="photo-placeholder ${photoUrl ? 'd-none' : ''}" id="avatar-placeholder-${memberIndex}">
              <i class="fas fa-camera"></i>
              <span>อัปโหลดรูป</span>
            </div>
            <input type="file" accept="image/*" class="photo-file-input" id="photo-input-${memberIndex}" data-index="${memberIndex}">
          </div>
          <div class="photo-hint">รูปถ่ายหน้าตรง/ชุดนักเรียน</div>
        </div>

        <div class="member-fields-col">
          <div class="form-row form-row-3">
            <div class="form-group">
              <label>คำนำหน้า <span class="required">*</span></label>
              <select class="form-control member-title" required>
                <option value="นาย" ${defaultTitle === 'นาย' ? 'selected' : ''}>นาย</option>
                <option value="นางสาว" ${defaultTitle === 'นางสาว' ? 'selected' : ''}>นางสาว</option>
                <option value="เด็กชาย" ${defaultTitle === 'เด็กชาย' ? 'selected' : ''}>เด็กชาย</option>
                <option value="เด็กหญิง" ${defaultTitle === 'เด็กหญิง' ? 'selected' : ''}>เด็กหญิง</option>
                <option value="อื่นๆ" ${defaultTitle === 'อื่นๆ' ? 'selected' : ''}>อื่นๆ</option>
              </select>
            </div>
            <div class="form-group span-2">
              <label>ชื่อ - นามสกุล <span class="required">*</span></label>
              <input type="text" class="form-control member-name" placeholder="เช่น ภูมิพัฒน์ รักการเรียน" value="${this.escapeHtml(fullName)}" required>
            </div>
          </div>

          <div class="form-row form-row-4">
            <div class="form-group">
              <label>รหัสนักเรียน <span class="required">*</span></label>
              <input type="text" class="form-control member-id" placeholder="เช่น 45001" value="${this.escapeHtml(studentId)}" required>
            </div>
            <div class="form-group">
              <label>ระดับชั้น <span class="required">*</span></label>
              <select class="form-control member-grade" required>
                <option value="ม.1" ${grade === 'ม.1' ? 'selected' : ''}>ม.1</option>
                <option value="ม.2" ${grade === 'ม.2' ? 'selected' : ''}>ม.2</option>
                <option value="ม.3" ${grade === 'ม.3' ? 'selected' : ''}>ม.3</option>
                <option value="ม.4" ${grade === 'ม.4' ? 'selected' : ''}>ม.4</option>
                <option value="ม.5" ${grade === 'ม.5' ? 'selected' : ''}>ม.5</option>
                <option value="ม.6" ${grade === 'ม.6' ? 'selected' : ''}>ม.6</option>
              </select>
            </div>
            <div class="form-group">
              <label>ห้อง <span class="required">*</span></label>
              <input type="text" class="form-control member-room" placeholder="เช่น 1 หรือ 5/1" value="${this.escapeHtml(room)}" required>
            </div>
            <div class="form-group">
              <label>เลขที่ <span class="required">*</span></label>
              <input type="number" min="1" max="99" class="form-control member-number" placeholder="เช่น 5" value="${this.escapeHtml(number)}" required>
            </div>
          </div>

          <div class="form-group">
            <label>หน้าที่/บทบาทในโครงงาน</label>
            <input type="text" class="form-control member-role" placeholder="เช่น หัวหน้าทีม, พัฒนาซอฟต์แวร์, จัดทำรูปเล่ม" value="${this.escapeHtml(role)}">
          </div>
        </div>
      </div>
    `;

    container.appendChild(memberEl);

    // Bind ลบสมาชิก
    const deleteBtn = memberEl.querySelector(".btn-delete-member");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        memberEl.remove();
        this.renumberMembers();
      });
    }

    // Bind อัปโหลดรูป
    const photoInput = memberEl.querySelector(`#photo-input-${memberIndex}`);
    const photoPlaceholder = memberEl.querySelector(`#avatar-placeholder-${memberIndex}`);
    const avatarImg = memberEl.querySelector(`#avatar-img-${memberIndex}`);

    if (data?.photoUrl) {
      this.memberPhotos[memberIndex] = { existingUrl: data.photoUrl };
    }

    if (avatarImg) {
      avatarImg.style.cursor = "pointer";
      avatarImg.title = "คลิกเพื่อดูรูปภาพขนาดใหญ่";
      avatarImg.addEventListener("click", (e) => {
        if (avatarImg.src && !avatarImg.src.includes("placeholder") && !avatarImg.classList.contains("d-none")) {
          e.stopPropagation();
          const nameVal = memberEl.querySelector(".member-name")?.value || "สมาชิก";
          const idVal = memberEl.querySelector(".member-id")?.value || "";
          Popup.imagePreview({
            imageUrl: avatarImg.src,
            title: nameVal,
            subtitle: idVal ? `รหัสนักเรียน: ${idVal}` : ""
          });
        }
      });
    }

    if (photoInput) {
      photoInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          if (file.size > 10 * 1024 * 1024) {
            this.showToast("ขนาดรูปภาพต้องไม่เกิน 10 MB", "error");
            return;
          }
          this.memberPhotos[memberIndex] = { file: file };
          const reader = new FileReader();
          reader.onload = (ev) => {
            avatarImg.src = ev.target.result;
            avatarImg.classList.remove("d-none");
            photoPlaceholder.classList.add("d-none");
          };
          reader.readAsDataURL(file);
        }
      });
    }
  }

  renumberMembers() {
    const container = document.getElementById("members-container");
    if (!container) return;
    const cards = container.querySelectorAll(".member-card");
    cards.forEach((card, idx) => {
      const numSpan = card.querySelector(".member-num");
      if (numSpan) numSpan.textContent = idx + 1;
      card.dataset.index = idx;
    });
  }

  async handleSubmit(e) {
    e.preventDefault();

    const title = document.getElementById("proj-title")?.value.trim();
    const titleEn = document.getElementById("proj-title-en")?.value.trim() || "";
    const type = document.getElementById("proj-type")?.value || "invention";
    const description = document.getElementById("proj-desc")?.value.trim() || "";
    const gradeLevel = document.getElementById("proj-grade-level")?.value || "ม.5";
    let classroomInput = document.getElementById("proj-classroom")?.value.trim() || "";
    const demoUrl = document.getElementById("proj-demo-url")?.value.trim() || "";
    const githubUrl = document.getElementById("proj-github-url")?.value.trim() || "";

    // ปรับรูปแบบห้องเรียน เช่น ถ้ากรอก 1 ให้กลายเป็น ม.5/1
    let classroom = classroomInput;
    if (classroom && !classroom.includes("/") && !classroom.startsWith("ม.")) {
      classroom = `${gradeLevel}/${classroom}`;
    }

    if (!title) {
      await Popup.alert({
        title: "กรุณากรอกข้อมูล",
        message: "กรุณาระบุชื่อโครงงาน (ภาษาไทย) ก่อนดำเนินการต่อ",
        type: "warning"
      });
      return;
    }

    if (!classroomInput) {
      await Popup.alert({
        title: "กรุณากรอกข้อมูล",
        message: "กรุณาระบุห้องเรียน (เช่น 1 หรือ ม.5/1)",
        type: "warning"
      });
      return;
    }

    // รวบรวมข้อมูลสมาชิก
    const memberCards = document.querySelectorAll("#members-container .member-card");
    if (memberCards.length === 0) {
      await Popup.alert({
        title: "กรุณาระบุสมาชิก",
        message: "กรุณาระบุข้อมูลผู้จัดทำโครงงานอย่างน้อย 1 คน",
        type: "warning"
      });
      return;
    }

    const members = [];
    for (let i = 0; i < memberCards.length; i++) {
      const card = memberCards[i];
      const titleVal = card.querySelector(".member-title")?.value || "นาย";
      const nameVal = card.querySelector(".member-name")?.value.trim();
      const studentIdVal = card.querySelector(".member-id")?.value.trim();
      const gradeVal = card.querySelector(".member-grade")?.value || "ม.5";
      const roomVal = card.querySelector(".member-room")?.value.trim();
      const numVal = card.querySelector(".member-number")?.value.trim();
      const roleVal = card.querySelector(".member-role")?.value.trim() || "";

      if (!nameVal || !studentIdVal) {
        await Popup.alert({
          title: "ข้อมูลสมาชิกไม่ครบถ้วน",
          message: `กรุณากรอกชื่อและรหัสนักเรียนของสมาชิกคนที่ ${i + 1} ให้ครบถ้วนสมบูรณ์`,
          type: "warning"
        });
        return;
      }

      members.push({
        id: `m_${Date.now()}_${i}`,
        title: titleVal,
        fullName: nameVal,
        studentId: studentIdVal,
        grade: gradeVal,
        room: roomVal,
        number: numVal,
        role: roleVal,
        photoIndex: parseInt(card.dataset.index, 10)
      });
    }

    // ตรวจสอบไฟล์แนบสำหรับโครงงานใหม่
    if (!this.existingProject) {
      if (!this.uploadedFiles.report?.file) {
        await Popup.alert({
          title: "กรุณาแนบเอกสาร",
          message: "กรุณาเลือกไฟล์เล่มรายงานโครงงานฉบับสมบูรณ์ (PDF หรือ Word)",
          type: "warning"
        });
        return;
      }

      if (!this.uploadedFiles.presentation?.file) {
        await Popup.alert({
          title: "กรุณาแนบสื่อนำเสนอ",
          message: "กรุณาเลือกไฟล์สื่อประกอบการนำเสนอ (PPTX หรือ PDF)",
          type: "warning"
        });
        return;
      }
    }

    // กำหนดรายการขั้นตอนสำหรับ Progress Bar Stepper
    const steps = [
      "ตรวจสอบความถูกต้องของข้อมูลโครงงานและสมาชิก",
      "อัปโหลดเล่มรายงานโครงงานเข้าสู่ Google Drive",
      "อัปโหลดสื่อนำเสนอโครงงานเข้าสู่ Google Drive",
      "อัปโหลดรูปประจำตัวสมาชิกเข้าสู่ Google Drive",
      "บันทึกข้อมูลโครงงานลงสู่ระบบและจัดสรรรหัส Passcode"
    ];

    const submitBtn = document.getElementById("btn-submit-project");
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> กำลังดำเนินการ...`;

    // เปิด Modal Process Bar
    this.progressModal.open(steps);
    this.progressModal.updateStep(0, 10, "กำลังตรวจสอบข้อมูลโครงงาน...");

    try {
      await new Promise(r => setTimeout(r, 400));
      this.progressModal.updateStep(0, 20, "ตรวจสอบข้อมูลถูกต้องเรียบร้อย");

      let reportFileRecord = this.existingProject?.reportFile || null;
      let slideFileRecord = this.existingProject?.slideFile || null;

      // ขั้นตอนที่ 2: อัปโหลดไฟล์เล่มรายงาน (โฟลเดอร์: เล่มรายงานโครงงาน)
      if (this.uploadedFiles.report?.file) {
        this.progressModal.updateStep(1, 30, `กำลังส่งไฟล์เล่มรายงาน: ${this.uploadedFiles.report.file.name}...`);
        const res = await this.gdrive.uploadFile({
          file: this.uploadedFiles.report.file,
          type: "report",
          projectName: title,
          onProgress: (p) => this.progressModal.updateStep(1, 40, p.message)
        });
        reportFileRecord = {
          fileId: res.fileId,
          fileName: res.fileName,
          folderName: res.folderName,
          viewUrl: res.viewUrl || res.directViewUrl,
          directViewUrl: res.directViewUrl,
          downloadUrl: res.downloadUrl,
          sizeText: this.uploadedFiles.report.sizeText
        };
        this.progressModal.updateStep(1, 45, `บันทึกเล่มรายงานเข้าโฟลเดอร์ "${res.folderName}" สำเร็จ`);
      } else {
        this.progressModal.updateStep(1, 45, "ใช้ไฟล์เล่มรายงานเดิมในระบบ");
      }

      // ขั้นตอนที่ 3: อัปโหลดไฟล์สไลด์นำเสนอ (โฟลเดอร์: สื่อนำเสนอโครงงาน)
      if (this.uploadedFiles.presentation?.file) {
        this.progressModal.updateStep(2, 55, `กำลังส่งไฟล์สื่อนำเสนอ: ${this.uploadedFiles.presentation.file.name}...`);
        const res = await this.gdrive.uploadFile({
          file: this.uploadedFiles.presentation.file,
          type: "presentation",
          projectName: title,
          onProgress: (p) => this.progressModal.updateStep(2, 65, p.message)
        });
        slideFileRecord = {
          fileId: res.fileId,
          fileName: res.fileName,
          folderName: res.folderName,
          viewUrl: res.viewUrl || res.directViewUrl,
          directViewUrl: res.directViewUrl,
          downloadUrl: res.downloadUrl,
          sizeText: this.uploadedFiles.presentation.sizeText
        };
        this.progressModal.updateStep(2, 70, `บันทึกสื่อนำเสนอเข้าโฟลเดอร์ "${res.folderName}" สำเร็จ`);
      } else {
        this.progressModal.updateStep(2, 70, "ใช้ไฟล์สื่อนำเสนอเดิมในระบบ");
      }

      // ขั้นตอนที่ 4: อัปโหลดรูปประจำตัวสมาชิกแต่ละคน (โฟลเดอร์: รูปภาพสมาชิกและโครงงาน)
      this.progressModal.updateStep(3, 75, "กำลังเตรียมอัปโหลดรูปประจำตัวสมาชิก...");
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        const photoInfo = this.memberPhotos[m.photoIndex];
        const currentMemberPercent = 75 + Math.round(((i + 1) / members.length) * 15);

        if (photoInfo?.file) {
          this.progressModal.updateStep(3, currentMemberPercent, `กำลังอัปโหลดรูปถ่ายของ: ${m.fullName}...`);
          const res = await this.gdrive.uploadFile({
            file: photoInfo.file,
            type: "photo",
            projectName: title,
            studentName: m.fullName,
            studentId: m.studentId,
            onProgress: (p) => this.progressModal.updateStep(3, currentMemberPercent, p.message)
          });
          m.photoUrl = res.thumbnailLink || res.viewUrl;
          m.photoFileId = res.fileId;
        } else if (photoInfo?.existingUrl) {
          m.photoUrl = photoInfo.existingUrl;
          m.photoFileId = photoInfo.existingFileId || "";
        } else {
          m.photoUrl = "";
          m.photoFileId = "";
        }
        delete m.photoIndex;
      }
      this.progressModal.updateStep(3, 90, "อัปโหลดรูปสมาชิกเรียบร้อยแล้ว");

      // ขั้นตอนที่ 5: บันทึกลง Store (Firestore / LocalStorage)
      this.progressModal.updateStep(4, 95, "กำลังบันทึกข้อมูลโครงงานลงฐานข้อมูล...");
      const projectPayload = {
        id: this.currentEditingProjectId || undefined,
        title: title,
        titleEn: titleEn,
        type: type,
        description: description,
        classroom: classroom,
        gradeLevel: members[0]?.grade || "ม.5",
        demoUrl: demoUrl,
        githubUrl: githubUrl,
        reportFile: reportFileRecord,
        slideFile: slideFileRecord,
        members: members,
        passcode: this.existingProject?.passcode || undefined,
        evaluation: this.existingProject?.evaluation || null,
        status: this.existingProject?.status || "pending"
      };

      const savedProject = await this.store.saveProject(projectPayload);

      // เสร็จสมบูรณ์ 100%
      this.progressModal.updateStep(5, 100, "บันทึกและส่งผลงานโครงงานเสร็จสิ้นสมบูรณ์!");
      await new Promise(r => setTimeout(r, 600));

      this.progressModal.close();
      this.showSuccessSubmitModal(savedProject);
      this.resetForm();

    } catch (err) {
      console.error("Submit project error:", err);
      this.progressModal.close();
      await Popup.alert({
        title: "เกิดข้อผิดพลาด",
        message: `ไม่สามารถบันทึกข้อมูลได้: ${err.message}`,
        type: "error"
      });
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  }

  showSuccessSubmitModal(project) {
    let modal = document.getElementById("modal-submit-success");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modal-submit-success";
      modal.className = "modal-overlay active";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-box text-center animate-scale-up">
        <div class="success-icon-badge mb-3">
          <i class="fas fa-check-circle fa-4x text-success"></i>
        </div>
        <h3 class="mb-2">ส่งผลงานโครงงานสำเร็จแล้ว</h3>
        <p class="text-muted mb-4">ข้อมูลและเอกสารรายงานของท่านถูกบันทึกเข้าสู่ระบบเรียบร้อยแล้ว</p>

        <div class="passcode-card mb-4">
          <div class="text-xs text-muted mb-1"><i class="fas fa-key"></i> รหัสสำหรับการแก้ไขข้อมูลโครงงาน (Passcode)</div>
          <div class="passcode-display">${project.passcode}</div>
          <div class="text-xs text-danger mt-1">* กรุณาจดจำหรือบันทึกรหัสนี้ไว้สำหรับเข้าแก้ไขข้อมูลผลงานในอนาคต</div>
        </div>

        <div class="d-flex gap-2 justify-content-center">
          <button type="button" class="btn btn-secondary" id="btn-done-stay">ส่งผลงานอื่นเพิ่มเติม</button>
          <button type="button" class="btn btn-primary" id="btn-done-view">ดูประกาศผลการประเมิน</button>
        </div>
      </div>
    `;

    modal.classList.add("active");

    modal.querySelector("#btn-done-stay")?.addEventListener("click", () => {
      modal.classList.remove("active");
    });

    modal.querySelector("#btn-done-view")?.addEventListener("click", () => {
      modal.classList.remove("active");
      if (this.navigateTo) this.navigateTo("scoreboard");
    });
  }

  loadProjectForEdit(project) {
    if (!project) return;
    this.currentEditingProjectId = project.id;
    this.existingProject = project;

    const titleInput = document.getElementById("proj-title");
    const titleEnInput = document.getElementById("proj-title-en");
    const typeSelect = document.getElementById("proj-type");
    const descInput = document.getElementById("proj-desc");
    const gradeSelect = document.getElementById("proj-grade-level");
    const classInput = document.getElementById("proj-classroom");
    const demoInput = document.getElementById("proj-demo-url");
    const githubInput = document.getElementById("proj-github-url");
    const formTitle = document.getElementById("form-heading-title");

    if (formTitle) formTitle.innerHTML = `<i class="fas fa-edit text-warning"></i> แก้ไขข้อมูลโครงงาน: <span class="text-primary">${this.escapeHtml(project.title)}</span>`;
    if (titleInput) titleInput.value = project.title || "";
    if (titleEnInput) titleEnInput.value = project.titleEn || "";
    if (typeSelect) typeSelect.value = project.type || "invention";
    if (descInput) descInput.value = project.description || "";
    if (gradeSelect) gradeSelect.value = project.gradeLevel || "ม.5";
    if (classInput) {
      let r = project.classroom || "";
      if (project.gradeLevel && r.startsWith(project.gradeLevel + "/")) {
        r = r.substring((project.gradeLevel + "/").length);
      }
      classInput.value = r || project.classroom || "";
    }
    if (demoInput) demoInput.value = project.demoUrl || "";
    if (githubInput) githubInput.value = project.githubUrl || "";

    // แสดงไฟล์เล่มรายงานเดิม
    const reportPreview = document.getElementById("report-file-preview");
    if (reportPreview && project.reportFile) {
      reportPreview.innerHTML = `
        <div class="file-badge">
          <i class="fas fa-file-pdf text-danger"></i>
          <div class="file-info">
            <span class="file-name">${this.escapeHtml(project.reportFile.fileName || 'ไฟล์เล่มรายงานเดิม')}</span>
            <span class="file-size text-success"><i class="fab fa-google-drive"></i> อยู่บน Google Drive แล้ว (ไม่ต้องเลือกใหม่หากไม่เปลี่ยน)</span>
          </div>
        </div>
      `;
    }

    // แสดงไฟล์สื่อนำเสนอเดิม
    const slidePreview = document.getElementById("slide-file-preview");
    if (slidePreview && project.slideFile) {
      slidePreview.innerHTML = `
        <div class="file-badge">
          <i class="fas fa-file-powerpoint text-warning"></i>
          <div class="file-info">
            <span class="file-name">${this.escapeHtml(project.slideFile.fileName || 'ไฟล์สื่อนำเสนอเดิม')}</span>
            <span class="file-size text-success"><i class="fab fa-google-drive"></i> อยู่บน Google Drive แล้ว (ไม่ต้องเลือกใหม่หากไม่เปลี่ยน)</span>
          </div>
        </div>
      `;
    }

    // โหลดสมาชิกทั้งหมดเดิมครบถ้วน (ชื่อ, รหัส, ห้อง, เลขที่, รูปถ่าย)
    const container = document.getElementById("members-container");
    if (container) {
      container.innerHTML = "";
      this.memberPhotos = {};
      if (project.members && project.members.length > 0) {
        project.members.forEach(m => this.addMemberRow(m));
      } else {
        this.addMemberRow();
      }
    }

    // เลื่อนหน้าจอขึ้นมาที่หัวข้อฟอร์มแก้ไข
    setTimeout(() => {
      const heading = document.getElementById("form-heading-title") || document.getElementById("student-project-form");
      if (heading) heading.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);

    this.showToast("โหลดข้อมูลเดิมของโครงงานเรียบร้อยแล้ว", "info");
  }

  resetForm() {
    this.currentEditingProjectId = null;
    this.existingProject = null;
    this.uploadedFiles = { report: null, presentation: null };
    this.memberPhotos = {};

    const form = document.getElementById("student-project-form");
    if (form) form.reset();

    const formTitle = document.getElementById("form-heading-title");
    if (formTitle) formTitle.innerHTML = `<i class="fas fa-plus-circle text-primary"></i> เพิ่มข้อมูลโครงงานใหม่`;

    const reportPreview = document.getElementById("report-file-preview");
    if (reportPreview) reportPreview.innerHTML = "";

    const slidePreview = document.getElementById("slide-file-preview");
    if (slidePreview) slidePreview.innerHTML = "";

    const container = document.getElementById("members-container");
    if (container) {
      container.innerHTML = "";
      // เพิ่มสมาชิกแถวแรกให้อัตโนมัติ
      this.addMemberRow();
    }
  }

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
