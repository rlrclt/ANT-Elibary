"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server Actions สำหรับ /staff/books/damaged (ระบบหนังสือชำรุด)
 * - รายการหนังสือชำรุดค้างชดใช้ + ประวัติทั้งหมด
 * - ชดใช้แบบเงิน (จ่ายที่เคาน์เตอร์) / แบบซื้อหนังสือมาคืน (replacement)
 * - สถิติสรุป
 *
 * ตาราง:
 *   - public.damaged_records (รายการชำรุด)
 *   - public.book_copies (เล่มลูก — เปลี่ยนสถานะเป็น available เมื่อรับเล่มทดแทน)
 *   - public.fine_payments (การชำระ — กรณีจ่ายเงิน)
 */

// ---------- Types ----------
export type DamagedRecord = {
  id: string;
  book_copy_id: string;
  borrow_record_id: string | null;
  user_id: string;
  status: "unresolved" | "paid" | "replaced";
  resolution_method: "payment" | "replacement" | null;
  fine_amount: number;
  fine_payment_id: string | null;
  replacement_user_id: string | null;
  note: string | null;
  handled_by: string | null;
  created_at: string;
  updated_at: string;
  book_copy: {
    barcode: string;
    condition: string | null;
    price: number | null;
    book: {
      id: string;
      title: string;
      book_code: string;
      cover_image_url: string | null;
    } | null;
  } | null;
  user: {
    full_name: string;
    user_id_code: string;
  } | null;
  replacement_user: {
    full_name: string;
    user_id_code: string;
  } | null;
  fine_payment: {
    id: string;
    status: string;
    payment_method: string | null;
    slip_url: string | null;
  } | null;
};

export type DamagedStats = {
  unresolved: number;
  totalFine: number;
  paid: number;
  replaced: number;
};

type ActionResult<T> = { data: T | null; error: string | null };

// ---------- Auth helper ----------
async function requireStaff(): Promise<{
  ok: boolean;
  error: string | null;
  userId: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "กรุณาเข้าสู่ระบบ", userId: null };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "staff" && profile.role !== "admin")) {
    return { ok: false, error: "ไม่มีสิทธิ์เข้าถึง (ต้องเป็น staff/admin)", userId: null };
  }
  return { ok: true, error: null, userId: user.id };
}

// ---------- 1. getDamagedRecordsAction ----------
export async function getDamagedRecordsAction(filters?: {
  status?: "all" | "unresolved" | "paid" | "replaced";
}): Promise<ActionResult<DamagedRecord[]>> {
  const auth = await requireStaff();
  if (!auth.ok) return { data: null, error: auth.error };
  const supabase = await createClient();

  let query = supabase
    .from("damaged_records")
    .select(
      `
      id, book_copy_id, borrow_record_id, user_id, status,
      resolution_method, fine_amount, fine_payment_id, replacement_user_id,
      note, handled_by, created_at, updated_at,
      book_copies!damaged_records_book_copy_id_fkey (
        barcode, condition, price,
        books!book_copies_book_id_fkey ( id, title, book_code, cover_image_url )
      ),
      fine_payments!damaged_records_fine_payment_id_fkey ( id, status, payment_method, slip_url )
      `,
    )
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) return { data: null, error: error.message };

  // ดึงชื่อสมาชิก (ผู้รับผิดชอบ + ผู้ที่นำเล่มมาคืน) แยก query — กัน PostgREST join
  // ตาราง users ซ้ำสองครั้งทำให้ alias ชนกัน (damaged_records_users_1)
  const userIds = new Set<string>();
  for (const r of data ?? []) {
    if (r.user_id) userIds.add(r.user_id);
    if (r.replacement_user_id) userIds.add(r.replacement_user_id);
  }
  const userMap: Record<
    string,
    { full_name: string; user_id_code: string }
  > = {};
  if (userIds.size > 0) {
    const { data: userRows } = await supabase
      .from("users")
      .select("id, full_name, user_id_code")
      .in("id", [...userIds]);
    for (const u of userRows ?? []) {
      userMap[u.id] = {
        full_name: u.full_name,
        user_id_code: u.user_id_code,
      };
    }
  }

  const rows: DamagedRecord[] = (data ?? []).map((r: any) => ({
    id: r.id,
    book_copy_id: r.book_copy_id,
    borrow_record_id: r.borrow_record_id,
    user_id: r.user_id,
    status: r.status,
    resolution_method: r.resolution_method ?? null,
    fine_amount: Number(r.fine_amount ?? 0),
    fine_payment_id: r.fine_payment_id ?? null,
    replacement_user_id: r.replacement_user_id ?? null,
    note: r.note ?? null,
    handled_by: r.handled_by ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    book_copy: r.book_copies
      ? {
          barcode: r.book_copies.barcode,
          condition: r.book_copies.condition,
          price: r.book_copies.price != null ? Number(r.book_copies.price) : null,
          book: r.book_copies.books
            ? {
                id: r.book_copies.books.id,
                title: r.book_copies.books.title,
                book_code: r.book_copies.books.book_code,
                cover_image_url: r.book_copies.books.cover_image_url,
              }
            : null,
        }
      : null,
    user: r.user_id ? (userMap[r.user_id] ?? null) : null,
    replacement_user: r.replacement_user_id
      ? (userMap[r.replacement_user_id] ?? null)
      : null,
    fine_payment: r.fine_payments
      ? {
          id: r.fine_payments.id,
          status: r.fine_payments.status,
          payment_method: r.fine_payments.payment_method,
          slip_url: r.fine_payments.slip_url,
        }
      : null,
  }));

  return { data: rows, error: null };
}

