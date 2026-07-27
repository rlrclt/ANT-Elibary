import Link from "next/link";
import { PhosphorIcon } from "./phosphor-icon";
import { ScrollReveal } from "./scroll-reveal";

/**
 * Final CTA Section — Terminal Area ตาม Gutenberg Diagram
 * ปุ่ม CTA หลักวางขวาล่าง (Desktop) / เต็มจอ (Mobile)
 */
export function FinalCTA() {
  return (
    <section className="bg-forest text-white py-12 sm:py-16 md:py-24 relative overflow-hidden">
      {/* Decorative texture — Explorecore */}
      <div
        aria-hidden="true"
        className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-meb-green/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-terracotta/15 blur-3xl"
      />

      <div className="relative max-w-[1200px] mx-auto px-4 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-center">
        {/* ซ้าย: ข้อความหลัก — 8 col, mobile center → desktop left */}
        <ScrollReveal
          direction="up"
          className="md:col-span-8 text-center md:text-left"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight mb-4">
            พร้อมยกระดับการเรียนรู้ของคุณแล้วหรือยัง?
          </h2>
          <p className="text-white/80 text-sm sm:text-base md:text-lg leading-relaxed max-w-xl mx-auto md:mx-0">
            สมัครสมาชิกวันนี้ เข้าถึงคลังหนังสือกว่า 5,000 รายการ
            พร้อมเครื่องมือช่วยอ่านที่ทันสมัย ฟรีสำหรับนักศึกษาและบุคลากร
            วิทยาลัยเทคนิคอำนาจเจริญ
          </p>
        </ScrollReveal>

        {/* ขวา: CTA หลัก — 4 col (Terminal Area), Mobile เต็มจอ */}
        <ScrollReveal
          direction="up"
          delay={120}
          className="md:col-span-4 flex flex-col gap-3 md:items-end"
        >
          <Link
            href="/register"
            className="btn-cta spotlight inline-flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta-hover text-white font-bold px-6 py-3.5 rounded-md text-base shadow-md w-full md:w-auto"
          >
            สมัครสมาชิก
            <PhosphorIcon name="arrow-right" />
          </Link>
          <Link
            href="/help/faq"
            className="inline-flex items-center justify-center gap-2 text-white/80 hover:text-white text-sm font-medium px-2 py-2 transition"
          >
            <PhosphorIcon name="question" />
            มีคำถาม? ดูคำถามที่พบบ่อย
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}