import { getBookReportsAction } from "./actions";
import { ReportsClient } from "./components/reports-client";

export const metadata = {
  title: "รายงานหนังสือ",
};

/**
 * หน้ารายงานหนังสือ (/staff/books/reports)
 * - แท็บ 1: สรุปหนังสือ แยกเก่า/ใหม่ (นับจากปีที่พิมพ์ อายุ ≥ 5 ปี)
 * - แท็บ 2: การลงทะเบียนนำเข้าตาม วัน/เดือน/ปี แยกตามหมวดหมู่
 * - Export: PDF / CSV / Excel
 */
export default async function StaffBookReportsPage() {
  const result = await getBookReportsAction();

  return (
    <ReportsClient
      initialBooks={result.data ?? []}
      categories={result.categories}
      error={result.error}
    />
  );
}
