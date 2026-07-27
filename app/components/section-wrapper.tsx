import Link from "next/link";
import { PhosphorIcon } from "./phosphor-icon";
import { ReactNode } from "react";

type SectionWrapperProps = {
  title: string;
  href?: string; // ถ้ามี = โชว์ "ดูทั้งหมด >"
  /** accent ก่อนชื่อ section 2 แบบ: แท่งเขียว หรือ ไอคอนสี */
  accent?: "bar" | { icon: string; className: string };
  children: ReactNode;
  className?: string;
};

/**
 * Section Wrapper กล่องขาวห่อแต่ละหมวด ตาม meb components.md ข้อ 5
 * มี header แบบ "ชื่อ + ดูทั้งหมด >" คั่นด้วยเส้นบาง
 */
export function SectionWrapper({
  title,
  href,
  accent = "bar",
  children,
  className = "",
}: SectionWrapperProps) {
  return (
    <section
      className={`bg-white rounded-lg p-4 md:p-5 shadow-sm border border-gray-100 mb-8 ${className}`}
    >
      <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
        <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
          {accent === "bar" ? (
            <span className="w-1.5 h-6 bg-meb-green rounded-full" />
          ) : (
            <PhosphorIcon
              name={accent.icon}
              weight="fill"
              className={accent.className}
            />
          )}
          {title}
        </h2>
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