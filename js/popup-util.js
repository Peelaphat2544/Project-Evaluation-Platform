/**
 * =========================================================================
 * POPUP & PROGRESS MODAL UTILITY
 * =========================================================================
 * 1. Global Popup Modal Dialogs (Alert & Confirm)
 * 2. Multi-Step Upload Progress Modal with Live Percentage and Animated Checklist
 */

export class Popup {
  /**
   * แสดงหน้าต่างแจ้งเตือนแบบ Popup Modal บนหน้าจอ
   * @param {Object} options 
   * @returns {Promise<void>}
   */
  static alert({ title = 'แจ้งเตือน', message = '', type = 'info', confirmText = 'ตกลง' }) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay active animate-fade-in';
      modal.style.zIndex = '9999';

      const iconMap = {
        success: { icon: 'fa-check', class: 'popup-icon-success' },
        error: { icon: 'fa-times', class: 'popup-icon-error' },
        warning: { icon: 'fa-exclamation', class: 'popup-icon-warning' },
        info: { icon: 'fa-info', class: 'popup-icon-info' }
      };

      const selected = iconMap[type] || iconMap.info;

      modal.innerHTML = `
        <div class="popup-dialog-box animate-scale-up">
          <div class="popup-icon-wrapper ${selected.class}">
            <i class="fas ${selected.icon}"></i>
          </div>
          <h3 class="popup-title">${this.escapeHtml(title)}</h3>
          <div class="popup-message">${this.escapeHtml(message)}</div>
          <div class="popup-actions">
            <button type="button" class="btn btn-primary btn-lg w-100" id="btn-popup-ok">
              ${this.escapeHtml(confirmText)}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const closeBtn = modal.querySelector('#btn-popup-ok');
      closeBtn?.addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 250);
        resolve();
      });
    });
  }

  /**
   * แสดงหน้าต่างยืนยันการทำรายการแบบ Popup Modal (แทน confirm ปกติ)
   * @param {Object} options 
   * @returns {Promise<boolean>}
   */
  static confirm({ title = 'ยืนยันการทำรายการ', message = '', confirmText = 'ยืนยัน', cancelText = 'ยกเลิก', type = 'confirm' }) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay active animate-fade-in';
      modal.style.zIndex = '9999';

      const iconClass = type === 'warning' ? 'popup-icon-warning' : 'popup-icon-confirm';
      const iconName = type === 'warning' ? 'fa-exclamation-triangle' : 'fa-question';

      modal.innerHTML = `
        <div class="popup-dialog-box animate-scale-up">
          <div class="popup-icon-wrapper ${iconClass}">
            <i class="fas ${iconName}"></i>
          </div>
          <h3 class="popup-title">${this.escapeHtml(title)}</h3>
          <div class="popup-message">${this.escapeHtml(message)}</div>
          <div class="popup-actions">
            <button type="button" class="btn btn-secondary" id="btn-popup-cancel">
              ${this.escapeHtml(cancelText)}
            </button>
            <button type="button" class="btn ${type === 'warning' ? 'btn-outline-danger' : 'btn-primary'}" id="btn-popup-confirm">
              ${this.escapeHtml(confirmText)}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const cancelBtn = modal.querySelector('#btn-popup-cancel');
      const confirmBtn = modal.querySelector('#btn-popup-confirm');

