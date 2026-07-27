import Link from "next/link";
import { PhosphorIcon } from "./phosphor-icon";
import { ScrollReveal } from "./scroll-reveal";

/**
 * Hero Section สำหรับ Landing Page
 * ออกแบบตาม Z-Pattern + 60:30:10
 * ตาม responsive-grid-and-layout-spec.md:
 * - Desktop: 12-col grid, headline 6 col ชิดซ้าย, visual 6 col ขวา
 * - Tablet: 8-col, 4/4 split
 * - Mobile: 4-col single-column stack, headline ชิดซ้าย/กลาง, CTA กว้างเต็มจอให้นิ้วโป้งกดง่าย
 */
export function Hero() {
  return (
    <section className="relative bg-cream overflow-hidden">
      {/* Background decorative blob — Explorecore vibe */}
      <div
        aria-hidden="true"
        className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-meb-light/60 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-forest/5 blur-3xl"
      />

      <div className="relative max-w-[1200px] mx-auto px-4 py-12 sm:py-16 md:py-24 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
        {/* ซ้าย: Headline + CTA — Mobile: stack ลงล่าง, Desktop: 6/12 col ชิดซ้าย */}
        <ScrollReveal
          direction="up"
          className="md:col-span-6 text-center md:text-left"
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-meb-light text-meb-hover px-3 py-1.5 rounded-full mb-5">
            <PhosphorIcon name="books" weight="fill" className="text-sm" />
            วิทยาลัยเทคนิคอำนาจเจริญ
          </span>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-forest leading-tight mb-4">
            ห้องสมุดดิจิทัล
            <br />
            <span className="text-meb-green">ในมือของคุณ</span>
            <span className="text-terracotta">.</span>
          </h1>

          <p className="text-base md:text-lg text-slate-600 mb-8 max-w-lg mx-auto md:mx-0 leading-relaxed">
            สืบค้น ยืม-คืน และอ่านอีบุ๊กได้ทุกที่ทุกเวลา
            ระบบห้องสมุดดิจิทัลที่พร้อมยกระดับการเรียนรู้
            ของนักศึกษาและบุคลากร วิทยาลัยเทคนิคอำนาจเจริญ
          </p>

          {/* Mobile: ปุ่มกว้างเต็มจอให้นิ้วโป้งกดง่าย (ตาม spec มือถือ) */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <Link
              href="/register"
              className="btn-cta spotlight inline-flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta-hover text-white font-bold px-6 py-3.5 rounded-md text-sm md:text-base shadow-sm w-full sm:w-auto"
            >
              เริ่มอ่านฟรีตอนนี้
              <PhosphorIcon name="arrow-right" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-forest font-medium px-6 py-3.5 rounded-md text-sm md:text-base border border-gray-200 transition w-full sm:w-auto"
            >
              เข้าสู่ระบบ
            </Link>
          </div>
        </ScrollReveal>

        {/* ขวา: Hero visual — Mobile: ต่อจาก CTA, Desktop: 6/12 col */}
        <ScrollReveal
          direction="left"
          delay={120}
          className="md:col-span-6"
        >
          <div className="relative">
            {/* กรอบภาพสไตล์ Explorecore */}
            <div className="relative rounded-2xl overflow-hidden shadow-md aspect-[4/3] bg-gradient-to-br from-meb-light to-cream">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=serene%20modern%20library%20reading%20nook%20soft%20beige%20cream%20tone%20warm%20sunlight%20plants%20cozy%20explorecore%20aesthetic&image_size=landscape_4_3"
                alt="บรรยากาศห้องสมุดดิจิทัล"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-forest/20 to-transparent" />
            </div>

            {/* floating stat card — Data Visualization vibe */}
            <div className="absolute -bottom-5 -left-3 sm:-left-5 md:-left-8 bg-white rounded-xl shadow-lg p-3 sm:p-4 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-meb-light flex items-center justify-center text-meb-green text-xl shrink-0">
                  <PhosphorIcon name="book-open-text" weight="fill" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">หนังสือในระบบ</p>
                  <p className="text-base sm:text-lg font-bold text-forest leading-none">
                    5,000+
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}