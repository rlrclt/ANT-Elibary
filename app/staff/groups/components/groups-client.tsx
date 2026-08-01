"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import {
  getGroupMembersAction,
  getGroupInfoAction,
  type GroupMember,
} from "../actions";
import type { DropdownOption } from "@/app/staff/settings/dropdowns/actions";

type GroupsClientProps = {
  departments: DropdownOption[];
  classLevels: DropdownOption[];
  classGroups: DropdownOption[];
};

type GroupSummary = {
  code: string;
  name: string | null;
  academic_year: string | null;
  department_name: string | null;
  class_level_name: string | null;
};

/**
 * GroupsClient — หน้าเจาะกลุ่มเรียน (/staff/groups)
 * เลือกลดหลั่น: ปีการศึกษา → แผนก → ระดับชั้น → รหัสกลุ่มเรียน
 * เมื่อเลือกกลุ่มแล้วแสดงรายชื่อสมาชิกทั้งหมดในกลุ่มนั้น
 * คลิกที่สมาชิกเพื่อดูประวัติ (ไปหน้า read-only /staff/members/[id])
 */
export function GroupsClient({ departments, classLevels, classGroups }: GroupsClientProps) {
  const [year, setYear] = useState("");
  const [dept, setDept] = useState("");
  const [level, setLevel] = useState("");
  const [groupId, setGroupId] = useState("");
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [groupInfo, setGroupInfo] = useState<GroupSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // รายชื่อปีการศึกษาที่มีในระบบ (จาก classGroups)
  const years = Array.from(
    new Set(
      classGroups.map((g) => g.academic_year).filter((y): y is string => Boolean(y)),
    ),
  ).sort((a, b) => b.localeCompare(a));

  // ตัวเลือกลดหลั่นตามค่าที่เลือกก่อนหน้า
  const deptOptions = departments.filter((d) =>
    year
      ? classGroups.some((g) => g.department_id === d.id && g.academic_year === year)
      : true,
  );
  const levelOptions = classLevels.filter((l) =>
    dept
      ? classGroups.some((g) => g.class_level_id === l.id && g.department_id === dept)
      : true,
  );
  const groupOptions = classGroups.filter(
    (g) =>
      (!year || g.academic_year === year) &&
      (!dept || g.department_id === dept) &&
      (!level || g.class_level_id === level),
  );

  // ตัวช่วย: ตัวเลือกนี้มีสมาชิกกี่คน (แสดงเป็น badge เพื่อความสะดวก)
  function memberHint(g: DropdownOption) {
    return g.academic_year ? `ปี ${g.academic_year}` : "";
  }

  function resetLower(newYear: string) {
    setYear(newYear);
    setDept("");
    setLevel("");
    setGroupId("");
    setMembers(null);
    setGroupInfo(null);
    setError(null);
  }

  function handleGroupSelect(id: string) {
    setGroupId(id);
    if (!id) {
      setMembers(null);
      setGroupInfo(null);
      setError(null);
      return;
    }
    startTransition(async () => {
      const [mRes, iRes] = await Promise.all([
        getGroupMembersAction(id),
        getGroupInfoAction(id),
      ]);
      if (mRes.error || iRes.error) {
        setError(mRes.error || iRes.error);
        setMembers(null);
        setGroupInfo(null);
        return;
      }
      setMembers(mRes.data ?? []);
      setGroupInfo(iRes.data ?? null);
      setError(null);
    });
  }

  return (
    <>
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        {/* หัวข้อ */}
        <div className="flex items-center gap-2.5 mb-4">
          <Link
            href="/staff"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-meb-green hover:bg-gray-100 dark:text-slate-400 dark:hover:text-meb-green dark:hover:bg-white/10 transition-all duration-200"
            title="ย้อนกลับไปหน้าเจ้าหน้าที่"
          >
            <PhosphorIcon name="arrow-left" className="text-xl" weight="bold" />
          </Link>
          <PhosphorIcon name="tree-structure" weight="fill" className="text-2xl text-meb-green" />
          <h1 className="text-lg md:text-xl font-bold text-forest dark:text-slate-100">
            เจาะกลุ่มเรียน
          </h1>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          เลือกตั้งแต่ปีการศึกษาลึกลงไปเรื่อยๆ เพื่อดูรายชื่อสมาชิกทั้งหมดในกลุ่มเรียน
        </p>

        {/* ตัวเลือกแบบลดหลั่น */}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={year}
            onChange={resetLower}
            placeholder="ปีการศึกษา"
            icon="calendar"
            options={years.map((y) => ({ value: y, label: `ปีการศึกษา ${y}` }))}
          />
          <Caret />
          <Select
            value={dept}
            onChange={(v) => {
              setDept(v);
              setLevel("");
              setGroupId("");
              setMembers(null);
              setGroupInfo(null);
              setError(null);
            }}
            placeholder="แผนกวิชา"
            icon="buildings"
            disabled={!year}
            options={deptOptions.map((d) => ({ value: d.id, label: d.name }))}
          />
          <Caret />
          <Select
            value={level}
            onChange={(v) => {
              setLevel(v);
              setGroupId("");
              setMembers(null);
              setGroupInfo(null);
              setError(null);
            }}
            placeholder="ระดับชั้น"
            icon="student"
            disabled={!dept}
            options={levelOptions.map((l) => ({ value: l.id, label: l.name }))}
          />
          <Caret />
          <Select
            value={groupId}
            onChange={handleGroupSelect}
            placeholder="รหัสกลุ่มเรียน"
            icon="hash"
            disabled={!level}
            options={groupOptions.map((g) => ({
              value: g.id,
              label: `${g.name}${memberHint(g) ? ` (${memberHint(g)})` : ""}`,
            }))}
          />
        </div>

        {/* สรุปรายละเอียดกลุ่มที่เลือก */}
        {groupInfo && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
            <Chip icon="calendar" label={`ปีการศึกษา ${groupInfo.academic_year ?? "-"}`} />
            <Caret />
            <Chip icon="buildings" label={groupInfo.department_name ?? "ไม่ระบุแผนก"} />
            <Caret />
            <Chip icon="student" label={groupInfo.class_level_name ?? "ไม่ระบุระดับชั้น"} />
            <Caret />
            <Chip icon="hash" label={groupInfo.code} highlight />
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-sm text-price-red">
            <PhosphorIcon name="warning" weight="fill" />
            {error}
          </div>
        )}
      </section>

      {/* รายชื่อสมาชิกในกลุ่ม */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        {pending ? (
          <div className="flex items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <PhosphorIcon name="circle-notch" className="text-3xl animate-spin mr-2" />
            <span className="text-sm">กำลังโหลด...</span>
          </div>
        ) : !groupId ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500">
            <PhosphorIcon name="tree-structure" className="text-4xl mx-auto mb-2 opacity-40" />
            <p className="text-sm">
              กรุณาเลือกรหัสกลุ่มเรียนด้านบนเพื่อดูรายชื่อสมาชิก
            </p>
          </div>
        ) : members === null ? null : members.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500">
            <PhosphorIcon name="users-three" className="text-4xl mx-auto mb-2 opacity-40" />
            <p className="text-sm">ไม่พบสมาชิกในกลุ่มนี้</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <PhosphorIcon name="users" weight="fill" className="text-meb-green" />
              <h2 className="font-bold text-forest dark:text-slate-100">
                สมาชิกทั้งหมด {members.length} คน
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-border-base text-left text-xs text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3 font-medium">รหัสสมาชิก</th>
                    <th className="px-4 py-3 font-medium">ชื่อ-สกุล</th>
                    <th className="px-4 py-3 font-medium">สถานะ</th>
                    <th className="px-4 py-3 font-medium">เบอร์โทร</th>
                    <th className="px-4 py-3 font-medium">ยอดค่าปรับ</th>
                    <th className="px-4 py-3 font-medium text-right">ดูประวัติ</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const expired = m.expired;
                    const suspended = m.status === "suspended";
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-gray-50 dark:border-border-base last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-forest dark:text-slate-100">
                          {m.user_id_code || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <p className={`font-medium ${expired ? "text-price-red" : "text-forest dark:text-slate-100"}`}>
                            {m.full_name}
                          </p>
                          {m.class_number && (
                            <p className="text-xs text-slate-400">
                              เลขที่ {m.class_number}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {suspended ? (
                            <StatusBadge label="ระงับ" cls="bg-red-50 text-price-red border border-red-200" icon="prohibit" />
                          ) : expired ? (
                            <StatusBadge label="พ้นสภาพ" cls="bg-orange-50 text-orange-600 border border-orange-200" icon="warning" />
                          ) : (
                            <StatusBadge label="ใช้งาน" cls="bg-meb-light text-meb-green border border-meb-light" icon="check-circle" />
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {m.phone || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {m.fine_balance > 0 ? (
                            <span className="font-semibold text-price-red">
                              {m.fine_balance.toLocaleString()} บาท
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <Link
                            href={`/staff/members/${m.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-meb-green bg-meb-light hover:bg-meb-green hover:text-white rounded-md transition"
                          >
                            <PhosphorIcon name="list-magnifying-glass" weight="bold" className="text-sm" />
                            ดูประวัติ
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}

/* ---------- Sub-components ---------- */

function Caret() {
  return (
    <PhosphorIcon
      name="caret-right"
      weight="bold"
      className="text-slate-300 dark:text-slate-600 text-base shrink-0"
    />
  );
}

function Select({
  value,
  onChange,
  placeholder,
  icon,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="relative shrink-0">
      <PhosphorIcon
        name={icon}
        weight="bold"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none"
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="pl-9 pr-3 py-2.5 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Chip({
  icon,
  label,
  highlight,
}: {
  icon: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border ${
        highlight
          ? "bg-meb-light border-meb-light text-meb-green font-bold"
          : "bg-gray-50 dark:bg-black/20 border-gray-100 dark:border-border-base text-slate-600 dark:text-slate-300"
      }`}
    >
      <PhosphorIcon name={icon} weight="bold" className="text-sm" />
      {label}
    </span>
  );
}

function StatusBadge({
  label,
  cls,
  icon,
}: {
  label: string;
  cls: string;
  icon: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-bold ${cls}`}>
      <PhosphorIcon name={icon} weight="fill" className="text-xs" />
      {label}
    </span>
  );
}
