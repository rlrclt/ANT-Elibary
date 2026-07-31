# Design Tokens — Meb E-book Store

ทุกค่าด้านล่างดึงมาจากหน้าเว็บต้นแบบ 3 หน้า (homepage แบบย่อ, product detail, homepage แบบเต็ม) ถือเป็น "แหล่งความจริงเดียว" (single source of truth) เวลาออกแบบหน้าใหม่

## 1. สี (Colors)

### สีแบรนด์ (เขียว) — สีหลักของระบบ
| ชื่อ | Hex | Tailwind config key | ใช้ตรงไหน |
|---|---|---|---|
| Brand green | `#00a651` | `meb.green` | header bg, ปุ่มหลัก, active tab, accent bar, ลิงก์ |
| Brand hover | `#008c44` | `meb.hover` | hover state ของปุ่ม/ลิงก์สีเขียว |
| Brand light | `#e6f6ec` | `meb.light` | พื้นหลังอ่อนของ tag, focus ring, hover ของแถบเมนู |
| Nav variant | `#009348` | `meb.nav` | ใช้ในหน้าที่ต้องแยกโทนของ header กับ nav รอง (พบใน homepage เวอร์ชันเต็ม) |

### สีราคา/โปรโมชัน (แดง) — สีเตือน/กระตุ้น
| ชื่อ | Hex | ใช้ตรงไหน |
|---|---|---|
| Price red (หลัก) | `#e53935` | ราคาที่ลดแล้ว, ป้าย % ส่วนลด, tag โปรโมชัน, badge จำนวนของในตะกร้า |
| Ribbon red (ทางเลือก) | `#e11d48` (red-600) | ริบบอน "Best Seller" |
| Ribbon shadow เข้ม | `#9f1239` / `#b71c1c` | เงาใต้ริบบอน (สร้าง fold effect ด้วย border triangle) |

### สีข้อความ/พื้นหลังทั่วไป
| ชื่อ | Hex/Class | ใช้ตรงไหน |
|---|---|---|
| Text หลัก | `#333333` (`text-slate-800` ก็ใช้ได้) | เนื้อหาตัวอักษรทั่วไป |
| Text รอง | `text-slate-500` | คำบรรยายรอง, ชื่อผู้แต่ง, breadcrumb |
| Text จาง | `text-slate-400` | placeholder, จำนวน rating, ราคาปกที่ขีดฆ่า |
| Page background | `#f8f9fa` หรือ `#f0f2f5` | พื้นหลังทั้งหน้า (เลือกอย่างใดอย่างหนึ่ง ไม่ผสมกันในเว็บเดียว) |
| Card background | `#ffffff` | การ์ด, section wrapper, header ย่อย |
| Border | `#e5e7eb` (`border-gray-200`) | เส้นขอบการ์ด, เส้นแบ่ง section |

### สี rating / badge พิเศษ
| ชื่อ | Hex/Class | ใช้ตรงไหน |
|---|---|---|
| ดาว rating (เต็ม) | `text-yellow-400` (ใช้ class `ph-fill ph-star`) | คะแนนรีวิว |
| ดาว rating (ว่าง) | `text-slate-300` (ใช้ class `ph ph-star`) | ส่วนของดาวที่ยังไม่ได้คะแนน |
| เหรียญอันดับ 1 | gradient `#ffd700 → #ffaa00` | rank badge อันดับ 1 เท่านั้น |
| เหรียญอันดับ 2 | gradient `#e0e0e0 → #9e9e9e` (silver) | rank badge อันดับ 2 |
| เหรียญอันดับ 3 | gradient `#ffbca8 → #d87a5d` (bronze) | rank badge อันดับ 3 |
| เหรียญอันดับ 4+ | `#333` bg, ขาว text | rank badge อันดับ 4 เป็นต้นไป |

### กล่องแจ้งเตือน/โปรโมชันพิเศษ (info boxes)
| ประเภท | bg | border | text | ใช้ตรงไหน |
|---|---|---|---|---|
| กล่องราคา/โปรโมชัน (เหลืองอ่อน) | `#fcf8e3` | `#faebcc` | price red | กล่องราคา+ปุ่มซื้อในหน้ารายละเอียดสินค้า |
| กล่อง alert ข้อมูล (ฟ้าอ่อน) | `#e3f2fd` | `#bbdefb` | `#1976d2` / `#1565c0` | แจ้งเตือนข้อมูลเสริม (เช่น "มีขายที่อื่นด้วย") ไม่ใช่ error |

## 2. ฟอนต์ (Typography)

