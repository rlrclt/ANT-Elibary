"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import { getMembersAction, type User, type UserStats } from "../actions";
import { MemberTable } from "./member-table";
import { MemberDetailDrawer } from "./member-detail-drawer";
import { CreateMemberModal } from "./create-member-modal";

type MembersClientProps = {
  initialUsers: User[];
  initialStats: UserStats;
};

/**
 * MembersClient — client-side controller สำหรับ /staff/members
 * จัดการ state: search/filter, drawer, refresh ข้อมูล
 * หมายเหตุ: stats เป็น initial only (ไม่ refetch ตอน filter เปลี่ยน)
 */
export function MembersClient({ initialUsers, initialStats }: MembersClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "member" | "staff" | "admin">(
    "all",
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">(
    "all",
  );
  const [pending, startTransition] = useTransition();

  // drawer
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // create modal
  const [createOpen, setCreateOpen] = useState(false);

  function handleSearch() {
    startTransition(async () => {
      const result = await getMembersAction({
        search: search || undefined,
        role: roleFilter,
        status: statusFilter,
      });
      if (result.data) setUsers(result.data);
    });
  }

  function handleRowClick(user: User) {
    setSelectedUser(user);
    setDrawerOpen(true);
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
        <div className="flex gap-2">
          <div className="relative flex-1">
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
              const v = e.target.value as "all" | "active" | "suspended";
              setStatusFilter(v);
              startTransition(async () => {
                const r = await getMembersAction({
                  search: search || undefined,
                  role: roleFilter,
                  status: v,
                });
                if (r.data) setUsers(r.data);
              });
            }}
            className="px-3 py-2.5 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100 shrink-0"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="active">ใช้งาน</option>
            <option value="suspended">ระงับ</option>
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
      />

      {/* Modal สร้างสมาชิกใหม่ */}
      <CreateMemberModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={handleSearch}
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