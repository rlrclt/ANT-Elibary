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
  class_groups: {
    dbTable: "dropdown_class_groups",
    userCol: "class_group",
    userColId: "class_group_id",
    label: "กลุ่มเรียน",
  },
  access_purposes: {
    dbTable: "dropdown_access_purposes",
    userCol: "purpose",
    userColId: "purpose",
    label: "วัตถุประสงค์การเข้าใช้",
  },
} as const;

type TableType = keyof typeof TABLE_MAP;

export type DropdownOption = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  visible_to: string[];
  department_id?: string;
  class_level_id?: string;
  academic_year?: string;
  start_date?: string | null;
  duration_years?: number;
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
 * ดึงข้อมูลตัวเลือกทั้งหมดจากทั้ง 5 ตาราง
 * ดึงทั้ง active และ inactive สำหรับจัดการ
 */
export async function getDropdownOptionsAction(): Promise<{
  departments: DropdownOption[];
  classLevels: DropdownOption[];
  roomLevels: DropdownOption[];
  classGroups: DropdownOption[];
  accessPurposes: DropdownOption[];
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
      classGroups: [],
      accessPurposes: [],
      error: "กรุณาเข้าสู่ระบบ",
    };
  }

  try {
    const [deptRes, classRes, roomRes, groupRes, purposeRes] = await Promise.all([
      supabase.from("dropdown_departments").select("*").order("sort_order").order("name"),
      supabase.from("dropdown_class_levels").select("*").order("sort_order").order("name"),
      supabase.from("dropdown_room_levels").select("*").order("sort_order").order("name"),
      supabase.from("dropdown_class_groups").select("*").order("sort_order").order("code"),
      supabase.from("dropdown_access_purposes").select("*").order("sort_order").order("name"),
    ]);

    if (deptRes.error) throw deptRes.error;
    if (classRes.error) throw classRes.error;
    if (roomRes.error) throw roomRes.error;
    if (groupRes.error) throw groupRes.error;
    if (purposeRes.error) throw purposeRes.error;

    return {
      departments: deptRes.data || [],
      classLevels: classRes.data || [],
      roomLevels: roomRes.data || [],
      classGroups: (groupRes.data || []).map((g: any) => ({
        ...g,
        name: g.code,
      })),
      accessPurposes: purposeRes.data || [],
      error: null,
    };
  } catch (err: any) {
    console.error("Error fetching dropdown options:", err);
    return {
      departments: [],
      classLevels: [],
      roomLevels: [],
      classGroups: [],
      accessPurposes: [],
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
  visibleRoles: string[] = [],
  departmentId?: string,
  classLevelId?: string,
  academicYear?: string,
  startDate?: string | null,
  durationYears?: number
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

  const insertData: any = {
    sort_order: sortOrder,
    is_active: true,
    visible_to: visibleRoles,
  };

  if (table === "class_groups") {
    if (!departmentId || !classLevelId) {
      return { success: false, error: "กรุณาเลือกแผนกวิชาและระดับชั้น" };
    }
    if (!academicYear || !academicYear.trim()) {
      return { success: false, error: "กรุณาระบุปีการศึกษา" };
    }
    insertData.code = trimmedName;
    insertData.department_id = departmentId;
    insertData.class_level_id = classLevelId;
    insertData.academic_year = academicYear.trim();
    insertData.start_date = startDate || null;
    insertData.duration_years = durationYears || 3;
  } else {
    insertData.name = trimmedName;
  }

  const { error } = await supabase.from(config.dbTable).insert(insertData);

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: table === "class_groups"
          ? `รหัสกลุ่มเรียน "${trimmedName}" นี้ถูกใช้งานในระบบแล้ว (รหัสกลุ่มเรียนห้ามซ้ำกัน)`
          : `มีตัวเลือก "${trimmedName}" นี้อยู่แล้ว`
      };
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
  visibleRoles: string[] = [],
  departmentId?: string,
  classLevelId?: string,
  academicYear?: string,
  startDate?: string | null,
  durationYears?: number
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
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existingData) {
    return {
      success: false,
      error: fetchError?.message || "ไม่พบตัวเลือกที่ต้องการแก้ไข",
    };
  }

  const updateData: any = {
    sort_order: sortOrder,
    is_active: isActive,
    visible_to: visibleRoles,
    updated_at: new Date().toISOString(),
  };

  if (table === "class_groups") {
    if (!departmentId || !classLevelId) {
      return { success: false, error: "กรุณาเลือกแผนกวิชาและระดับชั้น" };
    }
    if (!academicYear || !academicYear.trim()) {
      return { success: false, error: "กรุณาระบุปีการศึกษา" };
    }
    updateData.code = trimmedNewName;
    updateData.department_id = departmentId;
    updateData.class_level_id = classLevelId;
    updateData.academic_year = academicYear.trim();
    updateData.start_date = startDate || null;
    updateData.duration_years = durationYears || 3;
  } else {
    updateData.name = trimmedNewName;
  }

  const { error: updateError } = await supabase
    .from(config.dbTable)
    .update(updateData)
    .eq("id", id);

  if (updateError) {
    if (updateError.code === "23505") {
      return {
        success: false,
        error: table === "class_groups"
          ? `รหัสกลุ่มเรียน "${trimmedNewName}" นี้ถูกใช้งานในระบบแล้ว (รหัสกลุ่มเรียนห้ามซ้ำกัน)`
          : `มีตัวเลือก "${trimmedNewName}" นี้อยู่แล้ว`
      };
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
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existingData) {
    return {
      success: false,
      error: fetchError?.message || "ไม่พบตัวเลือกที่ต้องการลบ",
    };
  }

  // เช็คว่ามีผู้ใช้งานใช้ค่านี้อยู่ในระบบหรือไม่
  // - ตารางอื่น: ผ่าน FK ใน users (department_id, class_level_id, room_level_id)
  // - access_purposes: ผ่าน room_access_logs.purpose (เก็บชื่อไว้เป็น TEXT)
  let usageCount = 0;

  if (table === "access_purposes") {
    const { count, error: countError } = await supabase
      .from("room_access_logs")
      .select("*", { count: "exact", head: true })
      .eq("purpose", existingData.name);
    if (countError) {
      return { success: false, error: countError.message };
    }
    usageCount = count ?? 0;
  } else {
    const { count, error: countError } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq(config.userColId, id);
    if (countError) {
      return { success: false, error: countError.message };
    }
    usageCount = count ?? 0;
  }

  if (usageCount > 0) {
    return {
      success: false,
      error: `ไม่สามารถลบได้ เนื่องจากตัวเลือกนี้กำลังถูกใช้งานแล้วจำนวน ${usageCount} รายการ (แนะนำให้ใช้วิธีปิดสถานะการใช้งานแทน)`,
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

// ---------- 5. reorderDropdownOptionsAction ----------
/**
 * Reorder dropdown options based on an array of IDs.
 * Updates sort_order sequentially (1..n) for the given tab.
 */
export async function reorderDropdownOptionsAction(
  table: TableType,
  orderedIds: string[]
): Promise<{ success: boolean; error: string | null }> {
  const { error: adminError, supabase } = await verifyAdmin();
  if (adminError || !supabase) {
    return { success: false, error: adminError };
  }

  const config = TABLE_MAP[table];
  if (!config) {
    return { success: false, error: "ตารางไม่ถูกต้อง" };
  }

  try {
    // Update sort_order for each option sequentially
    for (let i = 0; i < orderedIds.length; i++) {
      const { error: updateErr } = await supabase
        .from(config.dbTable)
        .update({ sort_order: i + 1, updated_at: new Date().toISOString() })
        .eq("id", orderedIds[i]);

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }
    }

    revalidatePath("/staff/settings/dropdowns");
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "ไม่สามารถอัพเดทลำดับได้" };
  }
}

