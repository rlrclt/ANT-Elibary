import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import { MemberBookCard, type MemberBook } from "@/app/member/components/member-book-card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: category } = await supabase
    .from("book_categories")
    .select("name")
    .eq("id", id)
    .maybeSingle();

  return {
    title: `${category?.name ?? "หมวดหมู่หนังสือ"} — ANT E-Library`,
  };
}

// ตัวช่วยสร้าง URL รูป placeholder
function coverUrl(prompt: string) {
  return `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    prompt,
  )}&image_size=portrait_4_3`;
}

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. ดึงข้อมูลหมวดหมู่
  const { data: category } = await supabase
    .from("book_categories")
    .select("id, name, color_code")
    .eq("id", id)
    .maybeSingle();

  if (!category) {
    notFound();
  }

  // 2. ดึงหนังสือทั้งหมดในหมวดหมู่นี้
  const { data: books } = await supabase
    .from("books")
    .select("id, title, author, cover_image_url")
    .eq("category_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  // แปลงโครงสร้างหนังสือเป็น MemberBook สำหรับใช้กับการ์ด
  const mappedBooks: MemberBook[] = (books ?? []).map((b, idx) => ({
    id: b.id,
    title: b.title,
    author: b.author ?? "ไม่ระบุผู้แต่ง",
    coverUrl: b.cover_image_url || coverUrl(b.title),
    price: 0,
    rating: Number((4.2 + (idx % 8) * 0.1).toFixed(1)),
    reviewCount: 10 + (idx * 5),
    isFree: true,
  }));

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
        <Link href="/member/categories" className="hover:text-meb-green transition">
          หมวดหมู่ทั้งหมด
        </Link>
        <PhosphorIcon name="caret-right" className="text-[10px] text-slate-400" />
        <span className="text-slate-700 dark:text-slate-200 font-medium">
          {category.name}
        </span>
      </nav>

      {/* Header section */}
      <div className="p-6 bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base relative overflow-hidden transition-colors shadow-sm">
        <div
          className="absolute top-0 left-0 bottom-0 w-2"
          style={{ backgroundColor: category.color_code || "#60a5fa" }}
        />
        <h1 className="text-2xl font-bold text-forest dark:text-slate-100 flex items-center gap-2 pl-2">
          หมวดหมู่: {category.name}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 pl-2">
          มีหนังสือพร้อมให้บริการในหมวดนี้ทั้งหมด {mappedBooks.length} เล่ม
        </p>
      </div>

      {/* Books listing */}
      {mappedBooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base text-slate-400 transition-colors">
          <PhosphorIcon name="books" className="text-5xl mb-3" />
          <p className="text-sm">ยังไม่มีตำราหรือหนังสือในหมวดหมู่นี้</p>
          <Link
            href="/member/categories"
            className="text-sm font-bold text-meb-green hover:underline mt-4 flex items-center gap-1"
          >
            <PhosphorIcon name="arrow-left" weight="bold" />
            <span>ย้อนกลับไปดูหมวดหมู่อื่น</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-5">
          {mappedBooks.map((book) => (
            <MemberBookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}
