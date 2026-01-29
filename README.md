# RStatement

เว็บแอปพลิเคชันสำหรับอ่านรายการเดินบัญชี (Bank Statement) ให้เข้าใจง่าย เหมาะสำหรับผู้สูงอายุ

## ฟีเจอร์หลัก
- **อ่านง่าย**: ใช้ฟอนต์ Kanit ขนาดใหญ่ แยกสีรายรับ/รายจ่ายชัดเจน
- **ใช้งานง่าย**: เพียงลากไฟล์ PDF มาวางเท่านั้น
- **ปลอดภัย**: ประมวลผลบนเครื่อง (Client-side) ข้อมูลไม่ถูกส่งออกไปภายนอก

## วิธีใช้งาน (สำหรับนักพัฒนา)

1. ติดตั้ง Dependencies:
   ```bash
   npm install
   ```

2. รันเซิร์ฟเวอร์:
   ```bash
   npm run dev
   ```

3. เปิด [http://localhost:3000](http://localhost:3000)

## Tech Stack
- Next.js 15 (App Router)
- TypeScript
- Tailwind (Removed -> using Vanilla CSS for custom design)
- PDF.js (Processing)
