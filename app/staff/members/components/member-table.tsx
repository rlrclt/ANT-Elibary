"use client";

import { PhosphorIcon } from "../../../components/phosphor-icon";
import type { User } from "../actions";

/**
 * member-table — ตารางรายการสมาชิก
 * คอลัมน์: สมาชิก, บทบาท, แผนก/ระดับ, สถานะ, ค่าปรับ, วันที่สมัคร
 * คลิกแถว → onRowClick(user)
 */
type MemberTableProps = {
  users: User[];
  onRowClick: (user: User) => void;
};

// แมปสี badge บทบาท
const ROLE_BADGE: Record<User["role"], string> = {
  member: "bg-meb-light text-meb-green",
  staff: "bg-amber-50 text-amber-600",
  admin: "bg-red-50 text-price-red",
};

const ROLE_LABEL: Record<User["role"], string> = {
  member: "สมาชิก",
  staff: "เจ้าหน้าที่",
  admin: "ผู้ดูแล",
};

const STATUS_BADGE: Record<User["status"], string> = {
  active: "bg-meb-light text-meb-green",
  suspended: "bg-red-50 text-price-red",
};

const STATUS_LABEL: Record<User["status"], string> = {
  active: "ใช้งาน",
  suspended: "ระงับ",
};

// ฟอร์แมตวันที่ dd/MM/yyyy
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ฟอร์แมตเงิน ฿X,XXX
function formatMoney(n: number): string {
  return `฿${n.toLocaleString("en-US", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

// ดึง 2 ตัวอักษรแรกของชื่อสำหรับ avatar fallback
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function MemberTable({ users, onRowClick }: MemberTableProps) {
  // กรณีไม่มีสมาชิก — โชว์ empty state กลางการ์ด
  if (users.length === 0) {
    return (
      <div className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-12 transition-colors">
        <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
          <PhosphorIcon name="user-list" className="text-5xl mb-3" />
          <p className="text-sm">ไม่พบสมาชิก</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base overflow-hidden transition-colors">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-border-base text-left text-xs text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3 font-medium">สมาชิก</th>
              <th className="px-4 py-3 font-medium">บทบาท</th>
              <th className="px-4 py-3 font-medium">แผนก/ระดับ</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
              <th className="px-4 py-3 font-medium text-right">ค่าปรับ</th>
              <th className="px-4 py-3 font-medium">วันที่สมัคร</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                onClick={() => onRowClick(user)}
                className="border-b border-gray-50 dark:border-border-base last:border-0 cursor-pointer hover:bg-meb-light/50 dark:hover:bg-white/5 transition-colors"
              >
                {/* สมาชิก — avatar + ชื่อ + รหัส */}
                <td className="px-4 py-3 min-w-[180px]">
                  <div className="flex items-center gap-2.5">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.full_name}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full object-cover bg-gray-100 dark:bg-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-meb-light text-meb-green flex items-center justify-center text-xs font-bold shrink-0">
                        {getInitials(user.full_name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-forest dark:text-slate-100 truncate">
                        {user.full_name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {user.user_id_code}
                      </p>
                    </div>
                  </div>
                </td>
                {/* บทบาท */}
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_BADGE[user.role]}`}
                  >
                    {ROLE_LABEL[user.role]}
                  </span>
                </td>
                {/* แผนก/ระดับ */}
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {user.department || user.class_level ? (
                    <span className="truncate">
                      {user.department ?? "-"}
                      {user.class_level ? ` · ${user.class_level}` : ""}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                {/* สถานะ */}
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[user.status]}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${user.status === "active" ? "bg-meb-green" : "bg-price-red"}`}
                    />
                    {STATUS_LABEL[user.status]}
                  </span>
                </td>
                {/* ค่าปรับ */}
                <td
                  className={`px-4 py-3 text-right font-medium ${user.fine_balance > 0 ? "text-price-red" : "text-slate-600 dark:text-slate-300"}`}
                >
                  {formatMoney(Number(user.fine_balance) || 0)}
                </td>
                {/* วันที่สมัคร */}
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {formatDate(user.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}