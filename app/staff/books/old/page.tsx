import { getOldBooksAction } from "./actions";
import { OldBooksClient } from "./components/old-books-client";

export const metadata = {
  title: "หนังสือเก่า 5 ปี",
};

/**
 * หน้าหนังสือเก่า (/staff/books/old)
 * แสดงหนังสือทุกเล่มที่อายุครบ 5 ปี (นับจากปีที่พิมพ์ถึงปัจจุบัน)
 * - หนังสือที่ยัง active → แอดมินกด "ย้ายเป็นหนังสือเก่า" (ต้องไม่มีเล่มถูกยืมอยู่)
 * - หนังสือที่ย้ายแล้ว (status='old') → ซ่อนจากสมาชิก + ไม่ให้ยืม แต่ยังเห็นใน admin
 */
export default async function StaffOldBooksPage() {
  const result = await getOldBooksAction();

  return (
    <OldBooksClient
      initialBooks={result.data ?? []}
      error={result.error}
    />
  );
}
