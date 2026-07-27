import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import {
  MemberBookCard,
  type MemberBook,
} from "../../components/member-book-card";

type CategoryRow = {
  id: string;
  name: string;
  color_code: string | null;
};

type BookRow = {
  id: string;
  title: string;
  author: string | null;
  cover_image_url: string | null;
};

/** สร้าง URL รูป placeholder สำรองเมื่อหนังสือไม่มี cover_image_url */
function fallbackCover(title: string) {
  return `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    "book cover " + title + " thai textbook",
  )}&image_size=portrait_4_3`;
}

/** metadata แบบ dynamic — ใช้ชื่อหมวดหมู่เป็น title */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: category } = (await supabase
    .from("book_categories")
    .select("name")
    .eq("id", id)
    .maybeSingle()) as { data: CategoryRow | null };

  return {
    title: category?.name ?? "หมวดหมู่หนังสือ",
  };
}

/**
 * หน้ารายละเอียดหมวดหมู่ — แสดงหนังสือทั้งหมดในหมวด
 * - ดึงหมวดตาม id (ถ้าไม่มี → notFound)
 * - ดึงหนังสือ active ในหมวดนั้น เรียงตาม title ASC
 * - แสดง breadcrumbs + ปุ่มย้อนกลับ + กริดหนังสือ
 */
export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // ดึงข้อมูลหมวดหมู่
  const { data: category } = (await supabase
    .from("book_categories")
    .select("id, name, color_code")
    .eq("id", id)
    .maybeSingle()) as { data: CategoryRow | null };

  if (!category) {
    notFound();
  }

  // ดึงหนังสือ active ในหมวดนี้ เรียงตาม title ASC
  const { data: books } = (await supabase
    .from("books")
    .select("id, title, author, cover_image_url")
    .eq("category_id", id)
    .eq("status", "active")
    .order("title", { ascending: true })) as { data: BookRow[] | null };

  const bookList: BookRow[] = books ?? [];
  const color = category.color_code ?? "#60a5fa";

  // แปลงข้อมูลหนังสือ → MemberBook
  const memberBooks: MemberBook[] = bookList.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author ?? "ไม่ระบุผู้แต่ง",
    coverUrl: b.cover_image_url || fallbackCover(b.title),
    price: 0,
    rating: 0,
    reviewCount: 0,
    isFree: true,
  }));

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
        <Link href="/member" className="hover:text-meb-green transition">
          หน้าแรก
        </Link>
        <PhosphorIcon name="caret-right" className="text-xs opacity-60" />
        <Link href="/member/categories" className="hover:text-meb-green transition">
          หมวดหมู่ทั้งหมด
        </Link>
        <PhosphorIcon name="caret-right" className="text-xs opacity-60" />
        <span className="text-slate-700 dark:text-slate-200 font-medium">
          {category.name}
        </span>
      </nav>

      {/* ปุ่มย้อนกลับ */}
      <Link
        href="/member/categories"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-meb-green hover:underline"
      >
        <PhosphorIcon name="arrow-left" weight="bold" className="text-base" />
        ย้อนกลับ
      </Link>

      {/* หัวหมวดหมู่ — badge สี + ชื่อ + จำนวนเล่ม */}
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center justify-center w-10 h-10 rounded-full shrink-0"
          style={{ backgroundColor: `${color}33`, border: `2px solid ${color}` }}
        >
          <PhosphorIcon
            name="books"
            weight="fill"
            className="text-lg"
          />
        </span>
        <span style={{ color }} className="flex items-center">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">
            {category.name}
          </h1>
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {memberBooks.length} เล่ม
        </span>
      </div>

      {/* กริดหนังสือ */}
      {memberBooks.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5">
          {memberBooks.map((book) => (
            <MemberBookCard key={book.id} book={book} badge="none" />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-12 text-center">
          <PhosphorIcon
            name="books"
            weight="fill"
            className="text-5xl text-slate-300 dark:text-slate-600 mb-3"
          />
          <p className="text-sm text-slate-400 dark:text-slate-500">
            ยังไม่มีหนังสือในหมวดหมู่นี้
          </p>
        </div>
      )}
    </div>
  );
}