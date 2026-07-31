# meb-design-system.css

CSS framework ส่วนตัว (vanilla CSS ไม่พึ่ง Tailwind) สกัดจากธีมร้านอีบุ๊ก "meb" ใช้แปะแล้วเริ่มสร้างหน้าใหม่ได้ทันทีโดยยังคง consistency ของสี/ฟอนต์/คอมโพเนนต์เดิม

## ไฟล์ในแพ็กเกจ

| ไฟล์ | คำอธิบาย |
|---|---|
| `meb-design-system.css` | ตัวเฟรมเวิร์กจริง — CSS variables + base + utilities + คอมโพเนนต์ทั้งหมด (~1000 บรรทัด) |
| `demo.html` | Style guide แบบเปิดดูได้ทันที โชว์ทุกคอมโพเนนต์พร้อมโค้ดตัวอย่างการใช้ class |
| `README.md` | ไฟล์นี้ |

## วิธีใช้งาน

1. คัดลอก `meb-design-system.css` ไปไว้ในโปรเจกต์
2. ใส่ใน `<head>` ตามลำดับนี้ (ฟอนต์และไอคอนต้องโหลดแยกเสมอ ไม่ได้รวมอยู่ใน .css):

```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/@phosphor-icons/web"></script>
<link rel="stylesheet" href="meb-design-system.css">
```

3. เปิด `demo.html` ในเบราว์เซอร์เพื่อดูตัวอย่างการใช้ class จริงของทุกคอมโพเนนต์ (ก็อปโครง HTML จากไฟล์นี้ไปแก้เนื้อหาได้เลย)

## หลักการตั้งชื่อ class

ทุก class ขึ้นต้นด้วย `meb-` เพื่อไม่ชนกับ library อื่นที่อาจใช้ร่วมในโปรเจกต์เดียวกัน ใช้รูปแบบ BEM แบบเบาๆ:

- Block: `.meb-book-card`
- Element: `.meb-book-card__title`
- Modifier: `.meb-btn--primary`, `.meb-rank-badge--1`

## กฎการใช้สี (ห้ามฝ่า)

- **เขียว (`--meb-green`)** = ปุ่ม action หลัก, brand, active state, accent — ใช้ class `.meb-btn--primary`
- **แดง (`--meb-red` / `--meb-ribbon-red`)** = ราคา/ส่วนลด/ความเร่งด่วนเท่านั้น ห้ามใช้เป็นปุ่ม action หลัก
- Badge บนการ์ดหนังสือมี 3 สไตล์ (`.meb-badge-discount`, `.meb-badge-ribbon`, `.meb-rank-badge--N`) — เหรียญอันดับ (`.meb-rank-badge`) ใช้เฉพาะ section ที่มีการจัดอันดับจริงเท่านั้น

## Breakpoints

ตรงกับ Tailwind default เพื่อให้สลับไปมาระหว่างสองระบบได้ไม่มีปัญหา:

- Mobile: `< 640px` (ค่าเริ่มต้น mobile-first)
- Tablet (`sm`): `≥ 640px`
- Desktop (`lg`): `≥ 1024px`

## ความสัมพันธ์กับ Claude skill "meb-design-system"

ไฟล์นี้เป็น**ผลลัพธ์ที่ implement จริง**ของกฎที่อธิบายไว้ในเอกสาร `design-tokens.md` / `components.md` / `page-patterns.md` (อยู่ใน Claude skill ชุดก่อนหน้า) — ถ้าแก้ไขค่าใดใน `.css` นี้ ควรย้อนไปอัปเดตเอกสารทั้งสองชุดให้ตรงกันด้วย เพื่อไม่ให้ documentation กับโค้ดจริงหลุดจากกัน

## Known limitations

- ยังไม่มี dark mode
- ยังไม่มี component: modal/dropdown menu แบบเต็ม (มีแค่โครง sidebar/nav)
- Icon ต้องพึ่ง Phosphor Icons CDN เท่านั้น ยังไม่ได้ทำ SVG sprite แบบ offline
