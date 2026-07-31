import { useState, useEffect, useTransition } from "react";
import { Modal } from "../../../components/modal";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import { createMemberAction } from "../actions";
import type { DropdownOption } from "@/app/staff/settings/dropdowns/actions";

type CreateMemberModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  departments: DropdownOption[];
  classLevels: DropdownOption[];
  roomLevels: DropdownOption[];
  classGroups: DropdownOption[];
};

export function CreateMemberModal({
  open,
  onClose,
  onSuccess,
  departments,
  classLevels,
  roomLevels,
  classGroups,
}: CreateMemberModalProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [userType, setUserType] = useState<"student" | "teacher" | "staff" | "external">("student");
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [selectedClassLevelId, setSelectedClassLevelId] = useState("");
  const [selectedRoomLevelId, setSelectedRoomLevelId] = useState("");
  const [selectedClassGroupId, setSelectedClassGroupId] = useState("");

  useEffect(() => {
    if (departments.length > 0 && !selectedDeptId) {
      setSelectedDeptId(departments[0].id);
    }
  }, [departments, selectedDeptId]);

  useEffect(() => {
    if (classLevels.length > 0 && !selectedClassLevelId) {
      setSelectedClassLevelId(classLevels[0].id);
    }
  }, [classLevels, selectedClassLevelId]);

  useEffect(() => {
    if (roomLevels.length > 0 && !selectedRoomLevelId) {
      setSelectedRoomLevelId(roomLevels[0].id);
    }
  }, [roomLevels, selectedRoomLevelId]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setError("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    startTransition(async () => {
      const res = await createMemberAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 1500);
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="สร้างบัญชีสมาชิกใหม่"
      description="เพิ่มบัญชีผู้ใช้งานใหม่เข้าสู่ระบบห้องสมุดดิจิทัล"
      size="xl"
    >
      {success ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-meb-light text-meb-green rounded-full flex items-center justify-center text-3xl mb-4 animate-bounce">
            <PhosphorIcon name="check-circle" weight="fill" />
          </div>
          <h3 className="text-lg font-bold text-forest dark:text-slate-100 mb-1">
            สร้างบัญชีสมาชิกสำเร็จ!
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ระบบได้ลงทะเบียนบัญชีใหม่เข้าสู่ฐานข้อมูลเรียบร้อยแล้ว
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3.5 rounded-lg text-sm bg-red-50 dark:bg-red-500/10 text-price-red">
              <PhosphorIcon name="warning" weight="fill" className="text-lg" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Full name */}
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                ชื่อ-สกุล <span className="text-terracotta">*</span>
              </label>
              <input
                name="full_name"
                type="text"
                required
                placeholder="สมชาย ใจดี"
                className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              />
            </div>

            {/* Email */}
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                อีเมล (ใช้เข้าสู่ระบบ) <span className="text-terracotta">*</span>
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="somchai@example.com"
                className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              />
            </div>

            {/* Password */}
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                รหัสผ่าน <span className="text-terracotta">*</span>
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  className="w-full pl-3 pr-10 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer"
                >
                  <PhosphorIcon name={showPassword ? "eye-slash" : "eye"} className="text-lg" />
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                ยืนยันรหัสผ่าน <span className="text-terracotta">*</span>
              </label>
              <div className="relative">
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  className="w-full pl-3 pr-10 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer"
                >
                  <PhosphorIcon name={showConfirmPassword ? "eye-slash" : "eye"} className="text-lg" />
                </button>
              </div>
            </div>

            {/* Phone */}
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                เบอร์โทรศัพท์
              </label>
              <input
                name="phone"
                type="tel"
                placeholder="08xxxxxxxx"
                className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              />
            </div>

            {/* User ID Code */}
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                รหัสสมาชิก (ไม่ระบุระบบจะสุ่มให้อัตโนมัติ)
              </label>
              <input
                name="user_id_code"
                type="text"
                placeholder="เช่น STD-670101 (ปล่อยว่างเพื่อ Auto-generate)"
                className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              />
            </div>

            {/* User Type */}
            <div className="md:col-span-6">
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                ประเภทผู้ใช้งาน <span className="text-terracotta">*</span>
              </label>
              <select
                name="user_type"
                value={userType}
                onChange={(e) => setUserType(e.target.value as any)}
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

            {/* Student specific fields */}
            {userType === "student" && (
              <>
                {/* Class Level */}
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
                        <option key={cg.id} value={cg.id}>{cg.name}</option>
                      ))}
                  </select>
                </div>

                {/* Class Number */}
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                    เลขที่
                  </label>
                  <input
                    name="class_number"
                    type="text"
                    placeholder="เช่น 15"
                    className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                  />
                </div>
              </>
            )}

            {/* Avatar URL */}
            <div className="md:col-span-6">
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                URL รูปประจำตัว (Avatar URL)
              </label>
              <input
                name="avatar_url"
                type="text"
                placeholder="https://images.unsplash.com/..."
                className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              />
            </div>

            {/* Address */}
            <div className="md:col-span-6">
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                ที่อยู่ติดต่อ
              </label>
              <textarea
                name="address"
                rows={2}
                placeholder="กรอกที่อยู่..."
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
                defaultValue="member"
                className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              >
                <option value="member">สมาชิก (ผู้ยืม)</option>
                <option value="staff">เจ้าหน้าที่</option>
                <option value="admin">ผู้ดูแล (Admin)</option>
              </select>
            </div>

            {/* Borrow Limit */}
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                สิทธิ์จำกัดการยืม (เล่ม)
              </label>
              <input
                name="borrow_limit"
                type="number"
                min={0}
                defaultValue="5"
                className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-border-base shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-border-base transition disabled:opacity-60"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-6 py-2.5 rounded-md text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {pending ? (
                <PhosphorIcon name="circle-notch" className="animate-spin" />
              ) : (
                <PhosphorIcon name="plus" weight="bold" />
              )}
              สร้างบัญชีสมาชิก
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
