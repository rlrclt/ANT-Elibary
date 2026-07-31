"use client";

import { useRef, useState, useEffect, useTransition } from "react";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import {
  updateMemberAction,
  suspendMemberAction,
  activateMemberAction,
  type User,
} from "../actions";

/**
 * member-detail-drawer — แผงรายละเอียด/แก้ไขสมาชิก
 * Slide-in จากขวา, ฟอร์มแก้ไขข้อมูล + ปุ่มระงับ/เปิดใช้งาน
 */
import type { DropdownOption } from "@/app/staff/settings/dropdowns/actions";

type MemberDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  user: User | null;
  departments: DropdownOption[];
  classLevels: DropdownOption[];
  roomLevels: DropdownOption[];
  classGroups: DropdownOption[];
};

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

const ROLE_LABEL: Record<User["role"], string> = {
  member: "สมาชิก",
  staff: "เจ้าหน้าที่",
  admin: "ผู้ดูแล",
};

const STATUS_LABEL: Record<User["status"], string> = {
  active: "ใช้งาน",
  suspended: "ระงับ",
};

export function MemberDetailDrawer({
  open,
  onClose,
  user,
  departments,
  classLevels,
  roomLevels,
  classGroups,
}: MemberDetailDrawerProps) {
  const [pending, startTransition] = useTransition();
  const [statusPending, startStatusTransition] = useTransition();
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [currentStatus, setCurrentStatus] = useState<User["status"] | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // เก็บสถานะปัจจุบันไว้สำหรับสลับปุ่ม suspend/activate
  const activeStatus: User["status"] | null =
    currentStatus ?? user?.status ?? null;

  const [userType, setUserType] = useState<string>("student");
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [selectedClassLevelId, setSelectedClassLevelId] = useState("");
  const [selectedRoomLevelId, setSelectedRoomLevelId] = useState("");
  const [selectedClassGroupId, setSelectedClassGroupId] = useState("");

  useEffect(() => {
    if (user) {
      setUserType(user.user_type || "student");
      setSelectedDeptId(user.department_id || "");
      setSelectedClassLevelId(user.class_level_id || "");
      setSelectedRoomLevelId(user.room_level_id || "");
      setSelectedClassGroupId(user.class_group_id || "");
      setCurrentStatus(null);
    }
  }, [user]);

  // submit ฟอร์มแก้ไขข้อมูลสมาชิก
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setAlert(null);
    const formData = new FormData(e.currentTarget);
    formData.set("id", user.id);
    startTransition(async () => {
      const res = await updateMemberAction(formData);
      if (res.error) {
        setAlert({ type: "error", msg: res.error });
        return;
      }
      setAlert({ type: "success", msg: "บันทึกข้อมูลเรียบร้อยแล้ว" });
    });
  }

  // trigger ฟอร์มผ่านปุ่มใน footer (อยู่นอก <form>)
  function handleSaveClick() {
    formRef.current?.requestSubmit();
  }

  // สลับสถานะระงับ/เปิดใช้งาน
  function handleToggleStatus() {
    if (!user) return;
    setAlert(null);
    const formData = new FormData();
    formData.set("id", user.id);
    startStatusTransition(async () => {
      const res =
        activeStatus === "active"
          ? await suspendMemberAction(formData)
          : await activateMemberAction(formData);
      if (res.error) {
        setAlert({ type: "error", msg: res.error });
        return;
      }
      setCurrentStatus(activeStatus === "active" ? "suspended" : "active");
      setAlert({
        type: "success",
        msg:
          activeStatus === "active"
            ? "ระงับบัญชีเรียบร้อยแล้ว"
            : "เปิดใช้งานบัญชีเรียบร้อยแล้ว",
      });
    });
  }

  return (
    <>
      {/* Backdrop มืดๆ */}
      {open && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer slide-in จากขวา (แก้ไขเป็นสไลด์ขึ้นเต็มจอจากด้านล่าง) */}
      <aside
        className={`fixed inset-0 h-full w-full transform transition-transform duration-300 z-[95] bg-white dark:bg-card-bg shadow-2xl flex flex-col ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        aria-hidden={!open}
      >
        {/* Header: avatar + ชื่อ + ปุ่มปิด */}
        <div className="border-b border-gray-100 dark:border-border-base bg-white dark:bg-card-bg shrink-0">
          <div className="flex items-center justify-between p-5 max-w-3xl mx-auto w-full">
            <div className="flex items-center gap-3 min-w-0 pr-4">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full object-cover bg-gray-100 dark:bg-white/10 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-meb-light text-meb-green flex items-center justify-center text-base font-bold shrink-0">
                  {user ? getInitials(user.full_name) : ""}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-forest dark:text-slate-100 truncate">
                  {user?.full_name ?? "-"}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                  {user?.user_id_code ?? "-"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-slate-200 transition"
              aria-label="ปิด"
            >
              <PhosphorIcon name="x" className="text-xl" />
            </button>
          </div>
        </div>

        {/* Body — scroll ได้ */}
        <div className="p-5 md:p-8 overflow-y-auto flex-1 bg-gray-50/30 dark:bg-black/10">
          <div className="max-w-3xl mx-auto">
          {user ? (
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              {/* Alert success/error */}
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

              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                {/* Avatar URL */}
                <div className="md:col-span-6">
                  <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                    URL รูปประจำตัว
                  </label>
                  <input
                    name="avatar_url"
                    type="text"
                    defaultValue={user.avatar_url ?? ""}
                    placeholder="https://..."
                    className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                  />
                </div>

                {/* Full name */}
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                    ชื่อ-สกุล <span className="text-terracotta">*</span>
                  </label>
                  <input
                    name="full_name"
                    type="text"
                    required
                    defaultValue={user.full_name}
                    className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                  />
                </div>

                {/* Email */}
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                    อีเมล
                  </label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={user.email ?? ""}
                    placeholder="user@example.com"
                    className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                  />
                </div>

                {/* Phone */}
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                    เบอร์โทรศัพท์
                  </label>
                  <input
                    name="phone"
                    type="tel"
                    defaultValue={user.phone ?? ""}
                    placeholder="08x-xxx-xxxx"
                    className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                  />
                </div>

                {/* User ID code (readonly) */}
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                    รหัสสมาชิก
                  </label>
                  <input
                    name="user_id_code"
                    type="text"
                    readOnly
                    defaultValue={user.user_id_code}
                    className="w-full pl-3 pr-3 py-2.5 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  />
                </div>

                {/* New Password */}
                <div className="md:col-span-6">
                  <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                    ตั้งรหัสผ่านใหม่สำหรับสมาชิก <span className="text-xs text-slate-500 font-normal">(เว้นว่างไว้หากไม่ต้องการเปลี่ยน)</span>
                  </label>
                  <div className="relative">
                    <input
                      name="new_password"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="กรอกรหัสผ่านใหม่ อย่างน้อย 8 ตัวอักษร"
                      className="w-full pl-3 pr-10 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer"
                    >
                      <PhosphorIcon name={showNewPassword ? "eye-slash" : "eye"} className="text-lg" />
                    </button>
                  </div>
                </div>

                {/* User Type */}
                <div className="md:col-span-6">
                  <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                    ประเภทผู้ใช้งาน <span className="text-terracotta">*</span>
                  </label>
                  <select
                    name="user_type"
                    value={userType}
                    onChange={(e) => setUserType(e.target.value)}
                    className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                  >
                    <option value="student">นักเรียน/นักศึกษา (Student)</option>
                    <option value="teacher">ครู/อาจารย์ (Teacher)</option>
                    <option value="staff">บุคลากร/เจ้าหน้าที่ (Staff)</option>
                    <option value="external">บุคคลภายนอก (External)</option>
                  </select>
                </div>

                {/* Department */}
                {userType !== "external" && (
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                      แผนกวิชา <span className="text-terracotta">*</span>
                    </label>
                    <select
                      name="department_id"
                      value={selectedDeptId}
                      onChange={(e) => setSelectedDeptId(e.target.value)}
                      className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                      required
                    >
                      <option value="">-- เลือกแผนกวิชา --</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Student fields */}
                {userType === "student" && (
                  <>
                    {/* Class level */}
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                        ระดับชั้น <span className="text-terracotta">*</span>
                      </label>
                      <select
                        name="class_level_id"
                        value={selectedClassLevelId}
                        onChange={(e) => setSelectedClassLevelId(e.target.value)}
                        className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                        required
                      >
                        <option value="">-- เลือกระดับชั้น --</option>
                        {classLevels.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Room Level */}
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                        กลุ่มเรียน/ห้องเรียน <span className="text-terracotta">*</span>
                      </label>
                      <select
                        name="room_level_id"
                        value={selectedRoomLevelId}
                        onChange={(e) => setSelectedRoomLevelId(e.target.value)}
                        className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                        required
                      >
                        <option value="">-- เลือกห้องเรียน --</option>
                        {roomLevels.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Class Group Code */}
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                        รหัสกลุ่มเรียน <span className="text-terracotta">*</span>
                      </label>
                      <select
                        name="class_group_id"
                        value={selectedClassGroupId}
                        onChange={(e) => setSelectedClassGroupId(e.target.value)}
                        className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                        required
                      >
                        <option value="">-- เลือกรหัสกลุ่มเรียน --</option>
                        {classGroups
                          .filter((cg) => cg.department_id === selectedDeptId && cg.class_level_id === selectedClassLevelId)
                          .map((cg) => (
                            <option key={cg.id} value={cg.id}>
                              {cg.academic_year ? `${cg.name} (ปีการศึกษา ${cg.academic_year})` : cg.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Class number */}
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                        เลขที่
                      </label>
                      <input
                        name="class_number"
                        type="text"
                        defaultValue={user.class_number ?? ""}
                        className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                      />
                    </div>
                  </>
                )}

                {/* Address */}
                <div className="md:col-span-6">
                  <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                    ที่อยู่
                  </label>
                  <textarea
                    name="address"
                    rows={3}
                    defaultValue={user.address ?? ""}
                    placeholder="ที่อยู่..."
                    className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100 resize-none"
                  />
                </div>

                {/* Role */}
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                    บทบาท
                  </label>
                  <select
                    name="role"
                    defaultValue={user.role}
                    className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                  >
                    <option value="member">สมาชิก</option>
                    <option value="staff">เจ้าหน้าที่</option>
                    <option value="admin">ผู้ดูแล</option>
                  </select>
                </div>

                {/* Status */}
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                    สถานะ
                  </label>
                  <select
                    name="status"
                    defaultValue={user.status}
                    className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                  >
                    <option value="active">ใช้งาน</option>
                    <option value="suspended">ระงับ</option>
                  </select>
                </div>

                {/* Borrow limit */}
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                    จำกัดการยืม (เล่ม)
                  </label>
                  <input
                    name="borrow_limit"
                    type="number"
                    min={0}
                    defaultValue={user.borrow_limit}
                    className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                  />
                </div>

                {/* Fine balance (display only) */}
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                    ค่าปรับคงค้าง
                  </label>
                  <div
                    className={`w-full pl-3 pr-3 py-2.5 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md font-medium ${
                      user.fine_balance > 0
                        ? "text-price-red"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {formatMoney(Number(user.fine_balance) || 0)}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    แก้ไขค่าปรับได้ที่หน้าประวัติยืม-คืนเท่านั้น
                  </p>
                </div>

                {/* ข้อมูลเพิ่มเติม — บทบาท/สถานะปัจจุบัน */}
                <div className="md:col-span-6 rounded-lg bg-gray-50 dark:bg-white/5 p-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <p>
                    บทบาทปัจจุบัน:{" "}
                    <span className="font-medium text-forest dark:text-slate-100">
                      {ROLE_LABEL[user.role]}
                    </span>
                  </p>
                  <p>
                    สถานะปัจจุบัน:{" "}
                    <span className="font-medium text-forest dark:text-slate-100">
                      {STATUS_LABEL[activeStatus ?? user.status]}
                    </span>
                  </p>
                </div>
              </div>
            </form>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
              <PhosphorIcon name="user" className="text-5xl mb-3" />
              <p className="text-sm">ไม่พบข้อมูลสมาชิก</p>
            </div>
          )}
          </div>
        </div>

        {/* Footer — ปุ่มบันทึก/ระงับ/ปิด */}
        {user && (
          <div className="p-4 border-t border-gray-100 dark:border-border-base bg-white dark:bg-card-bg shrink-0">
            <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={pending || statusPending}
                className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-border-base transition disabled:opacity-60 order-3 sm:order-1"
              >
                ปิดหน้าต่าง
              </button>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto order-1 sm:order-2">
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  disabled={pending || statusPending}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 font-bold px-4 py-2.5 rounded-md text-sm transition disabled:opacity-60 disabled:cursor-not-allowed ${
                    activeStatus === "active"
                      ? "bg-red-50 dark:bg-red-500/10 text-price-red hover:bg-red-100 dark:hover:bg-red-500/20"
                      : "bg-meb-light text-meb-green hover:bg-meb-light/70"
                  }`}
                >
                  {statusPending ? (
                    <PhosphorIcon name="circle-notch" className="animate-spin" />
                  ) : (
                    <PhosphorIcon
                      name={activeStatus === "active" ? "prohibition" : "power"}
                      weight="bold"
                    />
                  )}
                  {activeStatus === "active" ? "ระงับบัญชี" : "เปิดใช้งานบัญชี"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveClick}
                  disabled={pending || statusPending}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-6 py-2.5 rounded-md text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {pending ? (
                    <PhosphorIcon name="circle-notch" className="animate-spin" />
                  ) : (
                    <PhosphorIcon name="floppy-disk" weight="bold" />
                  )}
                  บันทึกการเปลี่ยนแปลง
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}