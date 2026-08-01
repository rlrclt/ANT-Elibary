import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Fragment } from "react";
import { createClient } from "@/utils/supabase/server";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import { computeExpiry, formatThaiDate } from "@/utils/student-expiry";

export const metadata: Metadata = {
  title: "ประวัติสมาชิก — ANT E-Library",
};

/**
 * หน้าประวัติสมาชิกแบบอ่านอย่างเดียว (/staff/members/[id])
 * ดูข้อมูลส่วนตัว + สถานะ (ใช้งาน/ระงับ/พ้นสภาพ) + ประวัติทั้งหมด
 * ห้ามแก้ไขข้อมูลใดๆ (read-only) — แก้ไขได้ที่หน้า /staff/members
 */

type PageProps = {
  params: Promise<{ id: string }>;
};

const ROLE_LABEL: Record<string, string> = {
  member: "สมาชิก",
  staff: "เจ้าหน้าที่",
  admin: "ผู้ดูแล",
};

// ฟอร์แมตวันที่ dd/MM/yyyy
function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ฟอร์แมตเวลา HH:mm
function formatTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

const BORROW_STATUS: Record<string, { label: string; class: string }> = {
  borrowing: { label: "กำลังยืม", class: "bg-amber-50 text-amber-600" },
  returned: { label: "คืนแล้ว", class: "bg-meb-light text-meb-green" },
  overdue: { label: "เกินกำหนด", class: "bg-red-50 text-price-red" },
  lost: { label: "สูญหาย", class: "bg-red-50 text-price-red" },
};

