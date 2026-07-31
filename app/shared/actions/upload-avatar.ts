"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server Action สำหรับอัปโหลดรูปโปรไฟล์
 *
 * ใช้ร่วมกันได้ทั้ง /staff/settings และ /member/profile
 * เก็บไฟล์ใน Supabase Storage bucket "users-profile"
 * path pattern: users/{user_id}/profile-{timestamp}.ext
 *
 * ข้อจำกัด:
 *   - ขนาดสูงสุด 3MB
 *   - MIME types: image/jpeg, image/png, image/webp, image/gif
 */

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// mapping MIME → extension
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type UploadAvatarResult = {
  error: string | null;
  url: string | null;
};

/**
 * uploadAvatarAction — อัปโหลดรูปโปรไฟล์ใหม่
 * รับ FormData ที่มี field "file" (File)
 * ลบรูปเก่าถ้ามี แล้วอัปเดต avatar_url ใน users table
 */
export async function uploadAvatarAction(
  formData: FormData,
): Promise<UploadAvatarResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "กรุณาเข้าสู่ระบบใหม่อีกครั้ง", url: null };

  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof File)) {
    return { error: "กรุณาเลือกไฟล์รูปภาพ", url: null };
  }

  // ตรวจสอบ MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      error: "รองรับเฉพาะไฟล์ภาพ JPEG, PNG, WebP หรือ GIF เท่านั้น",
      url: null,
    };
  }

  // ตรวจสอบขนาดไฟล์
  if (file.size > MAX_FILE_SIZE) {
    return {
      error: "ขนาดไฟล์ต้องไม่เกิน 3MB",
      url: null,
    };
  }

  if (file.size === 0) {
    return { error: "ไฟล์ว่าง กรุณาเลือกไฟล์ใหม่", url: null };
  }

  // ดึง avatar_url เก่าเพื่อลบภายหลัง
  const { data: oldProfile } = await supabase
    .from("users")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const oldAvatarUrl = oldProfile?.avatar_url as string | null;

  // สร้าง path: users/{user_id}/profile-{timestamp}.{ext}
  // ต้องขึ้นต้นด้วย "users/" เพื่อให้ตรงกับ RLS policy
  const ext = MIME_TO_EXT[file.type] ?? "jpg";
  const timestamp = Date.now();
  const filePath = `users/${user.id}/profile-${timestamp}.${ext}`;

  // อัปโหลดไปยัง storage
  const { error: uploadError } = await supabase.storage
    .from("users-profile")
    .upload(filePath, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    return { error: uploadError.message, url: null };
  }

  // ดึง public URL
  const { data: publicUrlData } = supabase.storage
    .from("users-profile")
    .getPublicUrl(filePath);

  const publicUrl = publicUrlData.publicUrl;

  // อัปเดต avatar_url ใน users table
  const { error: updateError } = await supabase
    .from("users")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  if (updateError) {
    // ถ้าอัปเดต DB ไม่สำเร็จ ลบไฟล์ที่เพิ่งอัปโหลด
    await supabase.storage.from("users-profile").remove([filePath]);
    return { error: updateError.message, url: null };
  }

  // ลบรูปเก่าจาก storage (ถ้ามี และอยู่ใน bucket ของเรา)
  if (oldAvatarUrl && oldAvatarUrl.includes("/users-profile/")) {
    try {
      // แยก path จาก URL: .../users-profile/users/{id}/profile-xxx.ext
      const url = new URL(oldAvatarUrl);
      const parts = url.pathname.split("/users-profile/");
      if (parts.length > 1) {
        const oldPath = parts[1];
        await supabase.storage.from("users-profile").remove([oldPath]);
      }
    } catch {
      // ไม่สำคัญ — รูปเก่าอาจเป็น URL ภายนอก
    }
  }

  // revalidate ทั้ง 2 path (staff + member)
  revalidatePath("/staff/settings");
  revalidatePath("/member/profile");

  return { error: null, url: publicUrl };
}

/**
 * deleteAvatarAction — ลบรูปโปรไฟล์ปัจจุบัน
 */
export async function deleteAvatarAction(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "กรุณาเข้าสู่ระบบใหม่อีกครั้ง" };

  // ดึง avatar_url ปัจจุบัน
  const { data: profile } = await supabase
    .from("users")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const avatarUrl = profile?.avatar_url as string | null;

  // ลบไฟล์จาก storage (ถ้าอยู่ใน bucket ของเรา)
  if (avatarUrl && avatarUrl.includes("/users-profile/")) {
    try {
      const url = new URL(avatarUrl);
      const parts = url.pathname.split("/users-profile/");
      if (parts.length > 1) {
        const filePath = parts[1];
        await supabase.storage.from("users-profile").remove([filePath]);
      }
    } catch {
      // ไม่สำคัญ
    }
  }

  // อัปเดต avatar_url = null ใน users table
  const { error } = await supabase
    .from("users")
    .update({ avatar_url: null })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/staff/settings");
  revalidatePath("/member/profile");

  return { error: null };
}