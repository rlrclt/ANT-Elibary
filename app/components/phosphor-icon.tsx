/**
 * Wrapper รอบไอคอน Phosphor
 * ใช้ <i class="ph ph-{name}" /> ตามที่ @phosphor-icons/web กำหนด
 * เพื่อให้โหลดผ่าน Script ใน layout.tsx ได้ ไม่ต้อง import ทีละ icon
 */
type PhosphorIconProps = {
  name: string; // เช่น "magnifying-glass", "shopping-cart"
  weight?: "regular" | "bold" | "fill" | "light" | "thin" | "duotone";
  className?: string;
};

export function PhosphorIcon({
  name,
  weight = "regular",
  className = "",
}: PhosphorIconProps) {
  // weight="fill" → class "ph-fill", อื่นๆ → class "ph"
  const weightClass = weight === "fill" ? "ph-fill" : "ph";
  return (
    <i
      className={`${weightClass} ph-${name} ${className}`}
      aria-hidden="true"
    />
  );
}