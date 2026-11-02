# ผลตรวจ implementation

ตรวจเมื่อ 31 ตุลาคม 2026

## Build และ automated tests

- React: `tsc -b && vite build` ผ่าน ไม่มี chunk-size warning หลังแยกโหลด tutor และ KaTeX ตามการใช้งาน
- Go: `go test ./...` ผ่านทั้ง importer, HTTP API และ Gemini adapter; `go vet ./...` ผ่าน
- ตัวเปิดแอป: รัน `scripts/start.ps1` ที่ `run.bat` ใช้แล้ว build สำเร็จ เปิด server ได้; ตรวจหน้า React HTTP 200 และ catalog รวม 427 ข้อ
- Importer: ตรวจข้อมูลจริงครบ 10 topics, 427 questions, 854 image relationships, 10 imported AI explanations ภาพที่อ่านกลับตรงกับ bytes ต้นฉบับครบทุกภาพ
- Import ซ้ำ: จำนวนข้อมูลและ stable IDs ไม่เปลี่ยน; orphan explanation ทำให้ rollback ข้อมูลในฐานข้อมูล
- HTTP API: ตรวจ filter แบบ AND, search, pagination, image cache, missing question และคำอธิบาย AI ที่ไม่มี
- Chat: ทดสอบด้วย mock provider ทั้ง SSE, history, แยกโจทย์, session เจ้าของคนละตัว, idempotency, โควตา, upstream error และ disconnect/cancel
- Gemini adapter: ตรวจรูปแบบ multimodal payload, API key ผ่าน header, การอ่าน delta และการไม่ส่ง thought/error ภายในให้ผู้ใช้ โดยใช้ mock HTTP transport

## Browser checks

เปิด React production build ผ่าน Go บน localhost แล้วตรวจ:

- หน้าเริ่มต้น: สีส้ม/เขียว มาสคอต sidebar และการ์ดตาม HTML เดิม
- กรองปี/ประเภท/หัวข้อร่วมกัน ค้นหา และสถานะไม่พบข้อมูล
- เปิดภาพเฉลยต้นฉบับและคำอธิบาย AI; สูตร render ด้วย KaTeX
- เปิดหน้าโจทย์รายข้อและกลับรายการพร้อมตัวกรองเดิม
- เปลี่ยนหน้าจาก 1 ไป 2 แล้วยืนยันว่าแสดงโจทย์เริ่มที่ข้อ 21
- ขยายรูปด้วย dialog และปิดกลับรายการได้
- ตรวจ responsive ที่ 390 × 844 แล้ว reset viewport กลับ
- AI ที่ยังไม่มี server configuration แสดงสถานะ unavailable และไม่ให้ส่งข้อความ
- console ไม่พบ error/warning ระหว่างการตรวจหน้าเว็บ

ภาพตัวอย่างอยู่ที่ `docs/react-preview.png` HTML ต้นทางยังมีขนาด 6,615,983 bytes

## ข้อจำกัดการตรวจ

ยังไม่ได้เรียก Gemini จริงเพราะไม่มี API key และ model ตั้งไว้ ไม่มีการทดสอบโหลดหลายผู้ใช้จริงหรือการ deploy ผ่าน reverse proxy และไม่ได้ทดสอบบนอุปกรณ์มือถือจริง การตรวจ UI แชตครั้งนี้ตรวจสถานะปิดใช้ AI; เส้นทาง streaming ใช้ automated backend/provider tests

## อัปเดต 1 พฤศจิกายน 2026 — AI latency และ font CSP