// ---------- 2. getDamagedStatsAction ----------
export async function getDamagedStatsAction(): Promise<{
  data: DamagedStats;
  error: string | null;
}> {
  const auth = await requireStaff();
  if (!auth.ok) {
    return {
      data: { unresolved: 0, totalFine: 0, paid: 0, replaced: 0 },
      error: auth.error,
    };
  }
  const supabase = await createClient();

  const [
    { count: unresolved },
    { data: unresolvedFine },
    { count: paid },
    { count: replaced },
  ] = await Promise.all([
    supabase
      .from("damaged_records")
      .select("*", { count: "exact", head: true })
      .eq("status", "unresolved"),
    supabase
      .from("damaged_records")
      .select("fine_amount")
      .eq("status", "unresolved"),
    supabase
      .from("damaged_records")
      .select("*", { count: "exact", head: true })
      .eq("status", "paid"),
    supabase
      .from("damaged_records")
      .select("*", { count: "exact", head: true })
      .eq("status", "replaced"),
  ]);

  const totalFine =
    (unresolvedFine as any[])?.reduce(
      (sum, r) => sum + Number(r.fine_amount ?? 0),
      0,
    ) ?? 0;

  return {
    data: {
      unresolved: unresolved ?? 0,
      totalFine,
      paid: paid ?? 0,
      replaced: replaced ?? 0,
    },
    error: null,
  };
}

// ---------- 3. resolveDamagedByCounterAction ----------
/**
 * ชดใช้ด้วยการจ่ายเงินเต็มราคาที่เคาน์เตอร์
 * → สร้าง fine_payment (status=counter_paid) + resolve รายการชำรุด
 */
export async function resolveDamagedByCounterAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const auth = await requireStaff();
  if (!auth.ok) return { error: auth.error };
  const supabase = await createClient();

  const id = String(formData.get("record_id") ?? "").trim();
  if (!id) return { error: "ไม่พบ ID รายการชำรุด" };

  // ดึงรายการชำรุด (ตรวจสถานะ unresolved + user_id)
  const { data: record, error: rErr } = await supabase
    .from("damaged_records")
    .select("id, user_id, book_copy_id, fine_amount, status")
    .eq("id", id)
    .maybeSingle();

  if (rErr) return { error: rErr.message };
  if (!record) return { error: "ไม่พบรายการชำรุด" };
  if (record.status !== "unresolved")
    return { error: "รายการนี้จัดการแล้ว ไม่สามารถชำระซ้ำได้" };

  const now = new Date().toISOString();
  const amount = Number(record.fine_amount ?? 0);
  const finePaymentId = crypto.randomUUID();

  // 1. สร้าง fine_payment (counter_paid) — บันทึกยอดชดใช้
  const { error: payErr } = await supabase.from("fine_payments").insert({
    id: finePaymentId,
    user_id: record.user_id,
    borrow_record_id: null,
    damaged_record_id: id,
    fine_type: "damaged",
    amount,
    description: "ชดใช้หนังสือชำรุดเต็มราคา (ชำระที่เคาน์เตอร์)",
    payment_method: "counter",
    status: "counter_paid",
    reviewed_by: auth.userId,
    reviewed_at: now,
  });

  if (payErr) return { error: payErr.message };

  // 2. resolve รายการชำรุด
  const { error: updErr } = await supabase
    .from("damaged_records")
    .update({
      status: "paid",
      resolution_method: "payment",
      fine_payment_id: finePaymentId,
      handled_by: auth.userId,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "unresolved");

  if (updErr) return { error: updErr.message };

  revalidatePath("/staff/books/damaged");
  return { error: null };
}

