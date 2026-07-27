"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server Actions สำหรับ /staff/books
 * ทำงานฝั่ง server, ใช้ supabase admin (service_role) ผ่าน server client
 * ปฏิบัติตาม spec ใน docs/specs/staff_books_management_system.md
 */

// ---------- Types ----------
export type BookWithCategory = {
  id: string;
  book_code: string;
  title: string;
  author: string | null;
  isbn: string | null;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  total_copies: number;
  available_copies: number;
  publisher: string | null;
  shelf_location: string | null;
  cover_image_url: string | null;
  status: string;
  created_at: string;
};

export type BookCopy = {
  id: string;
  book_id: string;
  barcode: string;
  status: "available" | "borrowed" | "lost" | "damaged";
  condition: "new" | "good" | "fair" | "poor";
  price: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  name: string;
  color_code: string | null;
};

// ---------- 1. getBooksAction ----------
export async function getBooksAction(filters?: {
  search?: string;
  categoryId?: string;
  availability?: "all" | "available" | "out";
}) {
  const supabase = await createClient();
  let query = supabase
    .from("books")
    .select(
      "id, book_code, title, author, isbn, category_id, total_copies, available_copies, publisher, shelf_location, cover_image_url, status, created_at, book_categories(id, name, color_code)",
    )
    .order("created_at", { ascending: false });

  if (filters?.search) {
    const s = filters.search.trim();
    // ilike ใช้ OR ครั้งเดียวต่อ query
    query = query.or(
      `title.ilike.%${s}%,author.ilike.%${s}%,isbn.ilike.%${s}%,book_code.ilike.%${s}%,shelf_location.ilike.%${s}%`,
    );
  }
  if (filters?.categoryId && filters.categoryId !== "all") {
    query = query.eq("category_id", filters.categoryId);
  }
  if (filters?.availability === "available") {
    query = query.gt("available_copies", 0);
  } else if (filters?.availability === "out") {
    query = query.eq("available_copies", 0);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  // flatten category
  const books: BookWithCategory[] = (data ?? []).map((b: any) => ({
    id: b.id,
    book_code: b.book_code,
    title: b.title,
    author: b.author,
    isbn: b.isbn,
    category_id: b.category_id,
    category_name: b.book_categories?.name ?? null,
    category_color: b.book_categories?.color_code ?? null,
    total_copies: b.total_copies,
    available_copies: b.available_copies,
    publisher: b.publisher,
    shelf_location: b.shelf_location,
    cover_image_url: b.cover_image_url,
    status: b.status,
    created_at: b.created_at,
  }));

  return { data: books, error: null };
}

// ---------- 2. getStatCardsAction ----------
export async function getStatCardsAction() {
  const supabase = await createClient();
  const [
    { count: titleCount },
    { data: sums },
    { count: damagedCount },
    { count: lostCount },
  ] = await Promise.all([
    supabase
      .from("books")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase.from("books").select("total_copies, available_copies"),
    supabase
      .from("book_copies")
      .select("*", { count: "exact", head: true })
      .eq("status", "damaged"),
    supabase
      .from("book_copies")
      .select("*", { count: "exact", head: true })
      .eq("status", "lost"),
  ]);

  const totalCopies = sums?.reduce((a, b: any) => a + (b.total_copies ?? 0), 0) ?? 0;
  const availableCopies =
    sums?.reduce((a, b: any) => a + (b.available_copies ?? 0), 0) ?? 0;

  return {
    data: {
      titles: titleCount ?? 0,
      totalCopies,
      availableCopies,
      damagedLost: (damagedCount ?? 0) + (lostCount ?? 0),
    },
    error: null,
  };
}

// ---------- 3. generateBookCodeAction ----------
/** สร้าง book_code อัตโนมัติ เช่น BK-2026-001, BK-2026-002 */
export async function generateBookCodeAction(): Promise<{
  data: string | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const prefix = `BK-${year}-`;

  // ดึง book_code ล่าสุดของปีนี้
  const { data, error } = await supabase
    .from("books")
    .select("book_code")
    .like("book_code", `${prefix}%`)
    .order("book_code", { ascending: false })
    .limit(1);

  if (error) return { data: null, error: error.message };

  let next = 1;
  if (data && data.length > 0) {
    const last = data[0].book_code;
    const num = parseInt(last.replace(prefix, ""), 10);
    if (!isNaN(num)) next = num + 1;
  }
  return { data: `${prefix}${next.toString().padStart(3, "0")}`, error: null };
}

// ---------- 4. registerBookAction ----------
export async function registerBookAction(formData: FormData) {
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  const author = String(formData.get("author") ?? "").trim() || null;
  const isbn = String(formData.get("isbn") ?? "").trim() || null;
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const publisher = String(formData.get("publisher") ?? "").trim() || null;
  const shelfLocation = String(formData.get("shelf_location") ?? "").trim() || null;
  const coverImageUrl = String(formData.get("cover_image_url") ?? "").trim() || null;
  const initialCopies = parseInt(String(formData.get("initial_copies") ?? "1"), 10);
  const bookCode = String(formData.get("book_code") ?? "").trim();

  if (!title) return { error: "กรุณากรอกชื่อหนังสือ" };
  if (!bookCode) return { error: "กรุณากรอกรหัสหนังสือ" };
  if (initialCopies < 1) return { error: "จำนวนเล่มตั้งต้นต้องมากกว่า 0" };

  // 1. INSERT เล่มแม่
  const { data: book, error: bookErr } = await supabase
    .from("books")
    .insert({
      book_code: bookCode,
      title,
      author,
      isbn,
      category_id: categoryId || null,
      publisher,
      shelf_location: shelfLocation,
      cover_image_url: coverImageUrl,
      status: "active",
    })
    .select("id, book_code")
    .single();

  if (bookErr) return { error: bookErr.message };
  if (!book) return { error: "ไม่สามารถสร้างหนังสือได้" };

  // 2. INSERT เล่มลูก N เล่ม
  const copies = Array.from({ length: initialCopies }, (_, i) => ({
    book_id: book.id,
    barcode: `${bookCode}-${(i + 1).toString().padStart(2, "0")}`,
    status: "available",
    condition: "new",
  }));

  const { error: copiesErr } = await supabase
    .from("book_copies")
    .insert(copies);

  if (copiesErr) {
    // rollback เล่มแม่
    await supabase.from("books").delete().eq("id", book.id);
    return { error: `สร้างเล่มลูกไม่สำเร็จ: ${copiesErr.message}` };
  }

  revalidatePath("/staff/books");
  return {
    error: null,
    bookId: book.id,
    bookCode: book.book_code,
    barcodes: copies.map((c) => c.barcode),
  };
}

// ---------- 5. searchBookByIsbnAction ----------
export async function searchBookByIsbnAction(query: string) {
  const supabase = await createClient();
  const q = query.trim();
  if (!q) return { data: null, error: "กรุณากรอก ISBN หรือรหัสหนังสือ" };

  const { data, error } = await supabase
    .from("books")
    .select(
      "id, book_code, title, author, isbn, cover_image_url, total_copies, available_copies, shelf_location",
    )
    .or(`isbn.eq.${q},book_code.eq.${q}`)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: "ไม่พบหนังสือที่ตรงกับ ISBN/รหัสนี้" };
  return { data, error: null };
}

