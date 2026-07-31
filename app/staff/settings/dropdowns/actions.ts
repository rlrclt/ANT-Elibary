"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// ---------- Table Mapping ----------
const TABLE_MAP = {
  departments: {
    dbTable: "dropdown_departments",
    userCol: "department",
    userColId: "department_id",
    label: "แผนกวิชา",
  },
  class_levels: {
    dbTable: "dropdown_class_levels",
    userCol: "class_level",
    userColId: "class_level_id",
    label: "ระดับชั้น",
  },
  room_levels: {
    dbTable: "dropdown_room_levels",
    userCol: "room_level",
    userColId: "room_level_id",
    label: "ห้องเรียน",
  },
} as const;

type TableType = keyof typeof TABLE_MAP;

export type DropdownOption = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

// ---------- Helper: Verify Admin Role ----------
async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "กรุณาเข้าสู่ระบบใหม่อีกครั้ง", supabase: null };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin") {
    return {
      error: "คุณไม่มีสิทธิ์ในการดำเนินการนี้ (ต้องเป็นผู้ดูแลระบบ)",
      supabase: null,
    };
  }

  return { error: null, supabase };
}

// ---------- 1. getDropdownOptionsAction ----------
/**
 * ดึงข้อมูลตัวเลือกทั้งหมดจากทั้ง 3 ตาราง
 * ดึงทั้ง active และ inactive สำหรับจัดการ
 */
export async function getDropdownOptionsAction(): Promise<{
  departments: DropdownOption[];
  classLevels: DropdownOption[];
  roomLevels: DropdownOption[];
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      departments: [],
      classLevels: [],
      roomLevels: [],
      error: "กรุณาเข้าสู่ระบบ",
    };
  }

  try {
    const [deptRes, classRes, roomRes] = await Promise.all([
      supabase.from("dropdown_departments").select("id, name, is_active, sort_order, created_at").order("sort_order").order("name"),
      supabase.from("dropdown_class_levels").select("id, name, is_active, sort_order, created_at").order("sort_order").order("name"),
      supabase.from("dropdown_room_levels").select("id, name, is_active, sort_order, created_at").order("sort_order").order("name"),
    ]);

    if (deptRes.error) throw deptRes.error;
    if (classRes.error) throw classRes.error;
    if (roomRes.error) throw roomRes.error;

    return {
      departments: deptRes.data || [],
      classLevels: classRes.data || [],
      roomLevels: roomRes.data || [],
      error: null,
    };
  } catch (err: any) {
    console.error("Error fetching dropdown options:", err);
    return {
      departments: [],
      classLevels: [],
      roomLevels: [],
      error: err.message || "ไม่สามารถดึงข้อมูลตัวเลือกได้",
    };
  }
}

// ---------- 2. addDropdownOptionAction ----------
/**
 * เพิ่มตัวเลือกใหม่ลงในตารางที่ระบุ
 */
export async function addDropdownOptionAction(
  table: TableType,
  name: string,
  sortOrder: number = 0,
): Promise<{ success: boolean; error: string | null }> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { success: false, error: "กรุณาระบุชื่อตัวเลือก" };
  }

  const { error: adminError, supabase } = await verifyAdmin();
  if (adminError || !supabase) {
    return { success: false, error: adminError };
  }

  const config = TABLE_MAP[table];
  if (!config) {
    return { success: false, error: "ตารางไม่ถูกต้อง" };
  }

  const { error } = await supabase.from(config.dbTable).insert({
    name: trimmedName,
    sort_order: sortOrder,
    is_active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: `มีตัวเลือก "${trimmedName}" นี้อยู่แล้ว` };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/staff/settings/dropdowns");
  return { success: true, error: null };
}

// ---------- 3. updateDropdownOptionAction ----------
/**
 * แก้ไขตัวเลือกที่มีอยู่เดิม (ชื่อ ลำดับการจัดเรียง และสถานะใช้งาน)
 */
export async function updateDropdownOptionAction(
  table: TableType,
  id: string,
  name: string,
  sortOrder: number,
  isActive: boolean,
): Promise<{ success: boolean; error: string | null }> {
  const trimmedNewName = name.trim();

  if (!trimmedNewName) {
    return { success: false, error: "กรุณาระบุชื่อตัวเลือก" };
  }

  const { error: adminError, supabase } = await verifyAdmin();
  if (adminError || !supabase) {
    return { success: false, error: adminError };
  }

  const config = TABLE_MAP[table];
  if (!config) {
    return { success: false, error: "ตารางไม่ถูกต้อง" };
  }

  // ดึงข้อมูลจริงบนเซิร์ฟเวอร์โดยใช้ ID เพื่อเช็คความปลอดภัย
  const { data: existingData, error: fetchError } = await supabase
    .from(config.dbTable)
    .select("name, sort_order, is_active")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existingData) {
    return {
      success: false,
      error: fetchError?.message || "ไม่พบตัวเลือกที่ต้องการแก้ไข",
    };
  }

  // ทำการอัปเดต โดย database triggers จะคอย sync ข้อมูลผู้ใช้ใน users ให้อัตโนมัติในกรณีที่มีการแก้ไขชื่อ
  const { error: updateError } = await supabase
    .from(config.dbTable)
    .update({
      name: trimmedNewName,
      sort_order: sortOrder,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    if (updateError.code === "23505") {
      return { success: false, error: `มีตัวเลือก "${trimmedNewName}" นี้อยู่แล้ว` };
    }
    return { success: false, error: updateError.message };
  }

  revalidatePath("/staff/settings/dropdowns");
  return { success: true, error: null };
}

// ---------- 4. deleteDropdownOptionAction ----------
/**
 * ลบตัวเลือก (จะเช็คความปลอดภัยด้วย ID ผู้ใช้ foreign key ว่าถูกใช้งานอยู่หรือไม่)
 */
export async function deleteDropdownOptionAction(
  table: TableType,
  id: string,
): Promise<{ success: boolean; error: string | null }> {
  const { error: adminError, supabase } = await verifyAdmin();
  if (adminError || !supabase) {
    return { success: false, error: adminError };
  }

  const config = TABLE_MAP[table];
  if (!config) {
    return { success: false, error: "ตารางไม่ถูกต้อง" };
  }

  // ดึงชื่อเก่าจากฐานข้อมูล เพื่อเช็คว่ามีอยู่จริง
  const { data: existingData, error: fetchError } = await supabase
    .from(config.dbTable)
    .select("name")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existingData) {
    return {
      success: false,
      error: fetchError?.message || "ไม่พบตัวเลือกที่ต้องการลบ",
    };
  }

  // เช็คว่ามีผู้ใช้งานใช้ค่านี้อยู่ในตาราง users หรือไม่ผ่าน custom UUID keys (department_id, class_level_id, room_level_id)
  const { count, error: countError } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq(config.userColId, id);

  if (countError) {
    return { success: false, error: countError.message };
  }

  if (count && count > 0) {
    return {
      success: false,
      error: `ไม่สามารถลบได้ เนื่องจากตัวเลือกนี้กำลังถูกใช้งานโดยผู้ใช้จำนวน ${count} คน (แนะนำให้ใช้วิธีปิดสถานะการใช้งานแทน)`,
    };
  }

  // ทำการลบจริง
  const { error: deleteError } = await supabase
    .from(config.dbTable)
    .delete()
    .eq("id", id);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  revalidatePath("/staff/settings/dropdowns");
  return { success: true, error: null };
}