// ---------- 4. resolveDamagedByReplacementAction ----------
/**
 * ชดใช้ด้วยการซื้อหนังสือเล่มเดียวกันมาคืน (replacement)
 * → เล่มลูกเดิมกลับเป็น available (barcode เดิม) + resolve รายการชำรุด
 * → บันทึกคนที่นำเล่มมาคืน (เลือกได้ ผ่าน replacement_user_id)
 */
export async function resolveDamagedByReplacementAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const auth = await requireStaff();
  if (!auth.ok) return { error: auth.error };
  const supabase = await createClient();

  const id = String(formData.get("record_id") ?? "").trim();
  const replacementUserId = String(formData.get("replacement_user_id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!id) return { error: "ไม่พบ ID รายการชำรุด" };
  if (!replacementUserId)
    return { error: "กรุณาเลือกสมาชิกที่นำหนังสือมาคืน" };

  // ดึงรายการชำรุด (ตรวจสถานะ unresolved + book_copy_id)
  const { data: record, error: rErr } = await supabase
    .from("damaged_records")
    .select("id, book_copy_id, status")
    .eq("id", id)
    .maybeSingle();

  if (rErr) return { error: rErr.message };
  if (!record) return { error: "ไม่พบรายการชำรุด" };
  if (record.status !== "unresolved")
    return { error: "รายการนี้จัดการแล้ว" };

  const now = new Date().toISOString();

  // 1. เล่มลูกกลับเป็น available (ใช้ barcode เดิม)
  const { error: copyErr } = await supabase
    .from("book_copies")
    .update({ status: "available", updated_at: now })
    .eq("id", record.book_copy_id);

  if (copyErr) return { error: copyErr.message };

  // 2. resolve รายการชำรุด
  const { error: updErr } = await supabase
    .from("damaged_records")
    .update({
      status: "replaced",
      resolution_method: "replacement",
      replacement_user_id: replacementUserId,
      note: note ?? undefined,
      handled_by: auth.userId,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "unresolved");

  if (updErr) return { error: updErr.message };

  revalidatePath("/staff/books/damaged");
  revalidatePath("/staff/books");
  return { error: null };
}

// ---------- 5. searchMemberAction ----------
/** ค้นหาสมาชิก (ชื่อ/รหัส) เพื่อเลือกคนที่นำหนังสือมาคืน */
export async function searchMemberAction(
  query: string,
): Promise<{
  data: { id: string; full_name: string; user_id_code: string; status: string }[];
  error: string | null;
}> {
  const auth = await requireStaff();
  if (!auth.ok) return { data: [], error: auth.error };
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

// ---------- 6. getDamagedMembersAction ----------
/**
 * รายชื่อสมาชิกที่กำลังถูกบล็อกการยืม (มีรายการชำรุดค้างชดใช้)
 * ใช้แสดงเป็นรายการบนหน้า admin
 */
export async function getDamagedMembersAction(): Promise<
  ActionResult<
    {
      user_id: string;
      full_name: string;
      user_id_code: string;
      unresolved_count: number;
      total_fine: number;
    }[]
  >
> {
  const auth = await requireStaff();
  if (!auth.ok) return { data: null, error: auth.error };
  const supabase = await createClient();

  // ดึงแถว unresolved พร้อม user เพื่อรวมยอด
  const { data, error } = await supabase
    .from("damaged_records")
    .select(
      `
      user_id, fine_amount,
      users!damaged_records_user_id_fkey ( full_name, user_id_code )
      `,
    )
    .eq("status", "unresolved")
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };

  const map = new Map<
    string,
    {
      user_id: string;
      full_name: string;
      user_id_code: string;
      unresolved_count: number;
      total_fine: number;
    }
  >();

  for (const r of data ?? []) {
    const uid = (r as any).user_id;
    if (!uid) continue;
    const existing = map.get(uid) ?? {
      user_id: uid,
      full_name: (r as any).users?.full_name ?? "ไม่ระบุชื่อ",
      user_id_code: (r as any).users?.user_id_code ?? "-",
      unresolved_count: 0,
      total_fine: 0,
    };
    existing.unresolved_count += 1;
    existing.total_fine += Number((r as any).fine_amount ?? 0);
    map.set(uid, existing);
  }

  return { data: [...map.values()], error: null };
}