// ---------- 6. addBookCopiesByIsbnAction ----------
export async function addBookCopiesByIsbnAction(formData: FormData) {
  const supabase = await createClient();
  const bookId = String(formData.get("book_id") ?? "");
  const count = parseInt(String(formData.get("count") ?? "1"), 10);
  const condition = String(formData.get("condition") ?? "new") as BookCopy["condition"];
  const priceStr = String(formData.get("price") ?? "");
  const price = priceStr ? parseFloat(priceStr) : null;

  if (!bookId) return { error: "ไม่พบ ID หนังสือ" };
  if (count < 1) return { error: "จำนวนเล่มต้องมากกว่า 0" };

  // ดึง book_code + หาลำดับล่าสุด
  const { data: book } = await supabase
    .from("books")
    .select("id, book_code")
    .eq("id", bookId)
    .single();
  if (!book) return { error: "ไม่พบหนังสือ" };

  const { data: existing } = await supabase
    .from("book_copies")
    .select("barcode")
    .eq("book_id", bookId)
    .order("barcode", { ascending: false })
    .limit(1);

  let startSeq = 0;
  if (existing && existing.length > 0) {
    const m = existing[0].barcode.match(/-(\d+)$/);
    if (m) startSeq = parseInt(m[1], 10);
  }

  const copies = Array.from({ length: count }, (_, i) => ({
    book_id: bookId,
    barcode: `${book.book_code}-${(startSeq + i + 1).toString().padStart(2, "0")}`,
    status: "available",
    condition,
    price,
  }));

  const { error: insertErr } = await supabase
    .from("book_copies")
    .insert(copies);

  if (insertErr) return { error: insertErr.message };

  revalidatePath("/staff/books");
  return { error: null, barcodes: copies.map((c) => c.barcode) };
}

