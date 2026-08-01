"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import {
  getMembersAction,
  suspendMembersByGroupAction,
  type User,
  type UserStats,
} from "../actions";
import { MemberTable } from "./member-table";
import { MemberDetailDrawer } from "./member-detail-drawer";
import { CreateMemberModal } from "./create-member-modal";

import type { DropdownOption } from "@/app/staff/settings/dropdowns/actions";

type MembersClientProps = {
  initialUsers: User[];
  initialStats: UserStats;
  departments: DropdownOption[];
  classLevels: DropdownOption[];
  roomLevels: DropdownOption[];
  classGroups: DropdownOption[];
};

/**
 * MembersClient — client-side controller สำหรับ /staff/members
 * จัดการ state: search/filter, drawer, refresh ข้อมูล
 * หมายเหตุ: stats เป็น initial only (ไม่ refetch ตอน filter เปลี่ยน)
 */
export function MembersClient({
  initialUsers,
  initialStats,
  departments,
  classLevels,
  roomLevels,
  classGroups,
}: MembersClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "member" | "staff" | "admin">(
    "all",
  );
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "suspended" | "expired"
  >("all");
  // ตัวกรองลดหลั่น: ปีการศึกษา → แผนก → ระดับชั้น → รหัสกลุ่มเรียน
  const [academicYearFilter, setAcademicYearFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [classLevelFilter, setClassLevelFilter] = useState("");
  const [classGroupFilter, setClassGroupFilter] = useState("");
  const [pending, startTransition] = useTransition();

  // drawer
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // create modal
  const [createOpen, setCreateOpen] = useState(false);

  // modal ระงับทั้งกลุ่มเรียน
  const [groupSuspendOpen, setGroupSuspendOpen] = useState(false);

  // รายชื่อปีการศึกษาที่มีอยู่ในระบบ (จาก classGroups)
  const academicYears = Array.from(
    new Set(
      classGroups
        .map((g) => g.academic_year)
        .filter((y): y is string => Boolean(y)),
    ),
  ).sort((a, b) => b.localeCompare(a));

  // ตัวเลือกลดหลั่นตามค่าที่เลือกก่อนหน้า
  const deptOptions = departments.filter((d) =>
    academicYearFilter
      ? classGroups.some(
          (g) =>
            g.department_id === d.id && g.academic_year === academicYearFilter,
        )
      : true,
  );
  const levelOptions = classLevels.filter((l) =>
    deptFilter
      ? classGroups.some(
          (g) => g.class_level_id === l.id && g.department_id === deptFilter,
        )
      : true,
  );
  const groupOptions = classGroups.filter(
    (g) =>
      (!academicYearFilter || g.academic_year === academicYearFilter) &&
      (!deptFilter || g.department_id === deptFilter) &&
      (!classLevelFilter || g.class_level_id === classLevelFilter),
  );

  function handleSearch() {
    startTransition(async () => {
      const result = await getMembersAction({
        search: search || undefined,
        role: roleFilter,
        status: statusFilter,
        academicYear: academicYearFilter || undefined,
        departmentId: deptFilter || undefined,
        classLevelId: classLevelFilter || undefined,
        classGroupId: classGroupFilter || undefined,
      });
      if (result.data) setUsers(result.data);
    });
  }

  // รีเซ็ตตัวกรองลดหลั่นที่อยู่ต่อท้ายเมื่อเปลี่ยนค่าบน
  function handleAcademicYearChange(v: string) {
    setAcademicYearFilter(v);
    setDeptFilter("");
    setClassLevelFilter("");
    setClassGroupFilter("");
  }
  function handleDeptChange(v: string) {
    setDeptFilter(v);
    setClassLevelFilter("");
    setClassGroupFilter("");
  }
  function handleClassLevelChange(v: string) {
    setClassLevelFilter(v);
    setClassGroupFilter("");
  }

  function handleRowClick(user: User) {
    setSelectedUser(user);
    setDrawerOpen(true);
  }

  // ระงับทั้งกลุ่มเรียน (ใช้ค่ากลุ่มที่กรองอยู่ หรือกลุ่มที่เลือก)
  async function handleGroupSuspend(
    classGroupId: string,
    reason: string,
  ): Promise<string | null> {
    const formData = new FormData();
    formData.set("class_group_id", classGroupId);
    formData.set("reason", reason);
    const res = await suspendMembersByGroupAction(formData);
    if (!res.error) handleSearch();
    return res.error ?? null;
  }

  return (
    <>
      {/* Header + Stats + Search (รวมใน section เดียว กระชับ) */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        {/* หัวข้อ + ปุ่มสร้าง */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <Link
              href="/staff"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-meb-green hover:bg-gray-100 dark:text-slate-400 dark:hover:text-meb-green dark:hover:bg-white/10 transition-all duration-200"
              title="ย้อนกลับไปหน้าเจ้าหน้าที่"
            >
              <PhosphorIcon name="arrow-left" className="text-xl" weight="bold" />
            </Link>
            <PhosphorIcon name="users" weight="fill" className="text-2xl text-meb-green" />
            <h1 className="text-lg md:text-xl font-bold text-forest dark:text-slate-100">
              จัดการสมาชิก
            </h1>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="btn-cta inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-meb-green hover:bg-meb-hover rounded-md shadow-sm cursor-pointer"
          >
            <PhosphorIcon name="plus" weight="bold" />
            สร้างบัญชีสมาชิก
          </button>
        </div>

        {/* Stats แถวเดียว 4 ช่อง กระชับ */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <MiniStat label="ทั้งหมด" value={initialStats.total} icon="users" color="text-meb-green" />
          <MiniStat label="สมาชิก" value={initialStats.members} icon="user" color="text-blue-600" />
          <MiniStat label="เจ้าหน้าที่" value={initialStats.staff} icon="shield-check" color="text-amber-600" />
          <MiniStat label="ระงับ" value={initialStats.suspended} icon="prohibit" color="text-price-red" />
        </div>

        {/* Search + filter ในบรรทัดเดียว */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <PhosphorIcon
              name="magnifying-glass"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="ค้นหา ชื่อ อีเมล หรือรหัสสมาชิก..."
              className="w-full pl-10 pr-3 py-2.5 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light dark:text-slate-100"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => {
              const v = e.target.value as "all" | "member" | "staff" | "admin";
              setRoleFilter(v);
              startTransition(async () => {
                const r = await getMembersAction({
                  search: search || undefined,
                  role: v,
                  status: statusFilter,
                  academicYear: academicYearFilter || undefined,
                  departmentId: deptFilter || undefined,
                  classLevelId: classLevelFilter || undefined,
                  classGroupId: classGroupFilter || undefined,
                });
                if (r.data) setUsers(r.data);
              });
            }}
            className="px-3 py-2.5 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100 shrink-0"
          >
            <option value="all">ทุกบทบาท</option>
            <option value="member">สมาชิก</option>
            <option value="staff">เจ้าหน้าที่</option>
            <option value="admin">ผู้ดูแล</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              const v = e.target.value as "all" | "active" | "suspended" | "expired";
              setStatusFilter(v);
              startTransition(async () => {
                const r = await getMembersAction({
                  search: search || undefined,
                  role: roleFilter,
                  status: v,
                  academicYear: academicYearFilter || undefined,
                  departmentId: deptFilter || undefined,
                  classLevelId: classLevelFilter || undefined,
                  classGroupId: classGroupFilter || undefined,
                });
                if (r.data) setUsers(r.data);
              });
            }}
            className="px-3 py-2.5 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100 shrink-0"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="active">ใช้งาน</option>
            <option value="suspended">ระงับ</option>
            <option value="expired">พ้นสภาพ</option>
          </select>
          <button
            type="button"
            onClick={() => setGroupSuspendOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-bold text-price-red bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/20 rounded-md transition shrink-0 cursor-pointer"
            title="ระงับสมาชิกทั้งหมดในรหัสกลุ่มเรียน (เช่น กรณีพ้นสภาพทั้งกลุ่ม)"
          >
            <PhosphorIcon name="prohibit" weight="bold" />
            ระงับทั้งกลุ่ม
          </button>
        </div>

        {/* ตัวกรองลดหลั่น: ปีการศึกษา → แผนก → ระดับชั้น → รหัสกลุ่มเรียน */}
        <div className="flex flex-wrap gap-2 mt-2">
          <select
            value={academicYearFilter}
            onChange={(e) => handleAcademicYearChange(e.target.value)}
            className="px-3 py-2 text-xs bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100"
          >
            <option value="">ปีการศึกษา (ทั้งหมด)</option>
            {academicYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={deptFilter}
            onChange={(e) => handleDeptChange(e.target.value)}
            className="px-3 py-2 text-xs bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100"
          >
            <option value="">แผนก (ทั้งหมด)</option>
            {deptOptions.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select
            value={classLevelFilter}
            onChange={(e) => handleClassLevelChange(e.target.value)}
            className="px-3 py-2 text-xs bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100"
          >
            <option value="">ระดับชั้น (ทั้งหมด)</option>
            {levelOptions.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <select
            value={classGroupFilter}
            onChange={(e) => {
              setClassGroupFilter(e.target.value);
              startTransition(async () => {
                const r = await getMembersAction({
                  search: search || undefined,
                  role: roleFilter,
                  status: statusFilter,
                  academicYear: academicYearFilter || undefined,
                  departmentId: deptFilter || undefined,
                  classLevelId: classLevelFilter || undefined,
                  classGroupId: e.target.value || undefined,
                });
                if (r.data) setUsers(r.data);
              });
            }}
            className="px-3 py-2 text-xs bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100"
          >
            <option value="">รหัสกลุ่มเรียน (ทั้งหมด)</option>
            {groupOptions.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Member table */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        {pending ? (
          <div className="flex items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <PhosphorIcon name="circle-notch" className="text-3xl animate-spin mr-2" />
            <span className="text-sm">กำลังโหลด...</span>
          </div>
        ) : (
          <MemberTable users={users} onRowClick={handleRowClick} />
        )}
      </section>

      {/* Drawer รายละเอียด/แก้ไขสมาชิก */}
      <MemberDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={selectedUser}
        departments={departments}
        classLevels={classLevels}
        roomLevels={roomLevels}
        classGroups={classGroups}
      />

      {/* Modal สร้างสมาชิกใหม่ */}
      <CreateMemberModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={handleSearch}
        departments={departments}
        classLevels={classLevels}
        roomLevels={roomLevels}
        classGroups={classGroups}
      />

      {/* Modal ระงับทั้งกลุ่มเรียน */}
      <GroupSuspendModal
        open={groupSuspendOpen}
        onClose={() => setGroupSuspendOpen(false)}
        classGroups={groupOptions}
        onSuspend={handleGroupSuspend}
      />
    </>
  );
}

/** MiniStat — การ์ดสถิติเล็กๆ กระชับ สำหรับแถวเดียว */
function MiniStat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-border-base">
      <PhosphorIcon name={icon} weight="fill" className={`text-base ${color} shrink-0`} />
      <div className="min-w-0">
        <p className="text-lg font-bold text-forest dark:text-slate-100 leading-none">{value}</p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{label}</p>
      </div>
    </div>
  );
}

/** GroupSuspendModal — ระงับสมาชิกทั้งหมดในรหัสกลุ่มเรียน (ระบุเหตุผล) */
function GroupSuspendModal({
  open,
  onClose,
  classGroups,
  onSuspend,
}: {
  open: boolean;
  onClose: () => void;
  classGroups: DropdownOption[];
  onSuspend: (classGroupId: string, reason: string) => Promise<string | null>;
}) {
  const [groupId, setGroupId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAlert(null);
    if (!groupId) {
      setAlert({ type: "error", msg: "กรุณาเลือกกลุ่มเรียน" });
      return;
    }
    if (!reason.trim()) {
      setAlert({ type: "error", msg: "กรุณาระบุเหตุผลการระงับ" });
      return;
    }
    setBusy(true);
    const err = await onSuspend(groupId, reason.trim());
    setBusy(false);
    if (err) {
      setAlert({ type: "error", msg: err });
      return;
    }
    setAlert({ type: "success", msg: "ระงับสมาชิกทั้งกลุ่มเรียบร้อยแล้ว" });
    setGroupId("");
    setReason("");
    setTimeout(onClose, 1200);
  }

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md bg-white dark:bg-card-bg rounded-2xl shadow-2xl border border-gray-100 dark:border-border-base p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-forest dark:text-slate-100 flex items-center gap-2">
              <PhosphorIcon name="prohibit" weight="fill" className="text-price-red" />
              ระงับสมาชิกทั้งกลุ่ม
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10 transition"
              aria-label="ปิด"
            >
              <PhosphorIcon name="x" className="text-xl" />
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            ระงับบัญชีสมาชิกทุกคน (บทบาทสมาชิก, สถานะใช้งาน) ในกลุ่มเรียนนี้พร้อมกัน
            เหมาะสำหรับกรณีทั้งกลุ่มพ้นสภาพการเป็นนักศึกษา
          </p>

          {alert && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                alert.type === "success"
                  ? "bg-meb-light text-meb-green"
                  : "bg-red-50 dark:bg-red-500/10 text-price-red"
              }`}
            >
              <PhosphorIcon
                name={alert.type === "success" ? "check-circle" : "warning"}
                weight="fill"
              />
              {alert.msg}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-forest dark:text-slate-100">
              รหัสกลุ่มเรียน <span className="text-price-red">*</span>
            </label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              required
            >
              <option value="">-- เลือกรหัสกลุ่มเรียน --</option>
              {classGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                  {g.academic_year ? ` (ปี ${g.academic_year})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-forest dark:text-slate-100">
              เหตุผลการระงับ <span className="text-price-red">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="เช่น พ้นสภาพการเป็นนักศึกษา ครบกำหนดหลักสูตร..."
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100 resize-none"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-border-base rounded-md transition disabled:opacity-60"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-price-red hover:bg-red-700 rounded-md transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? (
                <PhosphorIcon name="circle-notch" className="animate-spin" />
              ) : (
                <PhosphorIcon name="prohibit" weight="bold" />
              )}
              ยืนยันการระงับ
            </button>
          </div>
        </form>
      </div>
    </>
  );
}