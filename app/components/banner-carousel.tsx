import Link from "next/link";
import { PhosphorIcon } from "./phosphor-icon";

export type Banner = {
  id: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  href: string;
  imageUrl: string;
  tone: "green" | "red" | "blue";
};

const TONE_CLASS: Record<Banner["tone"], string> = {
  green: "from-meb-green to-meb-hover",
  red: "from-price-red to-ribbon-red",
  blue: "from-info-blue-text to-blue-700",
};

/**
 * Banner Carousel แบบ snap scroll ตาม meb components.md ข้อ 4
 * เลื่อนแนวนอนได้บนมือถือ, หลายใบโชว์พร้อมกันบนเดสก์ท็อป
 */
export function BannerCarousel({ banners }: { banners: Banner[] }) {
  return (
    <section className="mb-8">
      <div className="flex gap-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible">
        {banners.map((b) => (
          <Link
            key={b.id}
            href={b.href}
            className={`relative shrink-0 w-[85%] md:w-auto snap-center rounded-xl overflow-hidden shadow-sm group bg-gradient-to-br ${TONE_CLASS[b.tone]} text-white`}
          >
            {/* รูปปก — ใช้ bg image เพื่อให้ overlay ทำงานได้ */}
            <div className="relative aspect-[16/7] md:aspect-[16/9]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.imageUrl}
                alt={b.title}
                className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:scale-105 group-hover:opacity-40 transition duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-black/30 to-transparent" />
            </div>

            {/* เนื้อหาบนภาพ */}
            <div className="absolute inset-0 p-5 md:p-6 flex flex-col justify-center">
              <h3 className="text-lg md:text-xl font-bold drop-shadow-sm leading-tight">
                {b.title}
              </h3>
              {b.subtitle && (
                <p className="text-xs md:text-sm text-white/90 mt-1 line-clamp-2">
                  {b.subtitle}
                </p>
              )}
              {b.ctaLabel && (
                <span className="inline-flex items-center gap-1 mt-3 text-xs font-medium bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-1.5 rounded-full w-fit transition">
                  {b.ctaLabel}
                  <PhosphorIcon name="caret-right" />
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}