      cancelBtn?.addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 250);
        resolve(false);
      });

      confirmBtn?.addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 250);
        resolve(true);
      });
    });
  }

  /**
   * แสดงหน้าต่างแสดงรูปภาพประจำตัวขนาดใหญ่ (Image Preview Lightbox)
   * @param {Object} options
   */
  static imagePreview({ imageUrl, fallbackUrl = '', fileId = '', title = 'รูปภาพประจำตัว', subtitle = '' }) {
    const initialSrc = imageUrl || fallbackUrl || 'assets/avatar-placeholder.svg';
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active animate-fade-in';
    modal.style.zIndex = '10000';

    // สกัด File ID อัตโนมัติหากไม่ได้ส่งเข้ามา
    let effectiveFileId = fileId;
    if (!effectiveFileId && typeof imageUrl === 'string') {
      const match1 = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      const match2 = imageUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      effectiveFileId = match1 ? match1[1] : (match2 ? match2[1] : '');
    }

    modal.innerHTML = `
      <div class="modal-box animate-scale-up text-center p-3" style="max-width: 520px; width: 92%; background: white; border-radius: var(--radius-xl); box-shadow: var(--shadow-xl);">
        <div class="d-flex justify-content-between align-items-center mb-2 px-1">
          <div class="text-start">
            <h4 class="mb-0 font-bold text-dark text-sm"><i class="fas fa-id-badge text-primary"></i> ${this.escapeHtml(title)}</h4>
            ${subtitle ? `<div class="text-xs text-muted mt-1">${this.escapeHtml(subtitle)}</div>` : ''}
          </div>
          <button type="button" class="btn-close-modal" id="btn-close-image-modal" style="font-size: 1.5rem; line-height: 1; padding: 4px 8px; border: none; background: transparent; cursor: pointer;">&times;</button>
        </div>
        <div class="image-preview-container my-2" style="min-height: 240px; max-height: 65vh; overflow: hidden; border-radius: var(--radius-lg); background: #f8fafc; display: flex; align-items: center; justify-content: center; padding: 8px; position: relative;">
          <img class="preview-popup-img" src="${initialSrc}" referrerpolicy="no-referrer" alt="${this.escapeHtml(title)}" style="max-width: 100%; max-height: 60vh; object-fit: contain; border-radius: var(--radius-md); box-shadow: 0 4px 14px rgba(0,0,0,0.08); transition: opacity 0.2s ease;">
        </div>
        <div class="mt-3">
          <button type="button" class="btn btn-secondary btn-sm w-100" id="btn-close-image-footer">ปิดหน้าต่าง</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const imgEl = modal.querySelector('.preview-popup-img');
    let fallbackAttempt = 0;

    if (imgEl) {
      imgEl.onerror = () => {
        fallbackAttempt++;
        if (fallbackAttempt === 1 && effectiveFileId) {
          // สลับไปดึง thumbnail จาก Google Drive
          imgEl.src = `https://drive.google.com/thumbnail?id=${effectiveFileId}&sz=w1000`;
        } else if (fallbackAttempt === 2 && fallbackUrl && imgEl.src !== fallbackUrl) {
          // สลับไปดึงภาพ Base64 สำรอง
          imgEl.src = fallbackUrl;
        } else if (fallbackAttempt === 3 && effectiveFileId) {
          // สลับไปดึงผ่าน CDN ทางเลือก
          imgEl.src = `https://lh3.googleusercontent.com/u/0/d/${effectiveFileId}`;
        } else {
          imgEl.src = 'assets/avatar-placeholder.svg';
        }
      };
    }

    const close = () => {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 250);
    };

    modal.querySelector('#btn-close-image-modal')?.addEventListener('click', close);
    modal.querySelector('#btn-close-image-footer')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
  }

  static escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

/**
 * Multi-Step Upload Progress Modal Controller
 */
export class UploadProgressModal {
  constructor() {
    this.modalEl = null;
    this.steps = [];
  }