- แก้ `font-src` ให้รองรับฟอนต์แบบ data URL โดยยังจำกัด script เป็น same-origin
- Gemini 3 ใช้ thinking LOW โดยค่าเริ่มต้นและปรับได้; เพิ่ม output budget เป็น 8,192 tokens พร้อมลดคำตอบปกติให้กระชับ
- แยก error codes สำหรับ quota, access/model/config, timeout, empty response, output limit และ stream ที่ปิดก่อนยืนยัน STOP; บันทึกเวลาถึงข้อความแรกและเวลารวมโดยไม่ log เนื้อหาหรือ key
- SSE keepalive ระหว่างโมเดลยังไม่ส่งข้อความ และตัวนับเวลารอใน chatbot
- `go test ./...`, `go vet ./...`, Go build และ React production build ผ่านหลังแก้
- ทดสอบ provider จริงด้วยข้อความสั้น `Reply only OK.` กับ gemini-3.6-flash และ thinking LOW: เริ่มรับข้อความประมาณ 2.77 วินาที จบประมาณ 2.78 วินาทีและ finishReason STOP ค่านี้เป็นคำถามสั้น ไม่ใช่ benchmark ของโจทย์คณิตศาสตร์
- คำขอเก่าที่ error มีเพียง AI_GENERATION_FAILED จึงไม่สามารถระบุย้อนหลังว่าล้มเหลวเพราะ quota/network/empty output ได้
- ไม่ได้หยุดหรือแทนที่ server ที่ผู้ใช้กำลังเปิดอยู่ ต้อง restart ผ่าน run.bat เพื่อใช้ backend ที่แก้แล้ว

## อัปเดต 1 พฤศจิกายน 2026 — text-only question context

- เปลี่ยน Gemini input จากภาพโจทย์/เฉลยเป็นข้อความโจทย์ที่แก้ไขได้ Prompt สั้นและระบุให้ตอบเฉพาะคำถามล่าสุด
- ทดสอบ HTTP payload ว่ามีข้อความของข้อที่เลือกและไม่มี inline image attachments
- จำกัดประวัติที่ส่งไม่เกิน 2 รอบ (4 ข้อความ) ภายในงบ 4,000 ตัวอักษร ลด output ceiling จาก 8,192 เป็น 4,096 tokens
- ตรวจ API ข้อความโจทย์, 404, การแก้ข้อความ, การรักษา questionId และการเลือกประวัติ 2 รอบล่าสุด
- เพิ่ม tests สำหรับการตัด metadata/solution markers โดยไม่เดาสัญลักษณ์คณิตศาสตร์ ข้อความ 2 ข้อแรกของหัวข้อ 1 ตรวจจากภาพแล้ว ข้ออื่นยังเป็น OCR draft และมีข้อจำกัดตาม README
- Go tests, go vet, Go build และ React build ผ่าน
- Browser QA กับ Gemini จริงบน server/ฐานข้อมูลทดสอบแยก: “kawaii แปลว่าอะไร” → “น่ารัก”; “สัมประสิทธิ์ของ y' ในข้อนี้คือเท่าไร” → “4”
- เมื่อแก้ context เป็น `7y'+5y=0` บทสนทนาเริ่มใหม่และตอบสัมประสิทธิ์ “7”; console ไม่พบ error/warning
- ภาพหน้าจอ: `docs/text-chat-preview.png` ตัวอย่างเหล่านี้เป็นการตรวจพฤติกรรมเฉพาะกรณี ไม่ใช่การรับประกันคำตอบทั้งหมดของโมเดล

## อัปเดต 1 พฤศจิกายน 2026 — ชุดเครื่องมือช่วยเรียน

