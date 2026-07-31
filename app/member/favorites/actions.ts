"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server Actions สำหรับระบบรายการโปรด + ให้ดาวหนังสือ (/member/favorites)
 * ใช้ session ของสมาชิกที่ล็อกอินอยู่ ไม่ต้องส่ง user_id มาจาก client
 * จัดการ book_favorites และ book_ratings
 */

// ---------- Types ----------
export type FavoriteBook = {
  id: string; // id ของแถว book_favorites
  book_id: string;
  title: string;
  author: string | null;
  cover_image_url: string | null;
  book_code: string;
  category_name: string | null;
  category_color: string | null;
};

type ActionResult<T> = { data: T | null; error: string | null };

// ---------- 1. getMyFavoritesAction ----------
/**
 * ดึงรายการโปรดทั้งหมดของสมาชิกที่ล็อกอินอยู่
 * join books + book_categories เพื่อแสดงข้อมูลในการ์ด
 */
export async function getMyFavoritesAction(): Promise<
  ActionResult<FavoriteBook[]>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "กรุณาเข้าสู่ระบบ" };

  const { data, error } = await supabase
    .from("book_favorites")
    .select(
      `
      id,
      books!book_favorites_book_id_fkey (
        id, title, author, cover_image_url, book_code,
        book_categories ( name, color_code )
      )
      `,
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };

  const favorites: FavoriteBook[] = (data ?? []).map((f: any) => ({
    id: f.id,
    book_id: f.books?.id ?? "",
    title: f.books?.title ?? "ไม่ระบุชื่อ",
    author: f.books?.author ?? null,
    cover_image_url: f.books?.cover_image_url ?? null,
    book_code: f.books?.book_code ?? "",
    category_name: f.books?.book_categories?.name ?? null,
    category_color: f.books?.book_categories?.color_code ?? null,
  }));

  return { data: favorites, error: null };
}

// ---------- 2. toggleFavoriteAction ----------
/**
 * สลับสถานะรายการโปรด: ถ้ามีอยู่ → DELETE, ถ้ายังไม่มี → INSERT
 */
export async function toggleFavoriteAction(
  formData: FormData,
): Promise<{ error: string | null; isFavorited: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ", isFavorited: false };

  const bookId = String(formData.get("bookId") ?? "").trim();
  if (!bookId) return { error: "ไม่พบ ID หนังสือ", isFavorited: false };

  // ตรวจว่ามีอยู่แล้วหรือไม่
  const { data: existing } = await supabase
    .from("book_favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .maybeSingle();

  if (existing) {
    // มีอยู่ → ลบ
    const { error: delErr } = await supabase
      .from("book_favorites")
      .delete()
      .eq("id", existing.id);

    if (delErr) return { error: delErr.message, isFavorited: true };

    revalidatePath("/member/favorites");
    revalidatePath(`/member/books/${bookId}`);
    return { error: null, isFavorited: false };
  }

  // ไม่มี → เพิ่ม
  const { error: insErr } = await supabase
    .from("book_favorites")
    .insert({ user_id: user.id, book_id: bookId });

  if (insErr) return { error: insErr.message, isFavorited: false };

  revalidatePath("/member/favorites");
  revalidatePath(`/member/books/${bookId}`);
  return { error: null, isFavorited: true };
}

// ---------- 3. checkFavoriteAction ----------
/**
 * ตรวจสอบว่าหนังสือเล่มนี้อยู่ในรายการโปรดของสมาชิกหรือไม่
 */
export async function checkFavoriteAction(
  bookId: string,
): Promise<ActionResult<boolean>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: false, error: "กรุณาเข้าสู่ระบบ" };

  const { data, error } = await supabase
    .from("book_favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .maybeSingle();

  if (error) return { data: false, error: error.message };

  return { data: !!data, error: null };
}

// ---------- 4. rateBookAction ----------
/**
 * ให้คะแนนหนังสือ (1-5) พร้อมรีวิว (optional)
 * UPSERT: ถ้ามี rating อยู่แล้ว → UPDATE, ถ้ายังไม่มี → INSERT
 */
export async function rateBookAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const bookId = String(formData.get("bookId") ?? "").trim();
  const ratingStr = String(formData.get("rating") ?? "").trim();
  const review = String(formData.get("review") ?? "").trim() || null;

  if (!bookId) return { error: "ไม่พบ ID หนังสือ" };

  const rating = Number(ratingStr);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5)
    return { error: "คะแนนต้องอยู่ระหว่าง 1-5" };

  // ตรวจว่ามี rating อยู่แล้วหรือไม่
  const { data: existing } = await supabase
    .from("book_ratings")
    .select("id")
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .maybeSingle();

  if (existing) {
    // มีอยู่ → UPDATE
    const { error: updErr } = await supabase
      .from("book_ratings")
      .update({ rating, review, updated_at: new Date().toISOString() })
      .eq("id", existing.id);

    if (updErr) return { error: updErr.message };
  } else {
    // ไม่มี → INSERT
    const { error: insErr } = await supabase
      .from("book_ratings")
      .insert({ user_id: user.id, book_id: bookId, rating, review });

    if (insErr) return { error: insErr.message };
  }

  revalidatePath(`/member/books/${bookId}`);
  return { error: null };
}

// ---------- 5. getMyRatingAction ----------
/**
 * ดึงคะแนนและรีวิวของสมาชิกคนปัจจุบันสำหรับหนังสือเล่มนี้
 */
export async function getMyRatingAction(
  bookId: string,
): Promise<ActionResult<{ rating: number; review: string | null }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "กรุณาเข้าสู่ระบบ" };

  const { data, error } = await supabase
    .from("book_ratings")
    .select("rating, review")
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };

  return {
    data: {
      rating: Number((data as any).rating),
      review: (data as any).review ?? null,
    },
    error: null,
  };
}

// ---------- 6. getAverageRatingAction ----------
/**
 * ดึงคะแนนเฉลี่ยและจำนวนรีวิวของหนังสือเล่มนี้
 */
export async function getAverageRatingAction(
  bookId: string,
): Promise<ActionResult<{ avg: number; count: number }>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("book_ratings")
    .select("rating")
    .eq("book_id", bookId);

  if (error) return { data: { avg: 0, count: 0 }, error: error.message };

  const ratings = (data ?? []).map((r: any) => Number(r.rating));
  const count = ratings.length;
  const avg =
    count > 0 ? ratings.reduce((sum, r) => sum + r, 0) / count : 0;

  return {
    data: {
      avg: Math.round(avg * 10) / 10, // เก็บ 1 ตำแหน่งทศนิยม
      count,
    },
    error: null,
  };
}