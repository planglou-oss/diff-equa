# Deploy บน Vercel (เวอร์ชันไม่มี chatbot)

เวอร์ชันนี้เป็น React static site ไม่มี Go server หรือ SQLite บน Vercel โจทย์ 427 ข้อ รูป 854 รูป เฉลยต้นฉบับ และคำอธิบายที่บันทึกไว้รวมอยู่ในไฟล์สาธารณะ หน้าเว็บใช้ธีมเดิม

## Deploy จาก GitHub

1. Push โค้ดล่าสุดขึ้น repository รวม **frontend/public/study/**, **vercel.json** และ **.vercelignore** ไฟล์ข้อมูล/PNG ใน public ต้องขึ้น GitHub ด้วย ไม่ใช้โฟลเดอร์ data/ ของเครื่องผู้พัฒนา
2. เปิด Vercel → Add New → Project แล้ว Import repository `planglou-oss/diff-equa` ด้วยบัญชีที่มีสิทธิ์เข้าถึง
3. ตั้ง **Root Directory เป็น root ของ repository (`.`)** ไม่เลือก frontend เพราะ vercel.json อยู่ที่ root
4. ใช้ Framework Preset **Other**; vercel.json กำหนดคำสั่งไว้แล้ว:

   | ค่า | คำสั่ง/ตำแหน่ง |
   |---|---|
   | Install Command | `npm ci --prefix frontend` |
   | Build Command | `npm run build:static --prefix frontend` |
   | Output Directory | `frontend/dist` |

5. ใช้ Node.js 22.12 ขึ้นไป (เช่นรุ่น 22.x หรือ 24.x ที่ Vercel มีให้เลือก) **ไม่ต้องเพิ่ม environment variables หรือ API key**
6. กด Deploy แล้วเปิด URL ที่ Vercel ให้ ทดสอบเปิดลิงก์ `/questions/ee201-t09-q022` โดยตรงและ refresh ได้ เพราะตั้ง SPA rewrites แล้ว

หากเคยสร้างโปรเจกต์ Vercel ไว้ก่อน ให้ลบค่า Root/Build/Output override ที่ขัดกับตาราง แล้ว redeploy โค้ดล่าสุด คำแนะนำอ้างอิง [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)

## ฟีเจอร์และการเก็บข้อมูล

- อ่านโจทย์ ภาพเฉลย คำอธิบาย AI ที่บันทึกไว้ สูตร คำใบ้ และข้อความ OCR ได้ โดยไม่เรียก AI
- ค้นหา กรองหัวข้อ/ปี/ประเภท เรียงปี และแบ่งหน้าทำใน browser
- สุ่มชุดฝึกแบบไม่ซ้ำ จับเวลา ซ่อนเฉลยระหว่างทำ ทำต่อหลัง reload และตรวจตัวเลือกจากเฉลยเดิมได้
- ตัวเลือกมีเฉลยที่ตรวจทานแล้ว 10 ข้อ ใช้ version และ option ID เดิม คำตอบเก่า/เฉลยเปลี่ยนยังแยกเป็นตรวจไม่ได้ คีย์คำตอบเป็นข้อมูลสาธารณะสำหรับฝึกเอง ไม่ใช่ระบบคุมสอบ
- โน้ต ความคืบหน้า รายการโปรด และประวัติชุดฝึกอยู่ใน localStorage ของ browser/โดเมนนั้น ไม่ sync ข้ามเครื่อง การเปลี่ยน URL จาก localhost หรือ preview domain เป็น production domain ไม่ย้ายข้อมูลให้อัตโนมัติ
- ปุ่ม chatbot และปุ่มถาม AI ถูกถอดจาก static build และไม่มี Tutor bundle หรือการเรียก /api/v1
- บันทึกข้อผิดพลาดเป็น **บันทึกส่วนตัวใน browser** เก็บ 100 รายการล่าสุด ไม่ส่งให้ผู้ดูแล มีปุ่มดาวน์โหลด JSON เพื่อนำไปแจ้งต่อ
- ไม่มีการนำฐานข้อมูลประวัติแชต `.env` หรือ API key ของผู้พัฒนาไปใช้กับเว็บ

## ทดลองในเครื่องโดยไม่เปิด Go

จาก root หลังติดตั้ง dependencies ของ frontend:

```powershell
npm --prefix frontend run build:static
npm --prefix frontend run preview
```

เปิด URL ที่ Vite แสดง หรือใช้ `npm --prefix frontend run dev:static` สำหรับพัฒนาโหมดนี้

## อัปเดตโจทย์หรือเฉลยแล้วส่งขึ้นเว็บ

ไฟล์ public เป็น snapshot ที่ commit มากับ source เพื่อให้ Vercel build ด้วย Node เพียงอย่างเดียว หากแก้ข้อมูลต้นทาง/คำอธิบาย/answer key/สูตร ให้ export ใหม่บนเครื่องพัฒนาที่มี Go:

```powershell
cd backend
go run ./cmd/export-static
cd ..
npm --prefix frontend test
npm --prefix frontend run build:static
```

Exporter สร้างฐานข้อมูลชั่วคราวจาก exam201_solutions.html และ seed คำอธิบายล่าสุด ไม่อ่าน data/ หรือ .env ของเครื่องนี้ จากนั้น commit และ push ไฟล์ source กับ frontend/public/study/ ที่เปลี่ยน Vercel จะ build จาก snapshot รุ่นใหม่

Build ตรวจ SHA-256 ของ snapshot/PNG, จำนวนโจทย์, แท็กตรงกับหัวข้อ, ความครบของเฉลยล่าสุด และ choice keys ก่อนสร้างเว็บ ข้อมูลที่ export ต้องนำขึ้น GitHub ด้วย มิฉะนั้น build จะไม่ผ่านหรือยังเป็น snapshot เก่า

## เวอร์ชัน Go และ Windows ZIP

`npm run build` ปกติยังเป็นโหมด Go API; run.bat และ scripts/package-windows.ps1 ใช้โหมดนี้ต่อไป ไม่ต้องเปลี่ยนแพ็กเกจ Windows ที่สร้างแล้วเพื่อ deploy Vercel การเปลี่ยน renderer ให้รักษาเครื่องหมาย < ในสูตรใช้ร่วมกันทั้งสองโหมด