- เพิ่มชุดฝึกสุ่มตามหัวข้อ จำนวนข้อ เวลา ตัวกรองข้อที่ยังไม่เข้าใจ/รายการโปรด และเก็บคำตอบกับประวัติ 10 ชุดล่าสุดในเครื่อง
- ระหว่างทำชุดฝึก UI ไม่แสดงเฉลย ข้อความ OCR คำใบ้ และแชต; ตรวจ browser ว่าไม่มีปุ่มเฉลยและ floating AI ในหน้าชุดฝึกที่ยังไม่จบ
- ตรวจใน browser: พิมพ์คำตอบ รีเฟรชแล้วคำตอบยังอยู่และ timer เดินต่อ; จบชุดฝึกแล้วเปิดเฉลยได้และมีรายการในประวัติ
- เพิ่มสถานะ รายการโปรด โน้ต คำตอบร่าง checklist และตำแหน่งการเรียนต่อ; ทดสอบบันทึกและรีโหลดจริง รวมระดับคำใบ้และขั้นเฉลย
- มีสูตร/แนวทาง 9 หัวข้อ, คำใบ้เฉพาะข้อที่ตรวจจากภาพ 2 ข้อ, แบ่งคำอธิบาย AI เดิม 10 ข้อเป็นขั้น ๆ และเปิดข้อความร่างเพื่อขอ AI ตรวจคำตอบ/อธิบายต่อ โดยไม่ได้ส่งคำขอ AI อัตโนมัติ
- ตรวจฟอร์มรายงานผ่านหน้าเว็บจริง ได้ receipt และบันทึกใน DB ทดสอบแยก; review status ของคำอธิบายไม่ถูกแก้โดยอัตโนมัติ
- Go tests ครอบคลุม random uniqueness, topic/include/exclude intersections, empty favorites, input limits, Thai search aliases, report session/validation/rate limit และการเก็บรายงาน; `go test ./...` และ `go vet ./...` ผ่าน
- Frontend model tests 7 ข้อผ่าน: persistence, timer/deadline, history bounds, filters, corrupt data, view-state persistence และการจำกัดค่า; React/TypeScript production build ผ่าน
- ตรวจหน้า Laplace formulas บนมือถือ 390×844 มี 3 formula cards และไม่พบ KaTeX errors; reset viewport กลับหลังตรวจ
- ภาพหน้าจอชุดฝึก: `docs/study-practice.png`
- ขอบเขต: การตรวจคำตอบเป็น checklist และ AI assistance พร้อม self assessment ไม่ใช่ symbolic grading; ยังมีคำอธิบาย AI ที่เตรียมไว้ 10 ข้อและ OCR draft ที่ต้องตรวจตาม README

## อัปเดต 1 พฤศจิกายน 2026 — 4-choice grading

- เปลี่ยนช่องคำตอบทั้งสองจุดเป็น radio 4 ตัวเลือก; โน้ตและแชตยังพิมพ์ได้ตามเดิม
- จัดทำ answer keys 10 ข้อจากภาพเฉลยต้นฉบับ (ไม่ได้ครอบคลุมทั้ง 427 ข้อ) ครบ 9 หัวข้อ; Fourier Transforms ข้อ 1 ระบุฝึกเฉพาะข้อย่อย b
- ตรวจ API ว่ามี 4 ตัวเลือกที่ ID/order คงที่ ไม่ส่ง correctIndex/feedback/explanation ก่อนตรวจ; ส่งคำตอบถูกทั้ง 10 ข้อได้ 10 คะแนน และแยกผิด/ไม่ตอบ/คำตอบเก่า/เฉลยเปลี่ยน/ข้อที่ไม่พร้อมอย่างถูกต้อง
- ตรวจภาพ source hash เพื่อไม่ใช้ key เดิมเมื่อเปลี่ยนภาพ; ปฏิเสธตัวเลือกปลอมและข้อซ้ำ; fake AI provider ไม่ถูกเรียกแม้แต่ครั้งเดียว
- ชุดฝึกใหม่และตัวกรองคลังใช้ pool ที่พร้อมตรวจเหมือนกัน
- Browser QA: ตอบผิดและถูกจากแผงช่วยเรียน, reload ยังคงตัวเลือก, ฝึก 2 ข้อจบได้คะแนน 1/2 พร้อมเหตุผลและภาพต้นฉบับ; ระหว่างจับเวลาไม่มีปุ่มตรวจ/feedback/floating AI
- ตรวจ KaTeX parse ของตัวเลือก 40 รายการและสูตรใน prompt/feedback/explanation ผ่าน
- Frontend tests 8 ข้อและ production build ผ่าน; Go test/vet ผ่าน (Windows sandbox บล็อก rename ภาพใน temp ของ importer จึงรันทดสอบนอก sandbox สำเร็จ)
- ภาพผลคะแนนและตัวเลือก: `docs/choice-practice.png`; ตรวจขนาด radio หลังแก้ CSS เป็น 17.6px และไม่มี console errors/warnings

## คำอธิบาย Laplace ครบหัวข้อ

