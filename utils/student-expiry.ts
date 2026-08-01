/**
 * student-expiry.ts — คำนวณวันพ้นสภาพการเป็นนักศึกษา (virtual)
 *
 * วันพ้นสภาพ = start_date + duration_years (ระยะเวลาหลักสูตรที่ admin กำหนดต่อกลุ่มเรียน)
 * ระบบแค่ "เตือน" ว่าใกล้/พ้นกำหนด ไม่ได้ระงับอัตโนมัติ (admin กดระงับเอง)
 */

export type ClassGroupExpiryInput = {
  start_date?: string | null;
  duration_years?: number | null;
};

export type ExpiryResult = {
  startDate: string | null;
  expiryDate: string | null;
  isExpired: boolean;
  /** จำนวนวันเหลือจนพ้นสภาพ (ติดลบ = พ้นแล้ว) */
  daysRemaining: number | null;
};

/** เปรียบเทียบเฉพาะวัน (ไม่สนใจเวลา) — ป้องกันผลลัพธ์เพี้ยนจาก timezone */
function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * คำนวณวันพ้นสภาพจากกลุ่มเรียน
 * ถ้าไม่มี start_date หรือ duration_years จะคืนค่า null (ไม่คำนวณ)
 */
export function computeExpiry(input: ClassGroupExpiryInput): ExpiryResult {
  const startDateStr = input.start_date?.trim() || null;
  const duration = input.duration_years ?? null;

  if (!startDateStr || !duration || duration <= 0) {
    return {
      startDate: startDateStr,
      expiryDate: null,
      isExpired: false,
      daysRemaining: null,
    };
  }

  const startDate = new Date(`${startDateStr}T00:00:00`);
  if (isNaN(startDate.getTime())) {
    return {
      startDate: startDateStr,
      expiryDate: null,
      isExpired: false,
      daysRemaining: null,
    };
  }

  const expiryDate = new Date(startDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + duration);

  const today = startOfDay(new Date());
  const daysRemaining = Math.floor(
    (startOfDay(expiryDate).getTime() - today.getTime()) / 86400000,
  );

  return {
    startDate: startDateStr,
    expiryDate: expiryDate.toISOString(),
    isExpired: daysRemaining < 0,
    daysRemaining,
  };
}

/** แปลงวันพ้นสภาพเป็นรูปแบบไทย dd/MM/yyyy (เวลาเดิม UTC) */
export function formatThaiDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