export default async function StaffMemberHistoryPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [memberRes, borrowRes, accessRes, fineRes] = await Promise.all([
    supabase
      .from("users")
      .select(
        "*, dropdown_class_groups(id, code, name, department_id, class_level_id, academic_year, start_date, duration_years)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("v_borrow_records_detail")
      .select("*")
      .eq("user_id", id)
      .order("borrowed_at", { ascending: false })
      .limit(50),
    supabase
      .from("room_access_logs")
      .select("*")
      .eq("user_id", id)
      .order("check_in_at", { ascending: false })
      .limit(50),
    supabase
      .from("fine_payments")
      .select("*, borrow_records(id, due_date, returned_at)")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const member = memberRes.data;
  if (!member || memberRes.error) notFound();

  const group = member.dropdown_class_groups ?? null;
  const expiry = computeExpiry({
    start_date: group?.start_date,
    duration_years: group?.duration_years,
  });

  const borrows = (borrowRes.data ?? []) as any[];
  const accessLogs = (accessRes.data ?? []) as any[];
  const finePayments = (fineRes.data ?? []) as any[];

  const departmentName = group
    ? await supabase
        .from("dropdown_departments")
        .select("name")
        .eq("id", group.department_id)
        .maybeSingle()
        .then((r) => r.data?.name ?? null)
    : null;
  const className = group
    ? await supabase
        .from("dropdown_class_levels")
        .select("name")
        .eq("id", group.class_level_id)
        .maybeSingle()
        .then((r) => r.data?.name ?? null)
    : null;

  // ลำดับการจัดกลุ่ม (ค้นหาง่ายสุด): ปีการศึกษา → แผนก → ระดับชั้น → ห้องเรียน → รหัสกลุ่มเรียน
  const groupPath = [
    group?.academic_year
      ? { label: "ปีการศึกษา", value: group.academic_year, icon: "calendar" }
      : null,
    departmentName || member.department
      ? { label: "แผนกวิชา", value: departmentName || member.department || "-", icon: "buildings" }
      : null,
    className || member.class_level
      ? { label: "ระดับชั้น", value: className || member.class_level || "-", icon: "student" }
      : null,
    member.room_level
      ? { label: "ห้องเรียน", value: member.room_level, icon: "door-open" }
      : null,
    group?.code
      ? { label: "รหัสกลุ่มเรียน", value: group.code, icon: "hash" }
      : null,
  ].filter((x): x is { label: string; value: string; icon: string } => x !== null);

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav aria-label="breadcrumb" className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
        <Link href="/staff" className="hover:text-meb-green transition">
          หน้าแรก
        </Link>
        <PhosphorIcon name="caret-right" className="text-[10px] text-slate-400" />
        <Link href="/staff/members" className="hover:text-meb-green transition">
          จัดการสมาชิก
        </Link>
        <PhosphorIcon name="caret-right" className="text-[10px] text-slate-400" />
        <span className="text-slate-700 dark:text-slate-200 font-medium truncate max-w-[200px]">
          ประวัติสมาชิก
        </span>
      </nav>

      {/* Header การ์ด */}
      <div className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 sm:p-6 transition-colors">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          {member.avatar_url ? (
            <img
              src={member.avatar_url}
              alt={member.full_name}
              width={56}
              height={56}
              className="w-14 h-14 rounded-full object-cover bg-gray-100 dark:bg-white/10 shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-meb-light text-meb-green flex items-center justify-center text-lg font-bold shrink-0">
              {member.full_name.slice(0, 2)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-forest dark:text-slate-100 truncate">
                {member.full_name}
              </h1>
              <span className="px-2 py-0.5 text-xs rounded-full font-bold bg-meb-light text-meb-green">
                {ROLE_LABEL[member.role] ?? member.role}
              </span>
              {member.status === "suspended" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs rounded-full font-bold bg-red-50 text-price-red border border-red-200">
                  <PhosphorIcon name="prohibit" weight="fill" className="text-xs" />
                  ระงับบัญชี
                </span>
              )}
              {expiry.isExpired && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs rounded-full font-bold bg-orange-50 text-orange-600 border border-orange-200">
                  <PhosphorIcon name="warning" weight="fill" className="text-xs" />
                  พ้นสภาพการเป็นนักศึกษา
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              รหัสสมาชิก: <span className="font-semibold text-slate-700 dark:text-slate-200">{member.user_id_code}</span>
              {member.gender === "male" && " · ชาย"}
              {member.gender === "female" && " · หญิง"}
            </p>

            {/* ลำดับการจัดกลุ่ม: ปีการศึกษา → แผนก → ระดับชั้น → ห้องเรียน → รหัสกลุ่มเรียน */}
            {groupPath.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                {groupPath.map((item, i) => (
                  <Fragment key={item.label}>
                    {i > 0 && (
                      <PhosphorIcon name="caret-right" weight="bold" className="text-slate-300 dark:text-slate-600 text-[10px]" />
                    )}
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-border-base text-slate-600 dark:text-slate-300">
                      <PhosphorIcon name={item.icon} weight="bold" className="text-[12px]" />
                      <span className="text-slate-400 dark:text-slate-500">{item.label}:</span>
                      {item.value}
                    </span>
                  </Fragment>
                ))}
              </div>
            )}

            {/* สถานะพ้นสภาพ / ระงับ */}
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <InfoCell label="แผนก" value={member.department || "-"} />
              <InfoCell label="ระดับชั้น" value={className || member.class_level || "-"} />
              <InfoCell label="วันที่เริ่มนับ" value={formatThaiDate(expiry.startDate)} />
              <InfoCell label="วันพ้นสภาพ" value={expiry.expiryDate ? formatThaiDate(expiry.expiryDate) : "-"} />
            </div>
          </div>

          <Link
            href="/staff/members"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-border-base rounded-md transition shrink-0"
          >
            <PhosphorIcon name="arrow-left" weight="bold" />
            กลับ
          </Link>
        </div>

        {/* แบนเนอร์แจ้งเตือนถ้าถูกระงับ */}
        {member.status === "suspended" && (
          <div className="mt-4 flex items-start gap-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
            <PhosphorIcon name="warning" weight="fill" className="text-price-red text-xl shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-price-red">บัญชีนี้ถูกระงับการใช้งาน</p>
              {member.suspended_reason && (
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                  เหตุผล: {member.suspended_reason}
                </p>
              )}
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                วันที่ระงับ: {formatDate(member.suspended_at)} {member.suspended_at ? `เวลา ${formatTime(member.suspended_at)}` : ""}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ประวัติการยืม-คืน */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base overflow-hidden transition-colors">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-border-base flex items-center gap-2">
          <PhosphorIcon name="book-open" weight="fill" className="text-meb-green" />
          <h2 className="font-bold text-forest dark:text-slate-100">ประวัติการยืม-คืน</h2>
          <span className="text-xs text-slate-400 ml-auto">อ่านอย่างเดียว</span>
        </div>
        {borrows.length === 0 ? (
          <EmptyState text="ไม่มีประวัติการยืมหนังสือ" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-border-base text-left text-xs text-slate-500 dark:text-slate-400">
                  <th className="px-5 py-3 font-medium">หนังสือ</th>
                  <th className="px-5 py-3 font-medium">บาร์โค้ด</th>
                  <th className="px-5 py-3 font-medium">วันที่ยืม</th>
                  <th className="px-5 py-3 font-medium">กำหนดคืน</th>
                  <th className="px-5 py-3 font-medium">วันที่คืน</th>
                  <th className="px-5 py-3 font-medium">สถานะ</th>
                  <th className="px-5 py-3 font-medium text-right">ค่าปรับ</th>
                </tr>
              </thead>
              <tbody>
                {borrows.map((b) => {
                  const badge = BORROW_STATUS[b.status] ?? BORROW_STATUS.borrowing;
                  return (
                    <tr key={b.borrow_record_id} className="border-b border-gray-50 dark:border-border-base last:border-0">
                      <td className="px-5 py-3 min-w-[200px]">
                        <p className="font-medium text-forest dark:text-slate-100 truncate">{b.book_title}</p>
                        {b.book_author && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{b.book_author}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{b.copy_code}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{formatDate(b.borrowed_at)}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{formatDate(b.due_date)}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{formatDate(b.returned_at)}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${badge.class}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className={`px-5 py-3 text-right font-medium ${Number(b.fine_amount) > 0 ? "text-price-red" : "text-slate-600 dark:text-slate-300"}`}>
                        {Number(b.fine_amount) > 0 ? `฿${Number(b.fine_amount).toLocaleString("en-US")}` : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ประวัติการเข้าใช้ห้องสมุด */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base overflow-hidden transition-colors">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-border-base flex items-center gap-2">
          <PhosphorIcon name="door-open" weight="fill" className="text-meb-green" />
          <h2 className="font-bold text-forest dark:text-slate-100">ประวัติการเข้าใช้ห้องสมุด</h2>
        </div>
        {accessLogs.length === 0 ? (
          <EmptyState text="ไม่มีประวัติการเข้าใช้" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-border-base text-left text-xs text-slate-500 dark:text-slate-400">
                  <th className="px-5 py-3 font-medium">วันที่</th>
                  <th className="px-5 py-3 font-medium">เช็คอิน</th>
                  <th className="px-5 py-3 font-medium">เช็คเอาท์</th>
                  <th className="px-5 py-3 font-medium">วัตถุประสงค์</th>
                </tr>
              </thead>
              <tbody>
                {accessLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50 dark:border-border-base last:border-0">
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{formatDate(log.check_in_at)}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{formatTime(log.check_in_at)}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{formatTime(log.check_out_at)}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{log.purpose || "อ่านหนังสือ"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ประวัติการชำระค่าปรับ */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base overflow-hidden transition-colors">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-border-base flex items-center gap-2">
          <PhosphorIcon name="currency-btc" weight="fill" className="text-meb-green" />
          <h2 className="font-bold text-forest dark:text-slate-100">ประวัติการชำระค่าปรับ</h2>
        </div>
        {finePayments.length === 0 ? (
          <EmptyState text="ไม่มีประวัติการชำระค่าปรับ" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-border-base text-left text-xs text-slate-500 dark:text-slate-400">
                  <th className="px-5 py-3 font-medium">วันที่ชำระ</th>
                  <th className="px-5 py-3 font-medium">จำนวนเงิน</th>
                  <th className="px-5 py-3 font-medium">ช่องทาง</th>
                  <th className="px-5 py-3 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {finePayments.map((f) => (
                  <tr key={f.id} className="border-b border-gray-50 dark:border-border-base last:border-0">
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      {formatDate(f.reviewed_at ?? f.created_at)}
                    </td>
                    <td className="px-5 py-3 font-medium text-price-red">
                      ฿{Number(f.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      {f.payment_method === "counter"
                        ? "เงินสด (เคาน์เตอร์)"
                        : f.payment_method === "transfer"
                          ? "โอนเงิน"
                          : "ยังไม่เลือกวิธี"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                          f.status === "approved" || f.status === "counter_paid"
                            ? "bg-meb-light text-meb-green"
                            : f.status === "rejected"
                              ? "bg-red-50 text-price-red"
                              : f.status === "counter_pending"
                                ? "bg-sky-50 text-sky-600"
                                : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        {f.status === "approved" || f.status === "counter_paid"
                          ? "ชำระแล้ว"
                          : f.status === "rejected"
                            ? "ปฏิเสธ"
                            : f.status === "counter_pending"
                              ? "รอรับเงินสด"
                              : f.status === "unpaid"
                                ? "ยังไม่ชำระ"
                                : "รอตรวจสอบ"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** InfoCell — กล่องแสดง label + ค่า */
function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-border-base px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{label}</p>
      <p className="text-sm font-semibold text-forest dark:text-slate-100 truncate">{value}</p>
    </div>
  );
}

/** EmptyState — แสดงข้อความเมื่อไม่มีข้อมูล */
function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500">
      <PhosphorIcon name="info" className="text-3xl mb-2 opacity-60" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
