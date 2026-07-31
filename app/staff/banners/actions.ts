"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server Actions สำหรับ /staff/banners (จัดการ Banner Carousel)
 *
 * CRUD: create / read / update / delete
 * + upload / delete image
 *
 * ตาราง: public.banners
 * Storage bucket: banners
 */

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type Banner = {
  id: string;
  title: string;
  badge: string | null;
  headline: string;
  subtitle: string | null;
  image_url: string | null;
  action_url: string | null;
  action_label: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// ---------- 1. getBannersAction ----------
export async function getBannersAction(): Promise<{
  data: Banner[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data as Banner[]) ?? [], error: null };
}

// ---------- 2. getActiveBannersAction ----------
export async function getActiveBannersAction(): Promise<{
  data: Banner[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data as Banner[]) ?? [], error: null };
}

// ---------- 3. createBannerAction ----------
export async function createBannerAction(
  formData: FormData,
): Promise<{ error: string | null; id: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ", id: null };

  const title = String(formData.get("title") ?? "").trim();
  const headline = String(formData.get("headline") ?? "").trim();
  if (!title || !headline) {
    return { error: "กรุณากรอกชื่อและหัวข้อ", id: null };
  }

  // ดึง sort_order สูงสุด + 1
  const { data: maxRow } = await supabase
    .from("banners")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (maxRow?.sort_order ?? -1) + 1;

  // อัปโหลดรูป (ถ้ามี) หรือใช้ URL ที่กรอก
  let imageUrl: string | null = null;
  const file = formData.get("image") as File | null;
  const imageLink = String(formData.get("image_link") ?? "").trim();

  if (file && file.size > 0) {
    const uploadRes = await uploadBannerImage(file, supabase);
    if (uploadRes.error) return { error: uploadRes.error, id: null };
    imageUrl = uploadRes.url;
  } else if (imageLink) {
    imageUrl = imageLink;
  }

  const { data, error } = await supabase
    .from("banners")
    .insert({
      title,
      badge: String(formData.get("badge") ?? "").trim() || null,
      headline,
      subtitle: String(formData.get("subtitle") ?? "").trim() || null,
      image_url: imageUrl,
      action_url: String(formData.get("action_url") ?? "").trim() || null,
      action_label:
        String(formData.get("action_label") ?? "").trim() || null,
      is_active: formData.get("is_active") === "true",
      sort_order: nextSort,
    })
    .select("id")
    .single();

  if (error) return { error: error.message, id: null };

  revalidatePath("/member");
  revalidatePath("/staff/banners");
  return { error: null, id: data.id };
}

// ---------- 4. updateBannerAction ----------
export async function updateBannerAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "ไม่พบ ID" };

  const title = String(formData.get("title") ?? "").trim();
  const headline = String(formData.get("headline") ?? "").trim();
  if (!title || !headline) {
    return { error: "กรุณากรอกชื่อและหัวข้อ" };
  }

  // อัปโหลดรูปใหม่ (ถ้ามี) หรือใช้ URL ที่กรอก
  let imageUrl: string | null | undefined;
  const file = formData.get("image") as File | null;
  const imageLink = String(formData.get("image_link") ?? "").trim();

  if (file && file.size > 0) {
    const uploadRes = await uploadBannerImage(file, supabase);
    if (uploadRes.error) return { error: uploadRes.error };
    imageUrl = uploadRes.url;

    // ลบรูปเก่า (ถ้ามีและอยู่ใน bucket เรา)
    const { data: old } = await supabase
      .from("banners")
      .select("image_url")
      .eq("id", id)
      .maybeSingle();
    if (old?.image_url) {
      await removeBannerImage(old.image_url, supabase);
    }
  } else if (imageLink) {
    imageUrl = imageLink;
    // ลบรูปเก่าจาก storage (ถ้าอยู่ใน bucket เรา)
    const { data: old } = await supabase
      .from("banners")
      .select("image_url")
      .eq("id", id)
      .maybeSingle();
    if (old?.image_url) {
      await removeBannerImage(old.image_url, supabase);
    }
  }

  const updateData: Record<string, any> = {
    title,
    badge: String(formData.get("badge") ?? "").trim() || null,
    headline,
    subtitle: String(formData.get("subtitle") ?? "").trim() || null,
    action_url: String(formData.get("action_url") ?? "").trim() || null,
    action_label:
      String(formData.get("action_label") ?? "").trim() || null,
    is_active: formData.get("is_active") === "true",
  };
  if (imageUrl !== undefined) updateData.image_url = imageUrl ?? null;

  const { error } = await supabase
    .from("banners")
    .update(updateData)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/member");
  revalidatePath("/staff/banners");
  return { error: null };
}

