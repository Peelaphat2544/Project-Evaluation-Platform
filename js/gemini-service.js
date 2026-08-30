/**
 * GeminiService: จัดการการเชื่อมต่อกับ Google Gemini API
 * สำหรับให้ AI ทำหน้าที่ประเมินโครงงานตาม Rubric เสมือนศาสตราจารย์มหาวิทยาลัย
 */

export class GeminiService {
  constructor() {
    this.apiKey = localStorage.getItem('gemini_api_key') || '';
    this.model = localStorage.getItem('gemini_model') || 'gemini-3.7-flash';
  }

  setApiKey(key) {
    this.apiKey = key;
    localStorage.setItem('gemini_api_key', key);
  }

  getApiKey() {
    return this.apiKey;
  }

  setModel(model) {
    this.model = model;
    localStorage.setItem('gemini_model', model);
  }

  getModel() {
    return this.model;
  }

  /**
   * แปลง File Object เป็น Base64 String สำหรับส่ง API
   * @param {File} file 
   * @returns {Promise<string>} Base64 data (without data:MIME prefix)
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // reader.result is something like "data:application/pdf;base64,JVBERi..."
        const base64Data = reader.result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  /**
   * ส่งไฟล์และข้อมูลไปให้ Gemini ประเมิน
   */
  async evaluateProject(projectTitle, projectType, files) {
    if (!this.apiKey) {
      throw new Error('กรุณาระบุ Gemini API Key ก่อนทำการตรวจสอบ');
    }

    if (!files || files.length === 0) {
      throw new Error('กรุณาอัปโหลดไฟล์รายงานหรือสไลด์อย่างน้อย 1 ไฟล์');
    }

    const inlineDataParts = [];

    // อ่านไฟล์ทั้งหมดเป็น Base64
    for (const file of files) {
      // ตรวจสอบ MIME Type (แนะนำให้เป็น PDF)
      let mimeType = file.type;
      if (!mimeType) {
        // fallback สำหรับ PDF ถ้าหา type ไม่เจอ
        mimeType = file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain';
      }

      const base64Data = await this.fileToBase64(file);
      inlineDataParts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      });
    }

    // สร้าง System Prompt โดยอิงจากเกณฑ์ Rubric
    const systemPrompt = `
คุณคือศาสตราจารย์มหาวิทยาลัยผู้เชี่ยวชาญด้านนวัตกรรมและเทคโนโลยี 
หน้าที่ของคุณคือ "ประเมินผลงานโครงงานของนักเรียน" จากไฟล์เอกสารรายงานหรือสไลด์ที่แนบมาให้ 
ชื่อโครงงาน: "${projectTitle}" 
ประเภทโครงงาน: "${projectType === 'invention' ? 'สิ่งประดิษฐ์ (Hardware/Device/STEM)' : 'แพลตฟอร์ม/ซอฟต์แวร์ (Web/Mobile/AI)'}"

จงประเมินและให้คะแนนตามเกณฑ์ (Rubric) 5 ด้าน ด้านละ 4 คะแนน (รวม 20 คะแนน) ดังนี้:
1. ด้านผลิตภัณฑ์และเทคโนโลยี (Product & Technology): ใช้งานได้จริง มีความปลอดภัย/เสถียร ใช้ความรู้เหมาะสม
2. ด้านผลกระทบและการแก้ปัญหา (Impact & Problem Solving): ระบุปัญหาชัดเจน แก้ปัญหาได้จริง มีประโยชน์ต่อสังคม
3. ด้านเล่มโครงงาน (Project Report): ความครบถ้วน ความเป็นระเบียบ การอ้างอิง และสะท้อนกระบวนการทำงาน
4. ด้านการนำเสนอ (Presentation): เนื้อหาชัดเจน เข้าใจง่าย สื่อประกอบดี (อิงจากสไลด์/ไฟล์ที่แนบ)
5. ด้านกระบวนการทำงานเป็นทีม (Teamwork): ประเมินจากร่องรอยการแบ่งงานหรือการทำงานในเล่ม

กฎการให้คะแนนแต่ละด้าน:
- 4 คะแนน (ดีเยี่ยม): สมบูรณ์แบบ ยอดเยี่ยมมาก
- 3 คะแนน (ดี): ดีแต่มีข้อบกพร่องเล็กน้อย
- 2 คะแนน (พอใช้): ขาดองค์ประกอบบางส่วน หรือยังไม่สมบูรณ์
- 1 คะแนน (ปรับปรุง): ไม่ตรงประเด็น ขาดความสมบูรณ์อย่างมาก หรือหาข้อมูลไม่พบในไฟล์

สิ่งที่คุณต้องตอบกลับ:
คุณต้องตอบกลับเป็น 형식 JSON เท่านั้น (ห้ามมี markdown หรือข้อความอื่นนอก JSON) โดยมีโครงสร้างดังนี้:
{
  "scores": {
    "product": <คะแนน 1-4>,
    "impact": <คะแนน 1-4>,
    "report": <คะแนน 1-4>,
    "presentation": <คะแนน 1-4>,
    "teamwork": <คะแนน 1-4>
  },
  "total_score": <คะแนนรวม>,
  "feedback_positive": "<ข้อเสนอแนะเชิงบวก ชื่นชมจุดเด่นของโครงงานนี้ เขียนอธิบายเหมือนอาจารย์ชมลูกศิษย์>",
  "feedback_negative": "<ข้อเสนอแนะเชิงลบ หรือข้อบกพร่องที่พบในโครงงาน ชี้จุดอ่อนที่ควรระวัง>",
  "improvement_suggestions": "<คำแนะนำในการพัฒนาต่อยอด (Growth Mindset) เพื่อให้นักเรียนนำไปปรับปรุง>"
}
`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: systemPrompt },
            ...inlineDataParts
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2, // ให้ผลลัพธ์คงที่ ไม่เบี่ยงเบนมากเกินไป
        responseMimeType: "application/json"
      }
    };

    let retries = 3;
    let delay = 2000;
    let response;
    let data;

    const currentUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

    while (retries > 0) {
      try {
        response = await fetch(`${currentUrl}?key=${this.apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMsg = errorData.error?.message || response.statusText;
          
          if (response.status === 503 || errorMsg.includes("high demand") || errorMsg.includes("overloaded")) {
            console.warn(`Gemini API overloaded. Retrying in ${delay}ms... (${retries} retries left)`);
            retries--;
            if (retries === 0) {
              throw new Error(`ระบบของ Gemini ตอนนี้มีผู้ใช้งานจำนวนมาก (High Demand) กรุณาลองใหม่อีกครั้งในภายหลัง (${errorMsg})`);
            }
            await new Promise(res => setTimeout(res, delay));
            delay *= 2; // Exponential backoff
            continue;
          }
          throw new Error(`API Error: ${errorMsg}`);
        }

        data = await response.json();
        break; // Success, exit retry loop
      } catch (err) {
        if (retries === 0 || !err.message.includes("High Demand")) {
          throw err;
        }
      }
    }
      
      // ดึงข้อความตอบกลับ
      if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
        let jsonText = data.candidates[0].content.parts[0].text;
        return JSON.parse(jsonText);
      } else {
        throw new Error("โครงสร้างการตอบกลับจาก Gemini ไม่ถูกต้อง");
      }
  }
}
