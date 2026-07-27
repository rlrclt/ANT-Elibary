import Link from "next/link";
import { PhosphorIcon } from "../../components/phosphor-icon";
import type { ReactNode } from "react";

type SectionWrapperProps = {
  title: string;
  href?: string; // ถ้ามี = โชว์ "ดูทั้งหมด >"
  /** accent ก่อนชื่อ section 2 แบบ: แท่งเขียว หรือ ไอคอนสี */
  accent?: "bar" | { icon: string; className: string };
  children: ReactNode;
};

/**
 * SectionWrapper — กล่องขาวห่อแต่ละหมวด สำหรับหน้า member
 * - การ์ดขาว: bg-white dark:bg-card-bg rounded-xl shadow-sm border
 * - header: flex items-center justify-between mb-5
 *   - left: accent bar (w-1.5 h-6 bg-meb-green rounded-full) หรือ ไอคอน + h2
 *   - right: if href → Link "ดูทั้งหมด >"
 * Server component (ไม่ใช้ "use client")
 */
export function SectionWrapper({
  title,
  href,
  accent = "bar",
  children,
}: SectionWrapperProps) {
  return (
    <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm p-4 md:p-6 border border-gray-100 dark:border-border-base transition-colors">
      <div className="flex items-center justify-between mb-5">
        {/* left: accent + title */}
        <h2 className="text-xl md:text-2xl font-bold text-forest dark:text-slate-100 flex items-center gap-2.5">
          {accent === "bar" ? (
            <span className="w-1.5 h-6 bg-meb-green rounded-full shrink-0" />
          ) : (
            <PhosphorIcon
              name={accent.icon}
              weight="fill"
              className={accent.className}
            />
          )}
          {title}
        </h2>
        {/* right: ดูทั้งหมด > */}
        {href && (
          <Link
            href={href}
            className="text-sm font-medium text-meb-green hover:underline whitespace-nowrap"
          >
            ดูทั้งหมด &gt;
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}