// ---------- 7. getBookCopiesAction ----------
export async function getBookCopiesAction(bookId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("book_copies")
    .select("*")
    .eq("book_id", bookId)
    .order("barcode", { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: data as BookCopy[], error: null };
}

// ---------- 8. updateBookCopyStatusAction ----------
export async function updateBookCopyStatusAction(formData: FormData) {
  const supabase = await createClient();
  const copyId = String(formData.get("copy_id") ?? "");
  const status = String(formData.get("status") ?? "available") as BookCopy["status"];
  const condition = String(formData.get("condition") ?? "good") as BookCopy["condition"];
  const note = String(formData.get("note") ?? "").trim() || null;
  const priceStr = String(formData.get("price") ?? "").trim();
  const price = priceStr ? parseFloat(priceStr) : null;

  if (!copyId) return { error: "ไม่พบ ID เล่มลูก" };

  const updateData: Record<string, unknown> = {
    status,
    condition,
    note,
    updated_at: new Date().toISOString(),
  };
  // อัปเดตราคาเฉพาะเมื่อส่งมา
  if (priceStr !== "") {
    updateData.price = price;
  }

  const { error } = await supabase
    .from("book_copies")
    .update(updateData)
    .eq("id", copyId);

  if (error) return { error: error.message };
  revalidatePath("/staff/books");
  return { error: null };
}

// ---------- 8b. updateBookAction ----------
/** แก้ไขรายละเอียดหนังสือแม่ */
export async function updateBookAction(formData: FormData) {
  const supabase = await createClient();
  const bookId = String(formData.get("book_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const author = String(formData.get("author") ?? "").trim() || null;
  const isbn = String(formData.get("isbn") ?? "").trim() || null;
  const publisher = String(formData.get("publisher") ?? "").trim() || null;
  const shelfLocation = String(formData.get("shelf_location") ?? "").trim() || null;
  const coverImageUrl = String(formData.get("cover_image_url") ?? "").trim() || null;
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const status = String(formData.get("status") ?? "active");

  if (!bookId) return { error: "ไม่พบ ID หนังสือ" };
  if (!title) return { error: "กรุณากรอกชื่อหนังสือ" };

  const { error } = await supabase
    .from("books")
    .update({
      title,
      author,
      isbn,
      publisher,
      shelf_location: shelfLocation,
      cover_image_url: coverImageUrl,
      category_id: categoryId || null,
      status,
    })
    .eq("id", bookId);

  if (error) return { error: error.message };
  revalidatePath("/staff/books");
  return { error: null };
}

// ---------- 9. Category actions ----------
export async function getCategoriesAction() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("book_categories")
    .select("*")
    .order("name", { ascending: true });
  if (error) return { data: null, error: error.message };
  return { data: data as Category[], error: null };
}

export async function createCategoryAction(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const colorCode = String(formData.get("color_code") ?? "#60a5fa").trim();
  if (!name) return { error: "กรุณากรอกชื่อหมวดหมู่" };

  const { error } = await supabase
    .from("book_categories")
    .insert({ name, color_code: colorCode });
  if (error) return { error: error.message };
  revalidatePath("/staff/books");
  return { error: null };
}

export async function updateCategoryAction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const colorCode = String(formData.get("color_code") ?? "#60a5fa").trim();
  if (!id || !name) return { error: "ข้อมูลไม่ครบ" };

  const { error } = await supabase
    .from("book_categories")
    .update({ name, color_code: colorCode })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/staff/books");
  return { error: null };
}

export async function deleteCategoryAction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "ไม่พบ ID หมวดหมู่" };

  const { error } = await supabase
    .from("book_categories")
    .delete()
    .eq("id", id);
  if (error) return { error: `ไม่สามารถลบได้: ${error.message}` };
  revalidatePath("/staff/books");
  return { error: null };
}

// ---------- 10. getPrintBooksAction ----------
export async function getPrintBooksAction(bookId?: string) {
  const supabase = await createClient();

  // ดึงรายชื่อหนังสือแม่ทั้งหมด (สำหรับแสดงใน Dropdown เลือกลอง)
  const { data: booksData } = await supabase
    .from("books")
    .select("id, book_code, title, author, isbn, cover_image_url, book_categories(name)")
    .order("created_at", { ascending: false });

  const books = (booksData ?? []).map((b: any) => ({
    id: b.id,
    book_code: b.book_code,
    title: b.title,
    author: b.author ?? "ไม่ระบุผู้แต่ง",
    category: b.book_categories?.name ?? "ทั่วไป",
    isbn: b.isbn ?? "—",
    cover: b.cover_image_url || "https://placehold.co/300x450/5B2B92/FFFFFF?text=Book",
  }));

  // ถ้ามีการเลือก bookId ให้ดึงเล่มลูกเฉพาะเล่มนั้น
  let selectedBookId = bookId || (books[0]?.id ?? null);
  let copies: { id: string; barcode: string; label: string }[] = [];

  if (selectedBookId) {
    const { data: copiesData } = await supabase
      .from("book_copies")
      .select("id, barcode")
      .eq("book_id", selectedBookId)
      .order("barcode", { ascending: true });

    copies = (copiesData ?? []).map((c, idx) => ({
      id: c.id,
      barcode: c.barcode,
      label: `ฉบับที่ ${idx + 1}`,
    }));
  }

  return { books, selectedBookId, copies };
}