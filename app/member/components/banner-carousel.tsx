"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";
// นำเข้า CSS ของ Swiper
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";

export type BannerSlide = {
  id: string;
  badge: string;
  headline: string;
  subtitle: string;
  /** URL รูปภาพพื้นหลังของสไลด์ — ถ้าไม่ส่งจะ generate จาก prompt อัตโนมัติ */
  imageUrl?: string;
};

type BannerCarouselProps = {
  slides?: BannerSlide[];
};

// helper: สร้าง URL รูปภาพจาก prompt ผ่าน text_to_image API (fallback เมื่อไม่มี imageUrl)
function makeImageUrl(prompt: string): string {
  return `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    prompt
  )}&image_size=landscape_16_9`;
}

// สไลด์ default — clone จาก member-interface.html (เพิ่ม imageUrl สำหรับทุกสไลด์)
const DEFAULT_SLIDES: BannerSlide[] = [
  {
    id: "default",
    badge: "เปิดเทอมใหม่ 2569",
    headline: "คลังปัญญาดิจิทัลเพื่ออนาคตสายอาชีพ",
    subtitle:
      "อ่านฟรีตำราเรียน คู่มือช่าง และหนังสือเฉพาะทาง กว่า 10,000 เล่ม สำหรับนักศึกษาวิทยาลัยเทคนิคอำนาจเจริญ",
    imageUrl: makeImageUrl(
      "คลังปัญญาดิจิทัล ห้องสมุดดิจิทัล นักศึกษาวิทยาลัยเทคนิค ตำราเรียน"
    ),
  },
  {
    id: "default-2",
    badge: "ห้องสมุดดิจิทัล",
    headline: "ค้นหา ยืม อ่าน ได้ทุกแผนกวิชา",
    subtitle:
      "ตำราเรียนและคู่มือช่างคุณภาพ ครบทุกหมวดหมู่ พร้อมให้บริการ 24 ชั่วโมง",
    imageUrl: makeImageUrl(
      "ห้องสมุดดิจิทัล ค้นหา ยืม อ่าน ตำราเรียน คู่มือช่าง หมวดหมู่"
    ),
  },
];

/**
 * BannerCarousel — ใช้ Swiper React
 * - loop + centeredSlides + slidesPerView=auto + spaceBetween=10
 * - autoplay delay 3500ms (ไม่หยุดเมื่อ interaction)
 * - pagination clickable + navigation arrows
 * - สไลด์กว้าง 80% (สูงสุด 800px) aspect 728/314 ไม่มี border-radius
 * - รูปเป็นพื้นหลัง + overlay ข้อความ (badge/headline/subtitle) gradient เพื่ออ่านง่าย
 * - pagination bullet active สีส้ม #f06b23, ปุ่ม nav ลูกศรขาว bg-black/30 rounded-full w-10 h-10
 * - รองรับ dark mode
 */
export function BannerCarousel({ slides = DEFAULT_SLIDES }: BannerCarouselProps) {
  const slideList = slides.length > 0 ? slides : DEFAULT_SLIDES;

  return (
    <div className="w-full">
      <Swiper
        modules={[Autoplay, Pagination, Navigation]}
        loop
        centeredSlides
        slidesPerView="auto"
        spaceBetween={10}
        autoplay={{ delay: 3500, disableOnInteraction: false }}
        pagination={{ clickable: true }}
        navigation
        className="!pb-10"
      >
        {slideList.map((slide) => {
          // ใช้ imageUrl ที่ส่งเข้ามา ถ้าไม่มีก็ generate จาก headline
          const imgSrc = slide.imageUrl ?? makeImageUrl(slide.headline);
          return (
            <SwiperSlide
              key={slide.id}
              className="!w-[80%] !max-w-[800px]"
            >
              <div
                className="relative w-full bg-gray-200 dark:bg-gray-800 overflow-hidden"
                style={{ aspectRatio: "728 / 314" }}
              >
                {/* รูปพื้นหลังของสไลด์ */}
                <img
                  src={imgSrc}
                  alt={slide.headline}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
                {/* gradient overlay เพื่อให้อ่านข้อความง่าย */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
                {/* เนื้อหา overlay */}
                <div className="absolute inset-0 flex flex-col justify-center px-6 md:px-12 text-white">
                  {/* badge */}
                  <div className="inline-block bg-white/20 backdrop-blur-sm border border-white/30 px-3 py-1 rounded-full text-xs font-bold mb-3 w-fit">
                    {slide.badge}
                  </div>
                  {/* headline */}
                  <h2 className="text-xl md:text-3xl font-bold mb-2 drop-shadow">
                    {slide.headline}
                  </h2>
                  {/* subtitle */}
                  <p className="text-xs md:text-sm text-white/90 max-w-lg drop-shadow">
                    {slide.subtitle}
                  </p>
                </div>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>

      {/* โอเวอร์รายด์สไตล์ pagination + navigation ให้เข้ากับธีม (รองรับ dark mode) */}
      <style>{`
        .swiper-pagination-bullet {
          background: rgba(255,255,255,0.6);
          opacity: 1;
        }
        .swiper-pagination-bullet-active {
          background: #f06b23 !important;
        }
        .swiper-button-prev,
        .swiper-button-next {
          width: 2.5rem;
          height: 2.5rem;
          background-color: rgba(0,0,0,0.3);
          border-radius: 9999px;
          color: #fff;
        }
        .swiper-button-prev:after,
        .swiper-button-next:after {
          font-size: 1rem;
          font-weight: bold;
        }
        .swiper-button-prev:hover,
        .swiper-button-next:hover {
          background-color: rgba(0,0,0,0.5);
        }
        .dark .swiper-pagination-bullet {
          background: rgba(255,255,255,0.4);
        }
      `}</style>
    </div>
  );
}