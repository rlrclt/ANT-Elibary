import { createClient } from "@/utils/supabase/server";
import { getOldCutoffYear } from "@/utils/book-age";
import { PhosphorIcon } from "../components/phosphor-icon";
import { PrintButton } from "../components/print-button";

export const metadata = {
  title: "แดชบอร์ดเจ้าหน้าที่",
};

/**
 * หน้าแดชบอร์ดเจ้าหน้าที่ (/staff)
 * - layout.tsx จัด Header/Sidebar/Footer + auth guard ให้แล้ว
 * - หน้านี้โชว์สถิติจริงจาก Supabase (นับ books, users, loans)
 */
export default async function StaffDashboardPage() {
  const supabase = await createClient();

  // ดึงสถิติจริง (ใช้ head: true เพื่อดึงแค่ count, ไม่ต้องดึงข้อมูลทั้งหมด)
  const newBooksCutoff = getOldCutoffYear();
  const [
    { count: booksCount },
    { count: newBooksCount },
    { count: membersCount },
    { count: activeLoans },
    { count: currentlyInside },
  ] = await Promise.all([
    supabase.from("books").select("*", { count: "exact", head: true }),
    supabase
      .from("books")
      .select("*", { count: "exact", head: true })
      .or(`publication_year.gt.${newBooksCutoff},publication_year.is.null`),
    supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("role", "member"),
    supabase
      .from("loans")
      .select("*", { count: "exact", head: true })
      .eq("status", "borrowed"),
    supabase
      .from("room_access_logs")
      .select("*", { count: "exact", head: true })
      .is("check_out_at", null),
  ]);

  const stats = [
    {
      label: "หนังสือในคลัง",
      value: booksCount ?? 0,
      icon: "books",
      color: "bg-meb-light text-meb-green",
    },
    {
      label: "หนังสือใหม่ (ต่ำกว่า 5 ปี)",
      value: newBooksCount ?? 0,
      icon: "sparkle",
      color: "bg-purple-50 text-purple-600",
    },
    {
      label: "สมาชิกทั้งหมด",
      value: membersCount ?? 0,
      icon: "users",
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "กำลังยืมอยู่",
      value: activeLoans ?? 0,
      icon: "arrow-clock",
      color: "bg-orange-50 text-terracotta",
    },
    {
      label: "อยู่ในห้องสมุด",
      value: currentlyInside ?? 0,
      icon: "door-open",
      color: "bg-emerald-50 text-emerald-600",
    },
  ];

  const quickActions = [
    {
      title: "จัดการหนังสือ",
      description: "เพิ่ม แก้ไข ลบ และตรวจสอบคลังหนังสือ",
      href: "/staff/books",
      icon: "books",
    },
    {
      title: "จัดการสมาชิก",
      description: "ตรวจสอบสมาชิก และสิทธิ์การยืม-คืน",
      href: "/staff/members",
      icon: "users",
    },
    {
      title: "ประวัติยืม-คืน",
      description: "ตรวจสอบและติดตามการยืม-คืนทั้งหมด",
      href: "/staff/loans",
      icon: "arrow-clock",
    },
    {
      title: "การเข้าใช้ห้องสมุด",
      description: "ดูสถิติและจัดการการเข้า-ออกของสมาชิก",
      href: "/staff/access-logs",
      icon: "door-open",
    },
  ];

  return (
    <>
      {/* Welcome banner — clone สไตล์จาก AmnatCharoen.html */}
      <section className="bg-gradient-to-r from-meb-green to-[#007f3d] rounded-xl shadow-sm p-6 text-white relative overflow-hidden print:hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-white opacity-10 rounded-full blur-2xl" />
        <div className="relative z-10">
          <p className="text-meb-light text-sm mb-1">สวัสดีเจ้าหน้าที่,</p>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            ยินดีต้อนรับสู่ศูนย์กลางการจัดการ
          </h1>
          <p className="text-sm text-white/80 flex items-center gap-2">
            <PhosphorIcon name="shield-check" weight="fill" /> ระบบห้องสมุดดิจิทัล วิทยาลัยเทคนิคอำนาจเจริญ
          </p>
        </div>
        <div className="absolute top-5 right-5 z-10 print:hidden">
          <PrintButton className="bg-white/20 text-white hover:bg-white/30 border border-white/30" />
        </div>
      </section>

      {/* Stats grid */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4 print:grid-cols-3 print:shadow-none">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-4 flex items-center gap-3 transition-colors"
          >
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0 ${s.color}`}
            >
              <PhosphorIcon name={s.icon} weight="fill" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-forest dark:text-slate-100 leading-none">
                {s.value.toLocaleString()}
              </p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">
                {s.label}
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* Quick actions */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors print:hidden">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-1.5 h-5 bg-meb-green rounded-full" />
          <h2 className="text-lg font-bold text-forest dark:text-slate-100">เมนูเร็ว</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="card-lift flex flex-col gap-2 p-4 rounded-lg border border-gray-100 dark:border-border-base hover:border-meb-green/30 transition"
            >
              <div className="w-10 h-10 rounded-lg bg-meb-light flex items-center justify-center text-meb-green text-xl">
                <PhosphorIcon name={a.icon} weight="fill" />
              </div>
              <h3 className="text-base font-bold text-forest dark:text-slate-100">{a.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {a.description}
              </p>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}