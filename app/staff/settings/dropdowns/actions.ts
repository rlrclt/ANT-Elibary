"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// ---------- Table Mapping ----------
const TABLE_MAP = {
  departments: {
    dbTable: "dropdown_departments",
    userCol: "department",
    label: "แผนกวิชา",
  },
  class_levels: {
    dbTable: "dropdown_class_levels",
    userCol: "class_level",
    label: "ระดับชั้น",
  },
  room_levels: {
    dbTable: "dropdown_room_levels",
    userCol: "room_level",
    label: "ห้องเรียน",
  },
} as const;

type TableType = keyof typeof TABLE_MAP;

export type DropdownOption = {
  id: string;
  name: string;
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
 * เนื่องจากเป็นหน้าการตั้งค่า จึงดึงข้อมูลแยกสำหรับแต่ละแท็บ
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
      supabase.from("dropdown_departments").select("id, name, created_at").order("name"),
      supabase.from("dropdown_class_levels").select("id, name, created_at").order("name"),
      supabase.from("dropdown_room_levels").select("id, name, created_at").order("name"),
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
  });

  if (error) {
    // 23505 = Unique violation ใน PostgreSQL
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
 * แก้ไขตัวเลือกที่มีอยู่เดิม และอัปเดตข้อมูลผู้ใช้งานที่เชื่อมโยงอยู่เพื่อความถูกต้องของข้อมูล
 */
export async function updateDropdownOptionAction(
  table: TableType,
  id: string,
  newName: string,
): Promise<{ success: boolean; error: string | null }> {
  const trimmedNewName = newName.trim();

  if (!trimmedNewName) {
    return { success: false, error: "กรุณาระบุชื่อตัวเลือกใหม่" };
  }

  const { error: adminError, supabase } = await verifyAdmin();
  if (adminError || !supabase) {
    return { success: false, error: adminError };
  }

  const config = TABLE_MAP[table];
  if (!config) {
    return { success: false, error: "ตารางไม่ถูกต้อง" };
  }

  // ดึงชื่อเก่าจากฐานข้อมูล เพื่อยืนยันความถูกต้องก่อนอัปเดตและป้องกัน bypass
  const { data: existingData, error: fetchError } = await supabase
    .from(config.dbTable)
    .select("name")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existingData) {
    return {
      success: false,
      error: fetchError?.message || "ไม่พบตัวเลือกที่ต้องการแก้ไข",
    };
  }

  const oldName = existingData.name.trim();

  if (trimmedNewName === oldName) {
    return { success: true, error: null };
  }

  // 1. อัปเดตชื่อในตารางตัวเลือก
  const { error: updateError } = await supabase
    .from(config.dbTable)
    .update({ name: trimmedNewName })
    .eq("id", id);

  if (updateError) {
    if (updateError.code === "23505") {
      return { success: false, error: `มีตัวเลือก "${trimmedNewName}" นี้อยู่แล้ว` };
    }
    return { success: false, error: updateError.message };
  }

  // 2. อัปเดตข้อมูลของผู้ใช้ทั้งหมดที่เคยอ้างอิงชื่อเก่า (เพื่อรักษาสถานะข้อมูลให้ตรงกัน)
  const { error: userUpdateError } = await supabase
    .from("users")
    .update({ [config.userCol]: trimmedNewName })
    .eq(config.userCol, oldName);

  if (userUpdateError) {
    console.error(`Failed to cascade rename to users table:`, userUpdateError);
    return {
      success: false,
      error: `ไม่สามารถปรับปรุงข้อมูลผู้ใช้ที่เกี่ยวข้องได้: ${userUpdateError.message}`,
    };
  }

  revalidatePath("/staff/settings/dropdowns");
  return { success: true, error: null };
}

// ---------- 4. deleteDropdownOptionAction ----------
/**
 * ลบตัวเลือก (จะเช็คความปลอดภัยก่อนว่ามีผู้ใช้งานตัวเลือกนี้อยู่หรือไม่)
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

  // ดึงชื่อเก่าจากฐานข้อมูล เพื่อเช็คว่ามีการใช้งานจริงหรือไม่ (หลีกเลี่ยงการเชื่อข้อมูลจาก Client)
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

  const name = existingData.name.trim();

  // เช็คว่ามีผู้ใช้งานใช้ค่านี้อยู่ในตาราง users หรือไม่
  const { count, error: countError } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq(config.userCol, name);

  if (countError) {
    return { success: false, error: countError.message };
  }

  if (count && count > 0) {
    return {
      success: false,
      error: `ไม่สามารถลบได้ เนื่องจากตัวเลือกนี้กำลังถูกใช้งานโดยผู้ใช้จำนวน ${count} คน`,
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
