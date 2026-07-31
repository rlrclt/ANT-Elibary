import Link from "next/link";
import { PhosphorIcon } from "../../components/phosphor-icon";

/**
 * MemberFooter — clone จาก AmnatCharoen.html footer
 * - bg-[#1f2937] text-white pt-12 pb-6 border-t-4 border-meb-green
 * - 4 คอลัมน์: เกี่ยวกับ / บริการ / หมวดหมู่แผนกวิชา / ดาวน์โหลดแอป + โซเชียล
 * - bottom: copyright + เงื่อนไข + PDPA
 * Server component (ไม่ใช้ "use client")
 */
export function MemberFooter() {
  return (
    <footer className="bg-[#1f2937] text-white pt-12 pb-6 border-t-4 border-meb-green mt-auto">
      <div className="max-w-[1200px] mx-auto px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* คอลัมน์ 1: เกี่ยวกับ E-Library */}
        <div>
          <h3 className="text-white font-bold text-base mb-3">
            เกี่ยวกับ E-Library
          </h3>
          <p className="text-xs leading-relaxed text-gray-400 mb-4">
            ระบบห้องสมุดดิจิทัลของวิทยาลัยเทคนิคอำนาจเจริญ
            สืบค้น ยืม-คืน และอ่านอีบุ๊กได้ทุกที่ทุกเวลา
            พร้อมความรู้มากมายรอให้ค้นพบ
          </p>
          <div className="flex items-center gap-2 text-white">
            <PhosphorIcon name="buildings" weight="fill" className="text-2xl" />
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight leading-none">
                วท.อำนาจเจริญ
              </span>
              <span className="text-[10px] tracking-wider uppercase text-gray-400">
                E-Library
              </span>
            </div>
          </div>
        </div>

        {/* คอลัมน์ 2: บริการและช่วยเหลือ */}
        <div>
          <h3 className="text-white font-bold text-base mb-3">
            บริการและช่วยเหลือ
          </h3>
          <ul className="space-y-2.5 text-xs">
            {[
              { label: "วิธีล็อกอิน", href: "/help/faq" },
              { label: "วิธีอ่านออฟไลน์", href: "/help/faq" },
              { label: "กฎยืม-คืน", href: "/help/borrow" },
              { label: "ติดต่อศูนย์วิทยบริการ", href: "/contact" },
            ].map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center gap-1.5 text-gray-300 hover:text-meb-green transition"
                >
                  <PhosphorIcon
                    name="caret-right"
                    weight="bold"
                    className="text-[10px]"
                  />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* คอลัมน์ 3: หมวดหมู่แผนกวิชา */}
        <div>
          <h3 className="text-white font-bold text-base mb-3">
            หมวดหมู่แผนกวิชา
          </h3>
          <ul className="space-y-2.5 text-xs">
            {[
              { label: "ช่างยนต์", href: "/member/industrial" },
              { label: "ไฟฟ้ากำลัง", href: "/member/industrial" },
              { label: "ก่อสร้าง", href: "/member/industrial" },
              { label: "สารสนเทศ", href: "/member/commerce" },
              { label: "บัญชี", href: "/member/commerce" },
            ].map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center gap-1.5 text-gray-300 hover:text-meb-green transition"
                >
                  <PhosphorIcon
                    name="caret-right"
                    weight="bold"
                    className="text-[10px]"
                  />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* คอลัมน์ 4: ดาวน์โหลดแอป + โซเชียล */}
        <div>
          <h3 className="text-white font-bold text-base mb-3">ดาวน์โหลดแอป</h3>
          <div className="flex flex-col gap-2 mb-4">
            <Link
              href="/download/ios"
              className="inline-flex items-center gap-2 bg-black hover:bg-gray-900 transition px-3 py-2 rounded-md text-xs text-white"
            >
              <PhosphorIcon name="apple-logo" weight="fill" className="text-base" />
              <div className="flex flex-col leading-tight">
                <span className="text-[9px] text-gray-400">ดาวน์โหลดบน</span>
                <span className="font-semibold">App Store</span>
              </div>
            </Link>
            <Link
              href="/download/android"
              className="inline-flex items-center gap-2 bg-black hover:bg-gray-900 transition px-3 py-2 rounded-md text-xs text-white"
            >
              <PhosphorIcon
                name="google-play-logo"
                weight="fill"
                className="text-base text-meb-green"
              />
              <div className="flex flex-col leading-tight">
                <span className="text-[9px] text-gray-400">ดาวน์โหลดบน</span>
                <span className="font-semibold">Google Play</span>
              </div>
            </Link>
          </div>
          {/* ไอคอนโซเชียล — วงกลมพื้น gray-700 */}
          <div className="flex gap-3">
            {[
              { icon: "facebook-logo", href: "/social/facebook" },
              { icon: "youtube-logo", href: "/social/youtube" },
              { icon: "globe", href: "/social/website" },
            ].map((s) => (
              <Link
                key={s.icon}
                href={s.href}
                className="w-9 h-9 rounded-full bg-gray-700 hover:bg-meb-green flex items-center justify-center text-gray-300 hover:text-white transition"
                aria-label={s.icon}
              >
                <PhosphorIcon name={s.icon} weight="fill" className="text-base" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* แถบล่าง: copyright + เงื่อนไข + PDPA */}
      <div className="max-w-[1200px] mx-auto px-4 mt-10 pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
        <p>© 2026 วิทยาลัยเทคนิคอำนาจเจริญ E-Library</p>
        <div className="flex gap-5">
          <Link href="/terms" className="hover:text-meb-green transition">
            เงื่อนไขการให้บริการ
          </Link>
          <Link href="/privacy" className="hover:text-meb-green transition">
            นโยบายความเป็นส่วนตัว (PDPA)
          </Link>
        </div>
      </div>
    </footer>
  );
}