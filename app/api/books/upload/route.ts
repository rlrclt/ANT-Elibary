import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "ไม่พบไฟล์ที่อัปโหลด" }, { status: 400 });
    }

    // จำกัดขนาดไฟล์ที่ 5MB
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "ขนาดไฟล์ต้องไม่เกิน 5MB" }, { status: 400 });
    }

    // จำกัดชนิดไฟล์ (MIME types) เฉพาะรูปภาพ
    const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "อนุญาตเฉพาะไฟล์รูปภาพ (JPEG, PNG, WEBP, GIF) เท่านั้น" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. ตรวจสอบและสร้าง Bucket ถ้ายังไม่มี
    const { data: buckets, error: listError } = await admin.storage.listBuckets();
    if (listError) {
      console.error("[upload-api] listBuckets error:", listError.message);
      return NextResponse.json({ error: "ไม่สามารถเชื่อมต่อระบบเก็บไฟล์ได้: " + listError.message }, { status: 500 });
    }

    const bucketName = "book-covers";
    const bucketExists = buckets?.some((b) => b.id === bucketName);

    if (!bucketExists) {
      const { error: createError } = await admin.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE, // จำกัดที่ระดับ Supabase Storage 5MB
        allowedMimeTypes: ALLOWED_MIME_TYPES, // จำกัดชนิดไฟล์ที่ระดับ Supabase Storage
      });
      if (createError) {
        console.error("[upload-api] createBucket error:", createError.message);
        return NextResponse.json({ error: "สร้างที่เก็บไฟล์ไม่สำเร็จ: " + createError.message }, { status: 500 });
      }
    }

    // 2. อัปโหลดไฟล์
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `covers/${fileName}`;

    const { error: uploadError } = await admin.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: file.type,
        duplex: "half",
      });

    if (uploadError) {
      console.error("[upload-api] upload error:", uploadError.message);
      return NextResponse.json({ error: "อัปโหลดไฟล์ล้มเหลว: " + uploadError.message }, { status: 500 });
    }

    // 3. ดึง Public URL
    const { data: { publicUrl } } = admin.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return NextResponse.json({ ok: true, url: publicUrl });
  } catch (err: any) {
    console.error("[upload-api] catch error:", err);
    return NextResponse.json(
      { error: err?.message ?? "เกิดข้อผิดพลาดในการประมวลผล" },
      { status: 500 }
    );
  }
}
