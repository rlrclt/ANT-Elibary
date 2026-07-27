import { Header } from "./components/header";
import { Hero } from "./components/hero";
import { Stats } from "./components/stats";
import { MiniCTA } from "./components/mini-cta";
import { Features } from "./components/features";
import { FinalCTA } from "./components/final-cta";
import { Footer } from "./components/footer";
import { PublicAnnouncements } from "./components/public-announcements";

/**
 * ANT E-Library — วิทยาลัยเทคนิคอำนาจเจริญ
 * Landing Page (ไม่มีหนังสือแนะนำ — เน้นพูดถึงตัวระบบห้องสมุดดิจิทัล)
 *
 * ออกแบบตาม:
 * - meb-design-system/referencs/* (tokens, components, page-patterns)
 * - เทมเพลส/* (color theory 60:30:10, responsive grid, web design patterns, animation)
 *
 * Layout flow ตาม Z-Pattern + Progressive Disclosure:
 *   Header → Hero (Headline + CTA) → Stats (Trust) → MiniCTA (แทรก CTA ซ้ำตาม scroll) → Features (3 blocks) → FinalCTA (Terminal Area) → Footer
 */
export default function HomePage() {
  return (
    <>
      <Header />

      <main className="flex-1 flex flex-col">
        {/* Hero — Entry point, จับสายตาภายใน 3 วินาที */}
        <Hero />

        {/* Stats — Social proof สั้นๆ สร้างความน่าเชื่อถือ */}
        <Stats />

        {/* MiniCTA — แทรกปุ่ม CTA ซ้ำตาม spec มือถือ (ทุก 2-3 ช่วง scroll) */}
        <MiniCTA />

        {/* Features — 3 ฟีเจอร์หลักของระบบ แบ่ง 4 columns each */}
        <Features />

        {/* Final CTA — Terminal Area, ปิดการขายด้านล่าง */}
        <FinalCTA />
      </main>

      <Footer />

      {/* Popup ประกาศบนหน้าแรก (fixed overlay, dismiss แล้วเก็บใน localStorage) */}
      <PublicAnnouncements />
    </>
  );
}