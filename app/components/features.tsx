import { PhosphorIcon } from "./phosphor-icon";
import { ScrollReveal } from "./scroll-reveal";

/**
 * Features Section — 3 blocks ย่อยเท่ากัน (4 columns each on desktop)
 * ตาม responsive-grid-and-layout-spec.md ข้อ 3.1
 * Mobile: single-column stack, แต่ละการ์ด card-lift hover
 */
const FEATURES = [
  {
    icon: "books",
    title: "คลังหนังสือแสนเล่ม",
    description:
      "รวบรวมหนังสือ ตำรา และสื่อการเรียนรู้ครบทุกหมวด ค้นหาง่าย พร้อมระบบแนะนำที่เข้าใจความสนใจของคุณ",
    accent: "bg-meb-light text-meb-green",
  },
  {
    icon: "wifi-high",
    title: "อ่านออฟไลน์ได้",
    description:
      "ดาวน์โหลดอีบุ๊กไปอ่านได้ทุกที่ แม้ไม่มีอินเทอร์เน็ต ที่คั่นหน้าและบันทึกของคุณถูกซิงค์อัตโนมัติ",
    accent: "bg-blue-50 text-blue-600",
  },
  {
    icon: "sparkle",
    title: "สรุปเนื้อหาด้วย AI",
    description:
      "ระบบอัจฉริยะช่วยสรุปใจความสำคัญ ตอบคำถามจากเนื้อหาหนังสือ และแนะนำสิ่งที่น่าอ่านต่อไป",
    accent: "bg-orange-50 text-terracotta",
  },
] as const;

export function Features() {
  return (
    <section className="bg-cream py-12 sm:py-16 md:py-24">
      <div className="max-w-[1200px] mx-auto px-4">
        {/* Section header — ชิดซ้ายตาม F-pattern, mobile ชิดซ้ายเสมอ */}
        <ScrollReveal className="max-w-2xl mb-10 sm:mb-12">
          <span className="inline-block w-1.5 h-6 bg-meb-green rounded-full mb-4" />
          <h2 className="text-2xl sm:text-3xl md:text-3xl font-bold text-forest mb-3">
            ทำไมต้อง ANT E-Library?
          </h2>
          <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
            เราออกแบบระบบห้องสมุดดิจิทัลเพื่อยกระดับประสบการณ์การอ่าน
            ให้นักศึกษาและบุคลากรเข้าถึงความรู้ได้ง่าย สะดวก และทันสมัย
          </p>
        </ScrollReveal>

        {/* 3 blocks — Mobile: 1-col stack, Desktop: 3-col 4 col each */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 md:gap-8">
          {FEATURES.map((f, i) => (
            <ScrollReveal
              key={f.title}
              as="article"
              delay={i * 100}
              className="card-lift bg-white rounded-xl p-5 sm:p-6 md:p-7 shadow-sm border border-gray-100"
            >
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl mb-5 ${f.accent}`}
              >
                <PhosphorIcon name={f.icon} weight="fill" />
              </div>
              <h3 className="text-lg font-bold text-forest mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {f.description}
              </p>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}