"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { isBookOld } from "@/utils/book-age";

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
  publication_year: number | null;
  // คำนวณแบบ virtual จาก publication_year (เก่า = อายุ ≥ 5 ปีนับจากปีตีพิมพ์)
  is_old_eligible: boolean;
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
      "id, book_code, title, author, isbn, category_id, total_copies, available_copies, publisher, shelf_location, cover_image_url, status, created_at, publication_year, book_categories(id, name, color_code)",
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
    publication_year: b.publication_year,
    is_old_eligible: isBookOld(b.publication_year),
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
  const publicationYearRaw = String(formData.get("publication_year") ?? "").trim();
  const publicationYear = publicationYearRaw
    ? parseInt(publicationYearRaw, 10)
    : null;

  if (!title) return { error: "กรุณากรอกชื่อหนังสือ" };
  if (!bookCode) return { error: "กรุณากรอกรหัสหนังสือ" };
  if (publicationYear === null || isNaN(publicationYear)) {
    return { error: "กรุณากรอกปีที่พิมพ์ (ค.ศ.)" };
  }
  if (publicationYear < 1900 || publicationYear > new Date().getFullYear()) {
    return { error: "ปีที่พิมพ์ไม่ถูกต้อง" };
  }
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
      publication_year: publicationYear,
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
    .neq("status", "removed")
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

// ---------- 8a. deleteBookCopyAction ----------
/**
 * ลบเล่มลูก (soft-delete) — ใช้ status='removed' ไม่ลบแถวจริง
 * เพื่อให้ประวัติยืม-คืน / ชำรุด / บันทึกการลบ ยังคงอยู่ครบ
 * - บล็อกถ้าเล่มกำลังถูกยืม (borrowed), สูญหาย (lost), หรือลบไปแล้ว (removed)
 * - บล็อกถ้ายังมีรายการชำรุดค้างชดใช้ (unresolved)
 * - บันทึก audit log ลง book_copy_logs (ใครลบ / เมื่อไหร่)
 */
export async function deleteBookCopyAction(formData: FormData) {
  const supabase = await createClient();

  // ตรวจสิทธิ์ staff/admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || (profile.role !== "staff" && profile.role !== "admin")) {
    return { error: "ไม่มีสิทธิ์ดำเนินการนี้" };
  }

  const copyId = String(formData.get("copy_id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!copyId) return { error: "ไม่พบ ID เล่มลูก" };

  // ดึงข้อมูลเล่มลูก
  const { data: copy, error: cErr } = await supabase
    .from("book_copies")
    .select("id, book_id, barcode, status")
    .eq("id", copyId)
    .maybeSingle();

  if (cErr) return { error: cErr.message };
  if (!copy) return { error: "ไม่พบเล่มลูก" };
  if (copy.status === "borrowed")
    return { error: "ไม่สามารถลบได้ เนื่องจากเล่มนี้กำลังถูกยืมอยู่" };
  if (copy.status === "lost")
    return { error: "ไม่สามารถลบได้ เนื่องจากเล่มนี้ถูกแจ้งสูญหายอยู่" };
  if (copy.status === "removed")
    return { error: "เล่มนี้ถูกลบไปแล้ว" };

  // เช็ครายการชำรุดค้างชดใช้
  const { count: unresolvedDamaged } = await supabase
    .from("damaged_records")
    .select("*", { count: "exact", head: true })
    .eq("book_copy_id", copyId)
    .eq("status", "unresolved");
  if ((unresolvedDamaged ?? 0) > 0)
    return { error: "ไม่สามารถลบได้ เนื่องจากเล่มนี้ยังมีรายการชำรุดค้างชดใช้อยู่" };

  const now = new Date().toISOString();

  // 1. soft-delete เล่มลูก
  const { error: updErr } = await supabase
    .from("book_copies")
    .update({ status: "removed", updated_at: now })
    .eq("id", copyId);

  if (updErr) return { error: updErr.message };

  // 2. บันทึก audit log
  const { error: logErr } = await supabase.from("book_copy_logs").insert({
    book_copy_id: copyId,
    book_id: copy.book_id,
    barcode: copy.barcode,
    action: "removed",
    note,
    handled_by: user.id,
  });

  if (logErr) return { error: logErr.message };

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
  const publicationYearRaw = String(formData.get("publication_year") ?? "").trim();
  const publicationYear = publicationYearRaw
    ? parseInt(publicationYearRaw, 10)
    : null;

  if (!bookId) return { error: "ไม่พบ ID หนังสือ" };
  if (!title) return { error: "กรุณากรอกชื่อหนังสือ" };
  if (publicationYear !== null && (isNaN(publicationYear) || publicationYear < 1900 || publicationYear > new Date().getFullYear())) {
    return { error: "ปีที่พิมพ์ไม่ถูกต้อง" };
  }

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
      publication_year: publicationYear,
      status,
    })
    .eq("id", bookId);

  if (error) return { error: error.message };
  revalidatePath("/staff/books");
  return { error: null };
}

