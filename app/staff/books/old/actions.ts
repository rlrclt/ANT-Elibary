"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { isBookOld, getOldCutoffYear } from "@/utils/book-age";

/**
 * Server Actions สำหรับ /staff/books/old
 * หน้าจัดการหนังสือที่อายุ 5 ปีขึ้นไป (นับจากปีที่พิมพ์)
 * - แสดงหนังสือครบเกณฑ์ทั้งหมด + หนังสือที่ย้ายเป็น "หนังสือเก่า" แล้ว
 * - แอดมินกด "ย้ายเป็นหนังสือเก่า" เอง; ถ้ายังมีเล่มถูกยืมอยู่ต้องรอคืนก่อน
 */

export type OldBook = {
  id: string;
  book_code: string;
  title: string;
  author: string | null;
  isbn: string | null;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  publication_year: number | null;
  status: string;
  total_copies: number;
  available_copies: number;
  borrowed_count: number;
  created_at: string;
  // virtual: ครบเกณฑ์ 5 ปี (จาก publication_year)
  is_old_eligible: boolean;
  // virtual: เคยถูกย้ายเป็นหนังสือเก่าแล้ว
  is_marked_old: boolean;
};

// ---------- 1. getOldBooksAction ----------
/**
 * ดึงหนังสือทุกเล่มที่อายุครบ 5 ปี (publication_year <= cutoff)
 * รวมทั้งที่ย้ายเป็นหนังสือเก่าแล้วและที่ยัง active อยู่
 */
export async function getOldBooksAction(): Promise<{
  data: OldBook[] | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const cutoff = getOldCutoffYear();

  // ดึงหนังสือที่ครบเกณฑ์ทั้งหมด
  const { data, error } = await supabase
    .from("books")
    .select(
      "id, book_code, title, author, isbn, category_id, total_copies, available_copies, publication_year, status, created_at, book_categories(id, name, color_code)",
    )
    .lte("publication_year", cutoff)
    .order("publication_year", { ascending: false });

  if (error) return { data: null, error: error.message };

  const rows = data ?? [];

  // นับเล่มที่ถูกยืมอยู่ต่อหนังสือ (สำหรับบล็อก action)
  const borrowedByBook: Record<string, number> = {};
  if (rows.length > 0) {
    const { data: borrowedRows } = await supabase
      .from("book_copies")
      .select("book_id")
      .eq("status", "borrowed")
      .in(
        "book_id",
        rows.map((r) => r.id),
      );
    for (const br of borrowedRows ?? []) {
      borrowedByBook[br.book_id] = (borrowedByBook[br.book_id] ?? 0) + 1;
    }
  }

  const books: OldBook[] = rows.map((b: any) => ({
    id: b.id,
    book_code: b.book_code,
    title: b.title,
    author: b.author,
    isbn: b.isbn,
    category_id: b.category_id,
    category_name: b.book_categories?.name ?? null,
    category_color: b.book_categories?.color_code ?? null,
    publication_year: b.publication_year,
    status: b.status,
    total_copies: b.total_copies,
    available_copies: b.available_copies,
    borrowed_count: borrowedByBook[b.id] ?? 0,
    created_at: b.created_at,
    is_old_eligible: isBookOld(b.publication_year),
    is_marked_old: b.status === "old",
  }));

  return { data: books, error: null };
}