- อ่านภาพเฉลยของข้อที่เหลือและเพิ่มคำอธิบาย AI อีก 46 ข้อ รวมเนื้อหาใหม่ใน JSON 66 ข้อกับคำอธิบายเดิม 5 ข้อ เป็น 71/71 ข้อในหัวข้อ 7
- บันทึกลงฐานข้อมูลเครื่องปัจจุบันแล้ว ตรวจ query ว่าไม่มีข้อขาด; สำรองฐานข้อมูลก่อนเพิ่มไว้ใน .tools/before-laplace-complete.db
- ทุกเนื้อหาใหม่คงสถานะ unreviewed และระบุข้อพิมพ์ผิดที่พบ เช่น เครื่องหมายในข้อ 16, 18, 42 รวมถึงข้อ 58, 65, 71 ที่ทำก่อนหน้า
- ตรวจ KaTeX ของเนื้อหาใหม่รวม 329 สูตรผ่าน และ Go build ผ่าน
- Focused integration test ผ่าน: seed ซ้ำได้ ไม่ทับเฉลยเดิม มีคำอธิบายครบ 71 ข้อ และ API ส่งเนื้อหาข้อเก่า/ใหม่พร้อมสถานะ unreviewed
- เนื้อหาถูกจัดทำโดย AI ตามภาพเอกสาร ไม่ได้ผ่านการรับรองของอาจารย์หรือผู้ตรวจอิสระ

## ตรวจทาน Laplace ด้วย AI และ SymPy

- ตรวจภาพโจทย์ครบ 71 ข้อ แยกข้อมูลโจทย์ออกจากภาพเฉลยก่อนคำนวณ; symbolic checks ผ่าน 323 รายการ ครอบคลุม 71 ข้อ
- แก้เครื่องหมาย t exp(-t) cos(t) ในข้อ 11/59/62, ตำแหน่งพจน์ x/2 ในข้อ 71, หมายเหตุที่กล่าวหาค่า -7/36 ในข้อ 18, ค่าคงที่ทั่วไปในข้อ 13/24 และเติมรูปแบ่งช่วง/เงื่อนไขโดเมนตามรายงาน
- ข้อ 65 ทั้ง a/b มีเงื่อนไขเริ่มต้นขัดกับสมการลำดับหนึ่ง จึงติด needs_clarification และแสดงคำตอบที่แก้ x′(0)=1 เป็นกรณีสมมติเท่านั้น
- สถานะฐานข้อมูล 70 ai_checked + 1 needs_clarification ผูกกับ body hash และทั้ง question/solution image hashes; แยก AI checks จาก human review
- Focused Go integration tests ผ่าน: known-content upgrades, custom/human edit preservation, stale content/source invalidation, complete coverage และ API labels; Go build และ frontend production build ผ่าน
- Browser QA ข้อ 65 แสดงป้ายต้องสอบถามผู้สอนและสมการขัดแย้งครบ; ข้อ 11 แสดงป้ายตรวจ AI และสูตรแก้แล้ว โดยไม่มี KaTeX errors
- รายงานเต็ม: docs/LAPLACE_REVIEW.md และ docs/laplace-review.json; คำนวณซ้ำด้วย scripts/verify_laplace.py
- เป็นการตรวจด้วย AI และคำนวณเชิงสัญลักษณ์ ไม่ใช่การรับรองจากอาจารย์ ข้อความที่ถอดจากภาพอาจยังมีความผิดพลาดที่การตรวจนี้ไม่พบ
- ตรวจสูตร KaTeX แบบ strict ผ่าน 498 สูตร; ภาพหน้าจอป้ายข้อ 65: docs/laplace-review-q65.png
## คำอธิบาย Z-transform ครบหัวข้อ