// ---------- 8.5 markBookOldAction / reactivateBookAction ----------
/**
 * ย้ายหนังสือเป็น "หนังสือเก่า" (status='old')
 * - ต้องไม่มีเล่มลูกที่ถูกยืมอยู่ (ต้องรอคืนก่อน)
 * - เป็น action ที่แอดมินกดเอง (ไม่ใช่ย้ายอัตโนมัติ)
 */
export async function markBookOldAction(formData: FormData) {
  const supabase = await createClient();
  const bookId = String(formData.get("book_id") ?? "");
  if (!bookId) return { error: "ไม่พบ ID หนังสือ" };

  // เช็คเล่มลูกที่ยังถูกยืมอยู่
  const { count: borrowedCount, error: countErr } = await supabase
    .from("book_copies")
    .select("*", { count: "exact", head: true })
    .eq("book_id", bookId)
    .eq("status", "borrowed");
  if (countErr) return { error: countErr.message };
  if ((borrowedCount ?? 0) > 0) {
    return {
      error: `ยังมีเล่มที่ถูกยืมอยู่ ${borrowedCount} เล่ม ต้องรอให้คืนครบก่อนจึงจะย้ายเป็นหนังสือเก่าได้`,
    };
  }

  const { error } = await supabase
    .from("books")
    .update({ status: "old" })
    .eq("id", bookId);

  if (error) return { error: error.message };
  revalidatePath("/staff/books");
  revalidatePath("/staff/books/old");
  return { error: null };
}

/** นำหนังสือเก่ากลับมาใช้งาน (status='active') */
export async function reactivateBookAction(formData: FormData) {
  const supabase = await createClient();
  const bookId = String(formData.get("book_id") ?? "");
  if (!bookId) return { error: "ไม่พบ ID หนังสือ" };

  const { error } = await supabase
    .from("books")
    .update({ status: "active" })
    .eq("id", bookId);

  if (error) return { error: error.message };
  revalidatePath("/staff/books");
  revalidatePath("/staff/books/old");
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
      .neq("status", "removed")
      .order("barcode", { ascending: true });

    copies = (copiesData ?? []).map((c, idx) => ({
      id: c.id,
      barcode: c.barcode,
      label: `ฉบับที่ ${idx + 1}`,
    }));
  }

  return { books, selectedBookId, copies };
}

// ---------- 12. createDamagedRecordAction ----------
/**
 * แจ้งหนังสือชำรุด (พบเองจากคลัง/ชั้นวาง ไม่ได้ตรวจตอนคืน)
 * - ตั้งเล่มลูกเป็น status='damaged' (ปิดการยืม)
 * - สร้าง damaged_records ผูกสมาชิกผู้รับผิดชอบ (เลือกได้)
 * - สร้าง fine_payments (pending) ให้สมาชิกเห็นและชำระผ่านสลิป
 */
