/**
 * ขีดจำกัด (โควตา) ของแผน Supabase — ใช้คำนวณ "ใช้ไป / เหลือ"
 * ไม่มี API ให้ดึงโควตาจริง จึงต้องตั้งค่าคงที่ตามแผนที่ใช้งาน
 * แผนปัจจุบัน: Free (ฐานข้อมูล 500MB, Storage 1GB)
 */
export const PLAN_LIMITS = {
  planName: "Free",
  databaseBytes: 500 * 1024 * 1024, // 500 MB
  storageBytes: 1024 * 1024 * 1024, // 1 GB
} as const;