// ---------- 5. deleteBannerAction ----------
export async function deleteBannerAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "ไม่พบ ID" };

  // ดึง image_url เพื่อลบรูป
  const { data: banner } = await supabase
    .from("banners")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();

  if (banner?.image_url) {
    await removeBannerImage(banner.image_url, supabase);
  }

  const { error } = await supabase.from("banners").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/member");
  revalidatePath("/staff/banners");
  return { error: null };
}

// ---------- 6. toggleBannerActiveAction ----------
export async function toggleBannerActiveAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  const isActive = formData.get("is_active") === "true";

  const { error } = await supabase
    .from("banners")
    .update({ is_active: !isActive })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/member");
  revalidatePath("/staff/banners");
  return { error: null };
}

// ---------- 7. reorderBannerAction ----------
export async function reorderBannerAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();

  if (!id || !direction) return { error: "ข้อมูลไม่ครบ" };

  // ดึง banner ปัจจุบัน
  const { data: current } = await supabase
    .from("banners")
    .select("id, sort_order")
    .eq("id", id)
    .maybeSingle();

  if (!current) return { error: "ไม่พบ banner" };

  // ดึง banner ที่อยู่ติดกัน
  const operator = direction === "up" ? "lt" : "gt";
  const order = direction === "up" ? { ascending: false } : { ascending: true };

  const { data: target } = await supabase
    .from("banners")
    .select("id, sort_order")
    [operator]("sort_order", current.sort_order)
    .order("sort_order", order)
    .limit(1)
    .maybeSingle();

  if (!target) return { error: null }; // ไม่มีที่จะสลับ

  // สลับ sort_order
  await supabase
    .from("banners")
    .update({ sort_order: target.sort_order })
    .eq("id", current.id);

  await supabase
    .from("banners")
    .update({ sort_order: current.sort_order })
    .eq("id", target.id);

  revalidatePath("/member");
  revalidatePath("/staff/banners");
  return { error: null };
}

// ---------- helpers ----------
async function uploadBannerImage(
  file: File,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ error: string | null; url: string | null }> {
  if (!ALLOWED_MIME.includes(file.type)) {
    return { error: "รองรับเฉพาะ JPEG, PNG, WebP, GIF", url: null };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { error: "ขนาดไฟล์ต้องไม่เกิน 3MB", url: null };
  }

  const ext = MIME_TO_EXT[file.type] ?? "jpg";
  const timestamp = Date.now();
  const filePath = `banner-${timestamp}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("banners")
    .upload(filePath, file, {
      contentType: file.type,
      cacheControl: "3600",
    });

  if (uploadError) {
    return { error: uploadError.message, url: null };
  }

  const { data: publicUrlData } = supabase.storage
    .from("banners")
    .getPublicUrl(filePath);

  return { error: null, url: publicUrlData.publicUrl };
}

async function removeBannerImage(
  imageUrl: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<void> {
  try {
    if (!imageUrl.includes("/banners/")) return;
    const url = new URL(imageUrl);
    const parts = url.pathname.split("/banners/");
    if (parts.length > 1) {
      const filePath = parts[1];
      await supabase.storage.from("banners").remove([filePath]);
    }
  } catch {
    // ไม่สำคัญ
  }
}