export async function createDamagedRecordAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const copyId = String(formData.get("copy_id") ?? "").trim();
  const userId = String(formData.get("user_id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!copyId) return { error: "ไม่พบ ID เล่มลูก" };
  if (!userId) return { error: "กรุณาเลือกสมาชิกผู้รับผิดชอบ" };

  // ตรวจสถานะเล่มลูก
  const { data: copy, error: cErr } = await supabase
    .from("book_copies")
    .select("id, book_id, price, status")
    .eq("id", copyId)
    .maybeSingle();

  if (cErr) return { error: cErr.message };
  if (!copy) return { error: "ไม่พบเล่มลูก" };
  if (copy.status === "borrowed")
    return { error: "เล่มนี้กำลังถูกยืมอยู่ — ต้องคืนก่อนจึงจะแจ้งชำรุดได้" };
  if (copy.status === "damaged")
    return { error: "เล่มนี้ถูกตั้งชำรุดแล้ว" };

  const fullPrice = Number(copy.price ?? 0);

  // 1. ตั้งเล่มลูกเป็น damaged
  const { error: updErr } = await supabase
    .from("book_copies")
    .update({ status: "damaged", updated_at: new Date().toISOString() })
    .eq("id", copyId);

  if (updErr) return { error: updErr.message };

  // 2. สร้าง damaged_records (ผูกผู้รับผิดชอบ)
  const { data: damagedRow, error: damagedErr } = await supabase
    .from("damaged_records")
    .insert({
      book_copy_id: copyId,
      user_id: userId,
      status: "unresolved",
      fine_amount: fullPrice,
      note: note || "แจ้งความชำรุด (พบเองจากคลัง)",
      handled_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    })
    .select("id")
    .single();

  if (damagedErr) return { error: damagedErr.message };

  // 3. สร้าง fine_payments (unpaid) ให้สมาชิกเลือกวิธีชำระใน /member/fines
  if (damagedRow?.id && fullPrice > 0) {
    const { error: payErr } = await supabase.from("fine_payments").insert({
      user_id: userId,
      damaged_record_id: damagedRow.id,
      fine_type: "damaged",
      amount: fullPrice,
      description: "ค่าชดใช้หนังสือชำรุด (เต็มราคาเล่ม)",
      payment_method: null,
      status: "unpaid",
    });
    if (payErr) return { error: payErr.message };
  }

  revalidatePath("/staff/books");
  return { error: null };
}

// ---------- 13. searchMemberAction ----------
/** ค้นหาสมาชิก (ชื่อ/รหัส) สำหรับเลือกผู้รับผิดชอบตอนแจ้งชำรุด */
export async function searchMemberAction(
  query: string,
): Promise<{
  data: { id: string; full_name: string; user_id_code: string; status: string }[];
  error: string | null;
}> {
  const supabase = await createClient();
  const q = query.trim();
  if (!q) return { data: [], error: null };

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, user_id_code, status")
    .or(`full_name.ilike.%${q}%,user_id_code.ilike.%${q}%`)
    .order("full_name", { ascending: true })
    .limit(10);

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

// ---------- 11. getCopyTimelineAction ----------
/**
 * Timeline ของเล่มลูกหนึ่งๆ — รวมเหตุการณ์ทั้งหมดให้กดดูได้
 *   - เหตุการณ์จาก borrow_records: ยืม / คืน / เกินกำหนด / สูญหาย
 *   - เหตุการณ์จาก damaged_records: ชำรุด / ชำระเงิน / รับเล่มคืน
 *   - ไฮไลต์เหตุการณ์ชำรุด/แทนที่ให้เห็นชัด
 */
export type CopyTimelineEvent = {
  id: string;
  type: "created" | "borrow" | "damaged" | "paid" | "replaced" | "removed";
  title: string;
  description: string | null;
  at: string;
};

export async function getCopyTimelineAction(
  copyId: string,
): Promise<{ data: CopyTimelineEvent[] | null; error: string | null }> {
  const supabase = await createClient();

  // 1. ข้อมูลเล่มลูก (สำหรับเหตุการณ์ created + ราคา)
  const { data: copy, error: cErr } = await supabase
    .from("book_copies")
    .select("created_at, price")
    .eq("id", copyId)
    .maybeSingle();

  if (cErr) return { data: null, error: cErr.message };

  // 2. ประวัติการยืม-คืน
  const { data: borrows } = await supabase
    .from("borrow_records")
    .select(
      `
      id, borrowed_at, due_date, returned_at, status, fine_amount, fine_reason,
      users!borrow_records_user_id_fkey ( full_name, user_id_code )
      `,
    )
    .eq("book_copy_id", copyId)
    .order("borrowed_at", { ascending: true });

  // 3. ประวัติการชำรุด
  const { data: damaged } = await supabase
    .from("damaged_records")
    .select(
      `
      id, user_id, replacement_user_id, status, resolution_method, fine_amount,
      note, created_at, updated_at
      `,
    )
    .eq("book_copy_id", copyId)
    .order("created_at", { ascending: true });

  // ดึงชื่อสมาชิกที่เกี่ยวข้อง (ผู้รับผิดชอบ + ผู้ที่นำเล่มมาคืน) แยก query
  // กัน PostgREST join ตาราง users ซ้ำสองครั้งทำให้ alias ชนกัน
  const damagedUserIds = new Set<string>();
  for (const dr of damaged ?? []) {
    if (dr.user_id) damagedUserIds.add(dr.user_id);
    if (dr.replacement_user_id) damagedUserIds.add(dr.replacement_user_id);
  }
  const damagedUserMap: Record<string, string> = {};
  if (damagedUserIds.size > 0) {
    const { data: dUsers } = await supabase
      .from("users")
      .select("id, full_name")
      .in("id", [...damagedUserIds]);
    for (const u of dUsers ?? []) damagedUserMap[u.id] = u.full_name;
  }

  // 4. บันทึกการลบเล่มลูก (ใครลบ / เมื่อไหร่)
  const { data: copyLogs } = await supabase
    .from("book_copy_logs")
    .select(
      `
      id, action, note, created_at,
      users!book_copy_logs_handled_by_fkey ( full_name )
      `,
    )
    .eq("book_copy_id", copyId)
    .order("created_at", { ascending: true });

  const events: CopyTimelineEvent[] = [];

  // เหตุการณ์สร้างเล่ม
  if (copy?.created_at) {
    events.push({
      id: `created-${copyId}`,
      type: "created",
      title: "สร้างเล่มลูก",
      description: copy.price != null ? `ราคาเล่ม ${copy.price} บาท` : null,
      at: copy.created_at,
    });
  }

  // เหตุการณ์ยืม-คืน
  for (const br of borrows ?? []) {
    const who = (br as any).users?.full_name ?? "สมาชิก";
    events.push({
      id: `borrow-${(br as any).id}`,
      type: "borrow",
      title: "ยืมหนังสือ",
      description: `${who} — กำหนดคืน ${new Date(
        (br as any).due_date,
      ).toLocaleDateString("th-TH")}`,
      at: (br as any).borrowed_at,
    });

    if ((br as any).returned_at) {
      const status = (br as any).status;
      const reason = (br as any).fine_reason;
      const fine = Number((br as any).fine_amount ?? 0);
      let desc = `${who} — คืนแล้ว`;
      if (status === "lost") desc = `${who} — แจ้งสูญหาย`;
      if (fine > 0 && reason === "overdue") desc += ` (ค่าปรับล่าช้า ${fine} บาท)`;
      if (fine > 0 && reason === "damaged") desc += ` (ตรวจพบชำรุด)`;
      events.push({
        id: `return-${(br as any).id}`,
        type: "borrow",
        title: status === "lost" ? "หนังสือสูญหาย" : "คืนหนังสือ",
        description: desc,
        at: (br as any).returned_at,
      });
    }
  }

  // เหตุการณ์ชำรุด / ชำระ / รับเล่มคืน
  for (const dr of damaged ?? []) {
    const who = dr.user_id ? (damagedUserMap[dr.user_id] ?? "สมาชิก") : "สมาชิก";
    const amount = Number(dr.fine_amount ?? 0);
    const status = dr.status;
    const method = dr.resolution_method;

    if (status === "unresolved") {
      events.push({
        id: `damaged-${dr.id}`,
        type: "damaged",
        title: "หนังสือชำรุด",
        description: `${who} — ค้างชดใช้เต็มราคา ${amount.toLocaleString("th-TH")} บาท${
          dr.note ? ` (${dr.note})` : ""
        }`,
        at: dr.created_at,
      });
    } else if (method === "payment") {
      events.push({
        id: `paid-${dr.id}`,
        type: "paid",
        title: "ชำระค่าชดใช้แล้ว",
        description: `${who} — จ่าย ${amount.toLocaleString("th-TH")} บาท`,
        at: dr.updated_at,
      });
    } else if (method === "replacement") {
      const replacer = dr.replacement_user_id
        ? (damagedUserMap[dr.replacement_user_id] ?? who)
        : who;
      events.push({
        id: `replaced-${dr.id}`,
        type: "replaced",
        title: "รับเล่มทดแทนแล้ว",
        description: `${replacer} นำเล่มใหม่มาคืน — เล่มกลับมาพร้อมยืม (บาร์โค้ดเดิม)`,
        at: dr.updated_at,
      });
    }
  }

  // เหตุการณ์ลบเล่มลูก (จาก audit log)
  for (const cl of copyLogs ?? []) {
    const who = (cl as any).users?.full_name ?? "เจ้าหน้าที่";
    events.push({
      id: `removed-${(cl as any).id}`,
      type: "removed",
      title: "ลบเล่มลูก",
      description: `${who} — ถอดเล่มนี้ออกจากระบบ${
        (cl as any).note ? ` (${(cl as any).note})` : ""
      }`,
      at: (cl as any).created_at,
    });
  }

  // เรียงตามเวลา (เก่า → ใหม่)
  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return { data: events, error: null };
}