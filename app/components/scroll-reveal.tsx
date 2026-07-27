"use client";

import {
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";

/**
 * ScrollReveal — scroll-triggered animation ตาม web-animation-design-guide.md
 * ใช้ IntersectionObserver (ไม่พึ่ง Script ใหญ่ — ตรงข้อกำหนดข้อ 1)
 * ค่อยๆ fade-up ทีละ section ตามการปัด (Progressive Disclosure)
 *
 * ใช้: <ScrollReveal>...</ScrollReveal> หรือ <ScrollReveal delay={120} as="article">
 */
type ScrollRevealProps = {
  children: ReactNode;
  /** หน่วงเวลาเริ่ม (ms) — สำหรับทยอยเปิดทีละ item */
  delay?: number;
  /** ทิศทาง slide */
  direction?: "up" | "left" | "right" | "none";
  /** tag หุ้ม (default div) */
  as?: ElementType;
  className?: string;
};

export function ScrollReveal({
  children,
  delay = 0,
  direction = "up",
  as: Tag = "div",
  className = "",
}: ScrollRevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // เคารพ prefers-reduced-motion — โผล่ทันที ไม่ animate
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hiddenTranslate =
    direction === "up"
      ? "translate-y-6"
      : direction === "left"
        ? "-translate-x-6"
        : direction === "right"
          ? "translate-x-6"
          : "";

  return (
    <Tag
      ref={ref as never}
      className={`${className} transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        visible ? "opacity-100 translate-x-0 translate-y-0" : `opacity-0 ${hiddenTranslate}`
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}