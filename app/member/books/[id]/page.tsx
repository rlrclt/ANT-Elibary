import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { BookDetail } from "./book-detail";
import {
  checkFavoriteAction,
  getMyRatingAction,
  getAverageRatingAction,
} from "../../favorites/actions";

/**
 * หน้ารายละเอียดหนังสือ — /member/books/[id]
 * - ดึงข้อมูลหนังสือพร้อมหมวดหมู่ (join book_categories)
 * - นับสำเนาตามสถานะ (available/borrowed/lost/damaged)
 * - ส่งข้อมูลให้ <BookDetail /> เรนเดอร์ UI
 */
type BookRow = {
  id: string;
  isbn: string | null;
  title: string;
  author: string | null;
  category_id: string | null;
  book_code: string;
  total_copies: number | null;
  available_copies: number | null;
  publisher: string | null;
  synopsis: string | null;
  page_count: number | null;
  shelf_location: string | null;
  cover_image_url: string | null;
  status: string;
  created_at: string;
  book_categories: {
    id: string;
    name: string;
    color_code: string | null;
  } | null;
};

type CopiesCount = {
  available: number;
  borrowed: number;
  lost: number;
  damaged: number;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: book } = await supabase
    .from("books")
    .select("title")
    .eq("id", id)
    .maybeSingle();

  return {
    title: book?.title ?? "รายละเอียดหนังสือ",
  };
}

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // ดึงหนังสือพร้อมหมวดหมู่
  const { data: book } = await supabase
    .from("books")
    .select("*, book_categories(id, name, color_code)")
    .eq("id", id)
    .maybeSingle();

  // ถ้าไม่พบหนังสือ → 404
  if (!book) {
    notFound();
  }

  const bookRow = book as BookRow;

  // นับสำเนาตามสถานะ
  const { data: copies } = await supabase
    .from("book_copies")
    .select("status")
    .eq("book_id", id);

  const copiesCount: CopiesCount = {
    available: 0,
    borrowed: 0,
    lost: 0,
    damaged: 0,
  };

  if (copies && copies.length > 0) {
    for (const copy of copies) {
      const status = copy.status as keyof CopiesCount;
      if (status in copiesCount) {
        copiesCount[status] += 1;
      }
    }
  }

  // แปลงข้อมูลให้ตรงกับ props type ของ <BookDetail />
  const bookDetail = {
    id: bookRow.id,
    book_code: bookRow.book_code,
    title: bookRow.title,
    author: bookRow.author,
    isbn: bookRow.isbn,
    publisher: bookRow.publisher,
    synopsis: bookRow.synopsis,
    page_count: bookRow.page_count,
    shelf_location: bookRow.shelf_location,
    cover_image_url: bookRow.cover_image_url,
    status: bookRow.status,
    total_copies: bookRow.total_copies ?? 0,
    available_copies: bookRow.available_copies ?? copiesCount.available,
    book_categories: bookRow.book_categories,
  };

  // ดึงข้อมูลรายการโปรด + คะแนน (parallel)
  const [favResult, myRatingResult, avgResult] = await Promise.all([
    checkFavoriteAction(bookRow.id),
    getMyRatingAction(bookRow.id),
    getAverageRatingAction(bookRow.id),
  ]);

  return (
    <BookDetail
      book={bookDetail}
      copiesCount={copiesCount}
      isFavorited={favResult.data ?? false}
      myRating={myRatingResult.data?.rating ?? 0}
      avgRating={avgResult.data?.avg ?? 0}
      ratingCount={avgResult.data?.count ?? 0}
    />
  );
}