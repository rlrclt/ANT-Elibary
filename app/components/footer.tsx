import Link from "next/link";
import { PhosphorIcon } from "./phosphor-icon";

/**
 * Footer แบบเต็ม (พื้นเข้ม 4 คอลัมน์) ตาม meb components.md ข้อ 12
 * ใช้กับหน้า landing/หน้าแรก เท่านั้น
 */
export function Footer() {
  return (
    <footer className="bg-[#1f2937] text-gray-300 mt-12">
      <div className="max-w-[1200px] mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* เกี่ยวกับ */}
        <div>
          <h3 className="text-white font-bold text-base mb-3">เกี่ยวกับ ANT E-Library</h3>
          <p className="text-xs leading-relaxed text-gray-400">
            ระบบห้องสมุดดิจิทัลที่ให้คุณสืบค้น ยืม-คืน และอ่านอีบุ๊กได้ทุกที่ทุกเวลา
            พร้อมความรู้มากมายรอให้ค้นพบ
          </p>
        </div>

        {/* หมวดหมู่ยอดนิยม */}
        <div>
          <h3 className="text-white font-bold text-base mb-3">หมวดหมู่ยอดนิยม</h3>
          <ul className="space-y-2 text-xs">
            {["นิยาย", "พัฒนาตนเอง", "วรรณกรรมเยาวชน", "จิตวิทยา", "ประวัติศาสตร์"].map(
              (cat) => (
                <li key={cat}>
                  <Link href="/category" className="hover:text-meb-green transition">
                    {cat}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </div>

        {/* บริการ */}
        <div>
          <h3 className="text-white font-bold text-base mb-3">บริการ</h3>
          <ul className="space-y-2 text-xs">
            {[
              { label: "วิธีการยืม-คืน", href: "/help/borrow" },
              { label: "คำถามที่พบบ่อย", href: "/help/faq" },
              { label: "ติดต่อเรา", href: "/contact" },
              { label: "นโยบายความเป็นส่วนตัว", href: "/privacy" },
            ].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-meb-green transition">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* ดาวน์โหลดแอป + โซเชียล */}
        <div>
          <h3 className="text-white font-bold text-base mb-3">ดาวน์โหลดแอป</h3>
          <div className="flex flex-col gap-2 mb-4">
            <Link
              href="/download/ios"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 transition px-3 py-2 rounded-md text-xs"
            >
              <PhosphorIcon name="apple-logo" weight="fill" className="text-base" />
              App Store
            </Link>
            <Link
              href="/download/android"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 transition px-3 py-2 rounded-md text-xs"
            >
              <PhosphorIcon name="google-play-logo" weight="fill" className="text-base" />
              Google Play
            </Link>
          </div>
          <div className="flex gap-3">
            {[
              { icon: "facebook-logo", href: "/social/facebook", color: "hover:text-[#1877F2]" },
              { icon: "x-logo", href: "/social/x", color: "hover:text-white" },
              { icon: "line-vertical", href: "/social/line", color: "hover:text-[#00B900]" },
            ].map((s) => (
              <Link
                key={s.icon}
                href={s.href}
                className={`text-xl text-gray-400 transition ${s.color}`}
                aria-label={s.icon}
              >
                <PhosphorIcon name={s.icon} weight="fill" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ลิขสิทธิ์ */}
      <div className="border-t border-white/10 py-5 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} ANT E-Library — ระบบห้องสมุดดิจิทัล
      </div>
    </footer>
  );
}