/**
 * เกณฑ์อายุหนังสือเก่า (5 ปี) — นับจากปีที่พิมพ์ถึงปีปัจจุบัน
 * ไม่ใช่วันที่นำเข้าสู่ระบบ
 */

export const OLD_AGE_YEARS = 5;

/** ตรวจว่าเป็นหนังสือเก่าหรือไม่ (publication_year != null และอายุ ≥ 5 ปี) */
export function isBookOld(publicationYear: number | null | undefined): boolean {
  if (publicationYear == null) return false;
  const currentYear = new Date().getFullYear();
  return currentYear - publicationYear >= OLD_AGE_YEARS;
}

/** ปีที่ตีพิมพ์ขั้นสูงสุดที่ถือว่า "เก่า" (เช่น 2021 → เก่าเมื่อถึงปี 2026) */
export function getOldCutoffYear(): number {
  return new Date().getFullYear() - OLD_AGE_YEARS;
}
