/**
 * Export Utility: ส่งออกข้อมูลคะแนนโครงงานเป็น Excel/CSV และพิมพ์รายงานสรุปผล
 */

export class ExportUtil {
  /**
   * ส่งออกคะแนนและรายชื่อนักเรียนเป็นไฟล์ CSV (รองรับภาษาไทยสำหรับ Excel ด้วย UTF-8 BOM)
   */
  static exportToCSV(projects, settings) {
    const headers = [
      "ลำดับ",
      "รหัสโครงงาน",
      "ชื่อโครงงาน (ภาษาไทย)",
      "ชื่อโครงงาน (ภาษาอังกฤษ)",
      "ประเภทโครงงาน",
      "ระดับชั้น/ห้อง",
      "จำนวนสมาชิก",
      "รายชื่อสมาชิก (รหัส-ชื่อ-เลขที่)",
      "สถานะการประเมิน",
      "1. ด้านผลิตภัณฑ์และเทคโนโลยี (เต็ม 4)",
      "2. ด้านผลกระทบและการแก้ปัญหา (เต็ม 4)",
      "3. ด้านเล่มโครงงาน (เต็ม 4)",
      "4. ด้านการนำเสนอและตอบคำถาม (เต็ม 4)",
      "5. ด้านการทำงานเป็นทีม (เต็ม 4)",
      "คะแนนพิเศษจิตวิญญาณนวัตกร (Bonus)",
      "คะแนนรวม (เต็ม 20+)",
      "ระดับผลการประเมิน",
      "ข้อเสนอแนะจากครูผู้ประเมิน",
      "ลิงก์เล่มรายงาน (Google Drive)",
      "ลิงก์สื่อนำเสนอ (Google Drive)",
      "วันที่ส่งข้อมูล"
    ];

    const rows = projects.map((p, idx) => {
      const evalData = p.evaluation || {};
      const scores = evalData.scores || {};
      
      const memberList = (p.members || []).map(m => 
        `${m.title || ''}${m.fullName} (${m.studentId || '-'} เลขที่ ${m.number || '-'})`
      ).join("; ");

      const typeThai = p.type === 'invention' ? 'สิ่งประดิษฐ์' : 'แพลตฟอร์ม/ซอฟต์แวร์';
      const statusThai = p.status === 'evaluated' ? 'ประเมินแล้ว' : 'รอการประเมิน';

      return [
        idx + 1,
        `"${p.id || ''}"`,
        `"${(p.title || '').replace(/"/g, '""')}"`,
        `"${(p.titleEn || '').replace(/"/g, '""')}"`,
        `"${typeThai}"`,
        `"${p.classroom || p.gradeLevel || '-'}"`,
        (p.members || []).length,
        `"${memberList.replace(/"/g, '""')}"`,
        `"${statusThai}"`,
        scores.product_tech !== undefined ? scores.product_tech : "-",
        scores.impact_problem !== undefined ? scores.impact_problem : "-",
        scores.project_report !== undefined ? scores.project_report : "-",
        scores.presentation_qa !== undefined ? scores.presentation_qa : "-",
        scores.teamwork_responsibility !== undefined ? scores.teamwork_responsibility : "-",
        evalData.bonusScore !== undefined ? evalData.bonusScore : 0,
        evalData.totalScore !== undefined ? evalData.totalScore : "-",
        `"${evalData.gradeBadge || '-'}"`,
        `"${(evalData.feedback || '').replace(/"/g, '""')}"`,
        `"${p.reportFile?.viewUrl || p.reportFile?.directViewUrl || ''}"`,
        `"${p.slideFile?.viewUrl || p.slideFile?.directViewUrl || ''}"`,
        `"${new Date(p.createdAt).toLocaleDateString('th-TH')}"`
      ].join(",");
    });

    // เพิ่ม UTF-8 BOM (\uFEFF) เพื่อให้ Microsoft Excel เปิดภาษาไทยได้โดยไม่เป็นภาษาต่างดาว
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    const now = new Date();
    const dateStr = `${now.getFullYear()+543}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    link.setAttribute("href", url);
    link.setAttribute("download", `สรุปผลการประเมินโครงงาน_${settings?.subjectName || 'นวัตกรรม'}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * พิมพ์ใบคะแนน / รายงานสรุปผล
   */
  static printReport(projects, settings) {
    window.print();
  }
}
