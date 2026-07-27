import Link from "next/link";
import { PhosphorIcon } from "./phosphor-icon";
import { ScrollReveal } from "./scroll-reveal";

/**
 * Mini CTA Bar — แทรกระหว่าง section ตาม responsive-grid-and-layout-spec.md
 * ข้อ 3.3: "แทรกปุ่ม CTA ลงไปในเลย์เอาต์ทุกๆ ระยะการปัดหน้าจอ 2-3 ช่วง
 * เพื่อป้องกันไม่ให้ผู้ใช้เหนื่อยกับการเลื่อนขึ้นด้านบนเวลาตัดสินใจกรอกสมาชิก"
 */
export function MiniCTA() {
  return (
    <section className="bg-white py-6 sm:py-8">
      <div className="max-w-[1200px] mx-auto px-4">
        <ScrollReveal className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-meb-light/60 rounded-xl p-5 sm:p-6 border border-meb-light">
          <div className="text-center sm:text-left">
            <p className="text-sm sm:text-base font-semibold text-forest">
              เริ่มอ่านฟรีวันนี้
            </p>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              สมัครสมาชิกเพื่อเข้าถึงคลังหนังสือทั้งหมด
            </p>
          </div>
          <Link
            href="/register"
            className="btn-cta inline-flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta-hover text-white font-bold px-5 py-2.5 rounded-md text-sm shadow-sm w-full sm:w-auto whitespace-nowrap"
          >
            สมัครเลย
            <PhosphorIcon name="arrow-right" />
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}