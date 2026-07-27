import { PhosphorIcon } from "./phosphor-icon";
import { ScrollReveal } from "./scroll-reveal";

/**
 * Stats Section — Social Proof / Trust Signals
 * วางหลัง Hero ตามหลัก Progressive Disclosure
 * Mobile: 2-col grid (ตัวเลขใหญ่พอ), Desktop: 4-col
 */
const STATS = [
  { value: "5,000+", label: "รายการหนังสือ", icon: "books" },
  { value: "1,200+", label: "สมาชิกใช้งาน", icon: "users" },
  { value: "24/7", label: "เข้าถึงได้ตลอด", icon: "clock" },
  { value: "15+", label: "หมวดหมู่วิชา", icon: "grid-four" },
] as const;

export function Stats() {
  return (
    <section className="bg-white border-y border-gray-100">
      <div className="max-w-[1200px] mx-auto px-4 py-8 sm:py-10 md:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
          {STATS.map((s, i) => (
            <ScrollReveal
              key={s.label}
              delay={i * 80}
              className="flex items-center gap-3 md:gap-4"
            >
              <div className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-meb-light flex items-center justify-center text-meb-green text-xl shrink-0">
                <PhosphorIcon name={s.icon} weight="fill" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-forest leading-none">
                  {s.value}
                </p>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 truncate">
                  {s.label}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}