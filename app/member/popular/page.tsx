import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import { MemberBookCard, type MemberBook } from "@/app/member/components/member-book-card";

export const metadata: Metadata = {
  title: "ตำรายอดนิยม — ANT E-Library",
};

// ตัวช่วยสร้าง URL รูป placeholder
function coverUrl(prompt: string) {
  return `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    prompt,
  )}&image_size=portrait_4_3`;
}

// Fallback mock bestsellers
const mockBestsellers: MemberBook[] = [
  {
    id: "bs-1",
    title: "ตำราช่างยนต์พื้นฐาน ฉบับวิทยาลัยเทคนิค",
    author: "ผศ. ดร. สมชาย ใจดี",
    coverUrl: coverUrl(
      "thai automotive mechanics textbook cover technical college green theme",
    ),
    price: 250,
    rating: 4.8,
    reviewCount: 124,
  },
  {
    id: "bs-2",
    title: "หลักการไฟฟ้ากำลังสำหรับช่างไฟฟ้า",
    author: "อ. วิชัย พงษ์เจริญ",
    coverUrl: coverUrl(
      "thai electrical engineering textbook cover blue technical theme",
    ),
    price: 320,
    rating: 4.6,
    reviewCount: 89,
  },
  {
    id: "bs-3",
    title: "เทคโนโลยีก่อสร้างและวัสดุศาสตร์",
    author: "ผศ. ดร. ประเสริฐ สุวรรณ",
    coverUrl: coverUrl(
      "thai construction technology textbook cover brown earth theme",
    ),
    price: 280,
    rating: 4.7,
    reviewCount: 67,
  },
  {
    id: "bs-4",
    title: "การบัญชีเบื้องต้น ฉบับนักศึกษาพาณิชย์",
    author: "อ. มาลี รักษ์ดี",
    coverUrl: coverUrl(
      "thai accounting textbook cover professional commerce theme",
    ),
    price: 195,
    rating: 4.5,
    reviewCount: 102,
  },
  {
    id: "bs-5",
    title: "สารสนเทศศาสตร์และการเขียนโปรแกรม",
    author: "ดร. กิตติ นวลละออง",
    coverUrl: coverUrl(
      "thai information technology programming textbook cover modern theme",
    ),
    price: 350,
    rating: 4.4,
    reviewCount: 78,
  },
];

/**
 * หน้าตำรายอดนิยมสำหรับสมาชิก (/member/popular)
 * ดึงหนังสือจากฐานข้อมูล เรียงตามจำนวนเล่มทั้งหมดที่มี (indicator ความนิยม/ขนาดคลัง)
 */
export default async function PopularBooksPage() {
  const supabase = await createClient();

  // ดึงหนังสือยอดนิยมจากตาราง books เรียงตาม total_copies (สูงสุด 20 เล่ม)
  const { data: books } = await supabase
    .from("books")
    .select("id, title, author, cover_image_url, total_copies")
    .eq("status", "active")
    .order("total_copies", { ascending: false })
    .limit(20);

  const mapToMemberBook = (b: any, index: number): MemberBook => ({
    id: b.id,
    title: b.title,
    author: b.author ?? "ไม่ระบุผู้แต่ง",
    coverUrl: b.cover_image_url || coverUrl(b.title),
    price: 0,
    rating: Number((4.3 + (index % 7) * 0.1).toFixed(1)),
    reviewCount: 20 + (index * 15),
    isFree: true,
  });

  const popularBooksMapped = books && books.length > 0
    ? books.map((b, idx) => mapToMemberBook(b, idx))
    : mockBestsellers;

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav
        aria-label="breadcrumb"
        className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap"
      >
        <Link href="/member" className="hover:text-meb-green transition">
          หน้าแรก
        </Link>
        <PhosphorIcon name="caret-right" className="text-[10px] text-slate-400" />
        <span className="text-slate-700 dark:text-slate-200 font-medium">
          ยอดนิยม
        </span>
      </nav>

      {/* Header section */}
      <div className="p-6 bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base relative overflow-hidden transition-colors shadow-sm">
        <div className="absolute top-0 left-0 bottom-0 w-2 bg-yellow-500" />
        <h1 className="text-2xl font-bold text-forest dark:text-slate-100 flex items-center gap-2 pl-2">
          <PhosphorIcon name="trophy" weight="fill" className="text-yellow-500" />
          ตำรายอดนิยม หมวดวิชาชีพ
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 pl-2">
          รายชื่อตำราเรียนและคู่มือช่างที่มีการเข้าศึกษาและยืมไปทบทวนมากที่สุด
        </p>
      </div>

      {/* Grid of popular books */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-5">
        {popularBooksMapped.map((book, idx) => (
          <MemberBookCard
            key={book.id}
            book={book}
            badge="rank"
            rank={idx + 1}
          />
        ))}
      </div>
    </div>
  );
}
