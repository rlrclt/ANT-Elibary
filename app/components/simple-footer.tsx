import Link from "next/link";

/**
 * Footer แบบเรียบ — สำหรับหน้า auth (/login, /register)
 * ตาม meb components.md ข้อ 12: หน้า transactional ใช้ footer เรียบ
 * เพื่อไม่ดึงความสนใจออกจาก CTA
 */
export function SimpleFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white py-6">
      <div className="max-w-[1200px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <p>© {new Date().getFullYear()} ANT E-Library — วิทยาลัยเทคนิคอำนาจเจริญ</p>
        <nav className="flex items-center gap-4">
          <Link href="/help/faq" className="hover:text-meb-green transition">
            คำถามที่พบบ่อย
          </Link>
          <Link href="/privacy" className="hover:text-meb-green transition">
            นโยบายความเป็นส่วนตัว
          </Link>
          <Link href="/contact" className="hover:text-meb-green transition">
            ติดต่อเรา
          </Link>
        </nav>
      </div>
    </footer>
  );
}