"use server";

import { createClient } from "@/utils/supabase/server";

export type BorrowHistoryRecord = {
  id: string;
  user_id: string;
  book_copy_id: string;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  status: "borrowing" | "returned" | "overdue" | "lost";
  fine_amount: number;
  fine_reason: "overdue" | "damaged" | "lost" | "other" | null;
  remark: string | null;
  extension_count: number;
  handled_by: string | null;
  user?: {
    full_name: string;
    user_id_code: string;
    department: string | null;
    class_level: string | null;
    gender: string | null;
  } | null;
  book_copy?: {
    barcode: string;
    status: string;
    book?: {
      title: string;
      book_code: string;
      cover_image_url: string | null;
    } | null;
  } | null;
};

export async function getHistoryDataAction(): Promise<{
  data: BorrowHistoryRecord[] | null;
  error: string | null;
}> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("borrow_records")
    .select(`
      id,
      user_id,
      book_copy_id,
      borrowed_at,
      due_date,
      returned_at,
      status,
      fine_amount,
      fine_reason,
      remark,
      extension_count,
      handled_by,
      user:users!borrow_records_user_id_fkey (
        full_name,
        user_id_code,
        department,
        class_level,
        gender
      ),
      book_copy:book_copies!borrow_records_book_copy_id_fkey (
        barcode,
        status,
        book:books!book_copies_book_id_fkey (
          title,
          book_code,
          cover_image_url
        )
      )
    `)
    .order("borrowed_at", { ascending: false });

  if (error) {
    return { data: null, error: error.message };
  }

  // Cast return to match Type definition
  return { data: data as any, error: null };
}