- **Font family**: `'Noto Sans Thai', sans-serif`
- **Import**: `https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap`
- **น้ำหนักที่ใช้จริง**: 300 (บาง — แทบไม่ใช้ตรงๆ, เผื่อ decorative), 400 (ปกติ — เนื้อความ), 500 (medium — label/nav), 600 (semi-bold — คำสำคัญรอง), 700/`font-bold` (หัวข้อ, ราคา, ชื่อหนังสือ, ปุ่ม)
- **ขนาดตามลำดับชั้น**:
  - Section title: `text-lg` ถึง `text-2xl` + `font-bold`
  - Page title (หน้ารายละเอียด): `text-2xl md:text-3xl font-bold`
  - Book card title: `text-sm font-bold` + `line-clamp-2`
  - Body/description: `text-sm` หรือ `text-xs` สำหรับ metadata
  - ราคา: `text-lg`–`text-3xl font-bold` ตามความสำคัญของบริบท (การ์ด vs หน้ารายละเอียด)

## 3. ไอคอน (Icons)

- **ชุดไอคอน**: Phosphor Icons เท่านั้น — `<script src="https://unpkg.com/@phosphor-icons/web"></script>`
- **Class รูปแบบ**: `ph ph-{name}` (outline/regular) หรือ `ph-fill ph-{name}` (filled) — ใช้ filled สำหรับ rating stars ที่ได้คะแนน, trophy, gift, house (เมื่อ active)
- ไอคอนที่ใช้บ่อย: `ph-magnifying-glass` (ค้นหา), `ph-shopping-cart` (ตะกร้า), `ph-user` / `ph-user-circle` (โปรไฟล์), `ph-heart` (wishlist), `ph-star` / `ph-star-fill` / `ph-star-half` (rating), `ph-caret-down` / `ph-caret-right` / `ph-caret-left` (dropdown/breadcrumb/carousel), `ph-list` (hamburger menu, หมวดหมู่), `ph-tag` (โปรโมชัน), `ph-gift` (ฟรี/ของขวัญ), `ph-trophy` (ขายดี), `ph-books` (หมวดหมู่หนังสือ)

## 4. Layout & Spacing

- **Container width**: `max-w-7xl` (≈1280px) หรือ `max-w-[1200px]` — เลือกใช้ค่าใดค่าหนึ่งให้สม่ำเสมอทั้งเว็บ (อย่าสลับไปมาในหน้าเดียวกัน)
- **Grid หนังสือ (จำนวนคอลัมน์ตาม breakpoint)**:
  - มือถือ (`base`): `grid-cols-2`
  - แท็บเล็ต (`sm`/`md`): `sm:grid-cols-3` หรือ `md:grid-cols-3`
  - เดสก์ท็อป (`lg`): `lg:grid-cols-4` หรือ `lg:grid-cols-5` (ถ้ามี sidebar ให้ลดเหลือ 4, ถ้าไม่มี sidebar ใช้ 5 ได้)
  - ระยะห่าง (`gap`): `gap-4` มือถือ, `md:gap-5`/`lg:gap-6` เดสก์ท็อป
- **Border radius**:
  - การ์ดใหญ่/section wrapper: `rounded-lg` หรือ `rounded-xl`
  - ปกหนังสือ/รูปเล็ก: `rounded-md` หรือเหลี่ยมเกือบเต็ม `rounded-[2px]` (สไตล์ปกหนังสือจริง)
  - ปุ่ม: `rounded-md` (ปุ่มสี่เหลี่ยม) หรือ `rounded-full` (ปุ่มไอคอนกลม เช่น social share)
- **Shadow**: `shadow-sm` เป็นค่าเริ่มต้นของการ์ดทั้งหมด, `shadow-md` เฉพาะตอน hover หรือกล่อง CTA ที่ต้องการความเด่น
- **Sticky header**: `sticky top-0 z-50` เสมอสำหรับ header หลัก, sidebar (ถ้ามี) ใช้ `sticky top-[80px]` (เผื่อพื้นที่ header)

## 5. Responsive breakpoints ที่ใช้จริงในโค้ดต้นแบบ

Tailwind default: `sm` (640px), `md` (768px), `lg` (1024px)

รูปแบบการซ่อน/แสดงที่ใช้ซ้ำ:
- ซ่อนช่องค้นหาบนมือถือ, โชว์ไอคอนแว่นขยายแทน: `hidden md:flex` คู่กับปุ่ม `md:hidden`
- ซ่อน sidebar หมวดหมู่บนจอเล็ก: `hidden lg:block`
- ซ่อนการ์ดที่ 4–5 ในกริดบนจอเล็ก เพื่อไม่ให้ล้นเป็นแถวครึ่ง: `hidden sm:flex` / `hidden lg:flex` ที่ตัวการ์ดเอง
- ซ่อนแถบเมนูรอง (nav ที่สอง) บนมือถือทั้งแถบ: `hidden md:block` ที่ตัว `<nav>`

## 6. External dependencies ที่ต้องใส่ใน `<head>` ทุกหน้า

```html
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/@phosphor-icons/web"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        fontFamily: { sans: ['Noto Sans Thai', 'sans-serif'] },
        colors: {
          meb: { green: '#00a651', hover: '#008c44', light: '#e6f6ec' },
          price: { red: '#e53935' }
        }
      }
    }
  }
</script>
```