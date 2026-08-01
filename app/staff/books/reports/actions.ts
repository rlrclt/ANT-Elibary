"use server";

import { createClient } from "@/utils/supabase/server";
import { isBookOld } from "@/utils/book-age";

/**
 * Server Actions สำหรับ /staff/books/reports
 * รายงานหนังสือ: จำนวนเล่มแยกเก่า/ใหม่ + การลงทะเบียนนำเข้าตามวัน/เดือน/ปี แยกตามหมวดหมู่
 * Export: PDF (jsPDF) / CSV (Blob) / Excel (xlsx) — ทำฝั่ง client
 */

export type ReportCategory = {
  id: string;
  name: string;
  color_code: string | null;
};

export type ReportBook = {
  id: string;
  book_code: string;
  title: string;
  author: string | null;
  category_id: string | null;
  category_name: string | null;
  publication_year: number | null;
  status: string;
  total_copies: number;
  created_at: string;
  // virtual: หนังสือเก่า (อายุ ≥ 5 ปีนับจากปีพิมพ์)
  is_old: boolean;
};

// ---------- 1. getBookReportsAction ----------
/**
 * ดึงข้อมูลหนังสือทั้งหมด (รวมสถานะทุกแบบ) สำหรับวิเคราะห์รายงาน
 */
export async function getBookReportsAction(): Promise<{
  data: ReportBook[] | null;
  categories: ReportCategory[];
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, categories: [], error: "กรุณาเข้าสู่ระบบ" };
  }

  try {
    const [booksRes, catsRes] = await Promise.all([
      supabase
        .from("books")
        .select(
          "id, book_code, title, author, category_id, publication_year, status, total_copies, created_at, book_categories(id, name, color_code)",
        )
        .order("created_at", { ascending: false }),
      supabase.from("book_categories").select("id, name, color_code").order("name"),
    ]);

    if (booksRes.error) throw booksRes.error;
    if (catsRes.error) throw catsRes.error;

    const books: ReportBook[] = (booksRes.data ?? []).map((b: any) => ({
      id: b.id,
      book_code: b.book_code,
      title: b.title,
      author: b.author,
      category_id: b.category_id,
      category_name: b.book_categories?.name ?? "ไม่ระบุหมวด",
      publication_year: b.publication_year,
      status: b.status,
      total_copies: b.total_copies ?? 0,
      created_at: b.created_at,
      is_old: isBookOld(b.publication_year),
    }));

    return {
      data: books,
      categories: (catsRes.data ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        color_code: c.color_code,
      })),
      error: null,
    };
  } catch (err: any) {
    console.error("Error fetching book reports:", err);
    return {
      data: null,
      categories: [],
      error: err.message || "ไม่สามารถดึงข้อมูลรายงานได้",
    };
  }
}
