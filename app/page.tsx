import { Header } from "./components/header";
import { Hero } from "./components/hero";
import { Stats } from "./components/stats";
import { MiniCTA } from "./components/mini-cta";
import { Features } from "./components/features";
import { FinalCTA } from "./components/final-cta";
import { Footer } from "./components/footer";
import { PublicAnnouncements } from "./components/public-announcements";
import { createAdminClient } from "@/utils/supabase/admin";

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
export default async function HomePage() {
  const supabaseAdmin = createAdminClient();
  
  const [
    { count: booksCount },
    { count: usersCount },
    { count: categoriesCount }
  ] = await Promise.all([
    supabaseAdmin.from('books').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('book_categories').select('*', { count: 'exact', head: true })
  ]);
  return (
    <>
      <Header />

      <main className="flex-1 flex flex-col">
        {/* Hero — Entry point, จับสายตาภายใน 3 วินาที */}
        <Hero />

        {/* MiniCTA — แทรกปุ่ม CTA ซ้ำตาม spec มือถือ (ทุก 2-3 ช่วง scroll) */}
        <MiniCTA />

        {/* Features — 3 ฟีเจอร์หลักของระบบ แบ่ง 4 columns each */}
        <Features />

        {/* Stats — Social proof แบบกราฟ */}
        <Stats 
          booksCount={booksCount || 0} 
          usersCount={usersCount || 0} 
          categoriesCount={categoriesCount || 0} 
        />

        {/* Final CTA — Terminal Area, ปิดการขายด้านล่าง */}
        <FinalCTA />
      </main>

      <Footer />

      {/* Popup ประกาศบนหน้าแรก (fixed overlay, dismiss แล้วเก็บใน localStorage) */}
      <PublicAnnouncements />
    </>
  );
}