- เพิ่ม 27/27 ข้อ รวมทุกข้อย่อย (1997–2026) พร้อมขั้นตอน Z-transform ค่าเริ่มต้น ROC และตรวจกลับ
- ตรวจภาพโจทย์และเฉลยต้นฉบับครบทั้ง 27 ข้อ ใช้ SymPy ตรวจสมการเชิงสัญลักษณ์ ฟังก์ชันตรรกยะ อินทิกรัล และสัมประสิทธิ์ Laurent แบบ exact ผ่าน 422/422 รายการ
- ตรวจสูตร KaTeX แบบ strict ผ่าน 374 สูตร ไม่มีการเปลี่ยน frontend design
- สถานะ ai_checked 27 ข้อ; ผลตรวจโดย AI ไม่ใช่การรับรองจากอาจารย์ ขอบเขตและ hash ของเนื้อหาอยู่ใน docs/Z_TRANSFORM_REVIEW.md และ docs/z-transform-review.json
- Integration tests ตรวจ API ทุกข้อ การ seed ซ้ำ การจับคู่ภาพโจทย์/ภาพเฉลย และการรักษา custom edits/human-reviewed explanations ผ่าน รวมถึงชุดทดสอบ Laplace เดิม
- Go backend build ผ่าน; ตรวจ live API ที่ port 8082 ครบ 27 ข้อ ได้ body/status/hash ตรงกับ source แล้วปิด preview server
- บันทึกลงฐานข้อมูลเครื่องนี้แล้ว; สำรองก่อนแก้ไว้ที่ .tools/before-z-transform.db; สถานะ Laplace เดิมยังคง 70 ai_checked + 1 needs_clarification
- คำนวณซ้ำได้ด้วย python scripts/verify_z_transform.py (ต้องติดตั้ง SymPy ในเครื่องพัฒนา); ข้อมูล review ผูกกับสูตรที่ถอดจากภาพ ไม่ได้ parse สมการทุกตัวจาก HTML อัตโนมัติ
- ชุดทดสอบ backend ทั้งหมดผ่าน: go test ./... (AI, HTTP API, legacy import และ questiontext)
## คำอธิบาย Boundary-Value Problems ครบหัวข้อ

- เพิ่มคำอธิบาย 25/25 ข้อ รวมทุกข้อย่อย (1998–2026) ใน backend/internal/studycontent/bvp_explanations.json
- ตรวจภาพโจทย์/เฉลยทุกข้อ และคำนวณซ้ำด้วย SymPy ผ่าน 293/293 รายการ ครอบคลุม PDE residuals, boundary traces, modal initial values, Fourier integrals และพยานความขัดแย้ง
- ตรวจสูตร KaTeX แบบ strict ผ่าน 392 สูตร ไม่มีการเปลี่ยน frontend design
- แก้คำตอบจากภาพข้อ 14 (สัมประสิทธิ์ความเร็ว +5/4), ข้อ 15 (ความถี่ 2 omega² และพจน์ sine สำหรับ zero initial velocity) และข้อ 18 (โหมดค่าเฉลี่ย 2/pi)
- สถานะ 23 ai_checked + 2 needs_clarification: ข้อ 15 ต้องระบุ generalized L² interpretation เพราะข้อมูลไม่เข้ากับขอบเขตอนุพันธ์ที่มุมเริ่มต้น และข้อ 22 มี boundary trace ขัดกับ anti-periodicity ของ eigenmodes
- ระบุข้อจำกัดเรื่อง corner compatibility และการหาอนุพันธ์อนุกรมของข้อ 2,3,15,17,18 ในเนื้อหา ไม่อ้างว่าผลรวมแบบ finite ตรวจ initial function ได้ตรงทุกจุด
- Backend build ผ่าน; live API port 8082 ตอบ body/status/hash ตรง source ครบ 25 ข้อ แล้วปิด preview server ที่ใช้ตรวจ
- บันทึกลงฐานข้อมูลเครื่องนี้แล้วและสำรองก่อนแก้ไว้ที่ .tools/before-bvp-explanations.db; Laplace ยังคง 70 checked + 1 clarification และ Z-transform ยังคง 27 checked
- รายงานและ hash: docs/BVP_REVIEW.md และ docs/bvp-review.json; รันซ้ำด้วย python scripts/verify_bvp.py (ต้องมี SymPy ในเครื่องพัฒนา)
- การตรวจเป็น AI-assisted audit ไม่ใช่การรับรองจากอาจารย์ สคริปต์ตรวจสูตรที่ถอดจากภาพ ไม่ได้ parse สูตรทั้งหมดใน HTML อัตโนมัติ
- ชุดทดสอบ backend ทั้งหมดผ่าน go test ./... รวม coverage/status ของ BVP ทุกข้อ การ seed ซ้ำ source-image guards และการรักษา custom/human-reviewed explanations
