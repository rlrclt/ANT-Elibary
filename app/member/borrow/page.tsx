import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";
import { PhosphorIcon } from "../../components/phosphor-icon";
import { BorrowClient } from "./components/borrow-client";

export const metadata = {
  title: "ยืมหนังสือ",
};

/**
 * หน้ายืมหนังสือ (/member/borrow?book={id})
 * - รับ book id จาก query param
 * - ดึงข้อมูลหนังสือ + เล่มลูกที่พร้อมยืม
 * - ส่งให้ BorrowClient แสดงหน้าจอยืม
 */export default async function BorrowPage({
  searchParams,
}: {
  searchParams: Promise<{ book?: string }>;
}) {
  const params = await searchParams;
  const bookId = params.book;

  if (!bookId) redirect("/member");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ดึงข้อมูลหนังสือ + หมวดหมู่
  const { data: book } = await supabase
    .from("books")
    .select(
      "id, book_code, title, author, cover_image_url, shelf_location, publisher, isbn, book_categories(name, color_code)",
    )
    .eq("id", bookId)
    .eq("status", "active")
    .maybeSingle();

  if (!book) notFound();

  // ดึงเล่มลูกที่พร้อมยืม (status='available')
  const { data: availableCopies } = await supabase
    .from("book_copies")
    .select("id, barcode, condition")
    .eq("book_id", bookId)
    .eq("status", "available")
    .order("barcode", { ascending: true });

  // ดึง profile สมาชิก (borrow_limit, status, จำนวนยืมปัจจุบัน)
  const { data: profile } = await supabase
    .from("users")
    .select("full_name, user_id_code, borrow_limit, status, fine_balance, role")
    .eq("id", user.id)
    .maybeSingle();

  // นับการยืมปัจจุบัน
  const { count: activeBorrows } = await supabase
    .from("borrow_records")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("returned_at", null);

  const canBorrow =
    profile?.status === "active" &&
    (activeBorrows ?? 0) < (profile?.borrow_limit ?? 5);

  return (
    <BorrowClient
      book={{
        id: book.id,
        book_code: book.book_code,
        title: book.title,
        author: book.author,
        cover_image_url: book.cover_image_url,
        shelf_location: book.shelf_location,
        publisher: book.publisher,
        isbn: book.isbn,
        category_name: Array.isArray(book.book_categories)
          ? book.book_categories[0]?.name ?? null
          : (book.book_categories as any)?.name ?? null,
        category_color: Array.isArray(book.book_categories)
          ? book.book_categories[0]?.color_code ?? null
          : (book.book_categories as any)?.color_code ?? null,
      }}
      availableCopies={(availableCopies ?? []).map((c) => ({
        id: c.id,
        barcode: c.barcode,
        condition: c.condition,
      }))}
      profile={{
        full_name: profile?.full_name ?? "สมาชิก",
        user_id_code: profile?.user_id_code ?? "",
        borrow_limit: profile?.borrow_limit ?? 5,
        active_borrows: activeBorrows ?? 0,
        status: profile?.status ?? "active",
        fine_balance: Number(profile?.fine_balance ?? 0),
      }}
      canBorrow={canBorrow}
      userId={user.id}
    />
  );
}