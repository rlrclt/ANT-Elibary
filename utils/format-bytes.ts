/**
 * จัดรูปแบบขนาดเป็นหน่วยที่อ่านง่าย (bytes → "12.3 MB" / "0.5 GB")
 */
export function formatBytes(bytes: number | null | undefined): string {
  const b = Number(bytes ?? 0);
  if (b <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(b) / Math.log(1024)),
    units.length - 1,
  );
  const value = b / 1024 ** i;
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`;
}

/**
 * คำนวณเปอร์เซ็นต์ที่ใช้ไป (0–100) โดยไม่ให้เกิน 100
 */
export function usagePercent(usedBytes: number | null | undefined, limitBytes: number): number {
  const used = Number(usedBytes ?? 0);
  if (limitBytes <= 0) return 0;
  return Math.min(100, Math.round((used / limitBytes) * 100));
}
