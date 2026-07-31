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
 * - ดึง rating + favorite status (เหมือนหน้า member หลัก)
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

  // ดึง user id (ถ้า login แล้ว) เพื่อเช็ครายการโปรด
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ดึง rating เฉลี่ยของหนังสือทั้งหมด (group by book_id)
  const bookIds = bookList.map((b) => b.id);
  let ratingMap = new Map<string, { avg: number; count: number }>();
  if (bookIds.length > 0) {
    try {
      const { data: ratings, error: ratingErr } = await supabase
        .from("book_ratings")
        .select("book_id, rating")
        .in("book_id", bookIds);
      if (!ratingErr && ratings) {
        for (const r of ratings) {
          const row = r as { book_id: string; rating: number };
          const existing = ratingMap.get(row.book_id) ?? { avg: 0, count: 0 };
          existing.avg =
            (existing.avg * existing.count + row.rating) /
            (existing.count + 1);
          existing.count += 1;
          ratingMap.set(row.book_id, existing);
        }
      }
    } catch {
      // table ไม่มี → ข้ามไป
    }
  }

  // ดึงรายการโปรดของ user (ถ้า login)
  let favSet = new Set<string>();
  if (user) {
    try {
      const { data: favs, error: favErr } = await supabase
        .from("book_favorites")
        .select("book_id")
        .eq("user_id", user.id);
      if (!favErr && favs) {
        for (const f of favs) {
          favSet.add((f as any).book_id);
        }
      }
    } catch {
      // table ไม่มี → ข้ามไป
    }
  }

  // แปลงข้อมูลหนังสือ → MemberBook (พร้อม rating + favorite)
  const memberBooks: MemberBook[] = bookList.map((b) => {
    const rating = ratingMap.get(b.id);
    return {
      id: b.id,
      title: b.title,
      author: b.author ?? "ไม่ระบุผู้แต่ง",
      coverUrl: b.cover_image_url || fallbackCover(b.title),
      price: 0,
      rating: rating?.avg ?? 0,
      reviewCount: rating?.count ?? 0,
      isFree: true,
      isFavorited: favSet.has(b.id),
    };
  });

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