  /**
   * เปิด Modal พร้อมกำหนดขั้นตอนทั้งหมด
   * @param {Array<string>} stepLabels รายการข้อความของแต่ละขั้นตอน
   */
  open(stepLabels = []) {
    this.close();

    this.steps = stepLabels;
    this.modalEl = document.createElement('div');
    this.modalEl.id = 'modal-upload-stepper-progress';
    this.modalEl.className = 'modal-overlay active animate-fade-in';
    this.modalEl.style.zIndex = '9998';

    this.modalEl.innerHTML = `
      <div class="upload-modal-box animate-scale-up">
        <div class="upload-modal-header">
          <div class="popup-icon-wrapper popup-icon-info" style="width: 56px; height: 56px; font-size: 1.6rem; margin-bottom: 0.75rem;">
            <i class="fas fa-cloud-upload-alt animate-bounce"></i>
          </div>
          <h3 class="upload-modal-title">กำลังประมวลผลและอัปโหลดข้อมูล</h3>
          <p class="upload-modal-sub">กรุณารอสักครู่ ระบบกำลังจัดเก็บไฟล์เข้า Google Drive</p>
        </div>

        <!-- Progress Percentage Row -->
        <div class="progress-status-row">
          <span class="progress-current-text" id="stepper-current-msg">
            <i class="fas fa-spinner fa-spin"></i> กำลังเตรียมข้อมูล...
          </span>
          <span class="progress-percent-val" id="stepper-percent-val">0%</span>
        </div>

        <!-- Animated Progress Bar -->
        <div class="progress-container-modern">
          <div class="progress-fill-smooth" id="stepper-progress-fill" style="width: 5%;"></div>
        </div>

        <!-- Step Checklist -->
        <div class="upload-stepper-list" id="stepper-checklist-container">
          ${this.steps.map((label, idx) => `
            <div class="upload-step-item waiting" id="stepper-item-${idx}">
              <div class="step-icon-circle">
                <span class="step-num">${idx + 1}</span>
              </div>
              <div class="step-label">${this.escapeHtml(label)}</div>
              <div class="step-status-tag">รอดำเนินการ</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(this.modalEl);
  }

  /**
   * อัปเดตสถานะขั้นตอนปัจจุบัน
   * @param {number} stepIndex ดัชนีขั้นตอน (0-indexed)
   * @param {number} percent เปอร์เซ็นต์ความคืบหน้า (0-100)
   * @param {string} detailMessage ข้อความรายละเอียดที่แสดงแบบ Live
   */
  updateStep(stepIndex, percent, detailMessage = '') {
    if (!this.modalEl) return;

    // อัปเดต Progress bar & เปอร์เซ็นต์
    const fill = this.modalEl.querySelector('#stepper-progress-fill');
    const percentVal = this.modalEl.querySelector('#stepper-percent-val');
    const currentMsg = this.modalEl.querySelector('#stepper-current-msg');

    if (fill) fill.style.width = `${Math.min(100, Math.max(5, percent))}%`;
    if (percentVal) percentVal.textContent = `${Math.round(percent)}%`;
    if (currentMsg && detailMessage) {
      currentMsg.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${this.escapeHtml(detailMessage)}`;
    }

    // อัปเดตสถานะ Checklist แต่ละข้อ
    this.steps.forEach((_, idx) => {
      const item = this.modalEl.querySelector(`#stepper-item-${idx}`);
      if (!item) return;

      const iconCircle = item.querySelector('.step-icon-circle');
      const statusTag = item.querySelector('.step-status-tag');

      if (idx < stepIndex) {
        // เสร็จแล้ว
        item.className = 'upload-step-item completed';
        if (iconCircle) iconCircle.innerHTML = '<i class="fas fa-check"></i>';
        if (statusTag) statusTag.innerHTML = '<span class="text-success"><i class="fas fa-check-circle"></i> เรียบร้อย</span>';
      } else if (idx === stepIndex) {
        // กำลังดำเนินการ
        item.className = 'upload-step-item in-progress';
        if (iconCircle) iconCircle.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        if (statusTag) statusTag.innerHTML = '<span class="text-primary font-bold">กำลังดำเนินการ...</span>';
      } else {
        // รอคิว
        item.className = 'upload-step-item waiting';
        if (iconCircle) iconCircle.textContent = idx + 1;
        if (statusTag) statusTag.textContent = 'รอดำเนินการ';
      }
    });
  }

  /**
   * ปิด Modal
   */
  close() {
    const existing = document.getElementById('modal-upload-stepper-progress');
    if (existing) {
      existing.classList.remove('active');
      setTimeout(() => existing.remove(), 250);
    }
    this.modalEl = null;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
