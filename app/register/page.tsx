"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Header } from "../components/header";
import { AuthLayout } from "../components/auth-layout";
import { SimpleFooter } from "../components/simple-footer";
import { PhosphorIcon } from "../components/phosphor-icon";
import { TextField, SubmitButton, SelectField } from "../components/form-controls";
import { useRegisterClient } from "../hooks/use-register-client";
import { createClient } from "@/utils/supabase/client";
import type { ThailandAddressValue } from "react-thailand-address-typeahead";
import dynamic from "next/dynamic";

const AddressAutocomplete = dynamic(
  () => import("./address-autocomplete"),
  { ssr: false }
);

export default function RegisterPage() {
  const { error, pending, submit } = useRegisterClient();
  const supabase = createClient();

  const [userType, setUserType] = useState<"student" | "teacher" | "staff" | "external">("student");

  // Dropdown lists fetched from database
  const [departments, setDepartments] = useState<{ value: string; label: string }[]>([]);
  const [classLevels, setClassLevels] = useState<{ value: string; label: string }[]>([]);
  const [roomLevels, setRoomLevels] = useState<{ value: string; label: string }[]>([]);
  const [classGroups, setClassGroups] = useState<{ value: string; label: string; department_id: string; class_level_id: string }[]>([]);

  // Selected filters for students to auto-load class groups
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [selectedClassLevelId, setSelectedClassLevelId] = useState("");

  // Address autocomplete value for external users
  const [addressVal, setAddressVal] = useState<ThailandAddressValue>({});

  useEffect(() => {
    async function fetchDropdownOptions() {
      try {
        const [deptRes, classRes, roomRes, groupRes] = await Promise.all([
          supabase.from("dropdown_departments").select("id, name").eq("is_active", true).order("sort_order").order("name"),
          supabase.from("dropdown_class_levels").select("id, name").eq("is_active", true).order("sort_order").order("name"),
          supabase.from("dropdown_room_levels").select("id, name").eq("is_active", true).order("sort_order").order("name"),
          supabase.from("dropdown_class_groups").select("id, code, department_id, class_level_id, academic_year").eq("is_active", true).order("sort_order").order("code"),
        ]);

        if (deptRes.data) {
          setDepartments(deptRes.data.map((d: any) => ({ value: d.id, label: d.name })));
          if (deptRes.data.length > 0) setSelectedDeptId(deptRes.data[0].id);
        }
        if (classRes.data) {
          setClassLevels(classRes.data.map((c: any) => ({ value: c.id, label: c.name })));
          if (classRes.data.length > 0) setSelectedClassLevelId(classRes.data[0].id);
        }
        if (roomRes.data) {
          setRoomLevels(roomRes.data.map((r: any) => ({ value: r.id, label: r.name })));
        }
        if (groupRes.data) {
          setClassGroups(groupRes.data.map((g: any) => ({
            value: g.id,
            label: g.academic_year ? `${g.code} (ปีการศึกษา ${g.academic_year})` : g.code,
            department_id: g.department_id,
            class_level_id: g.class_level_id,
          })));
        }
      } catch (err) {
        console.error("Failed to fetch registration dropdown items:", err);
      }
    }

    fetchDropdownOptions();
  }, []);

  const filteredClassGroupsForRegister = classGroups.filter(
    (cg) => cg.department_id === selectedDeptId && cg.class_level_id === selectedClassLevelId
  );

  return (
    <>
      <Header />
      <AuthLayout
        variant="register"
        title="สมัครสมาชิก"
        subtitle="ฟรีสำหรับนักศึกษาและบุคลากร วิทยาลัยเทคนิคอำนาจเจริญ"
        alternateHref="/login"
        alternateLabel="เข้าสู่ระบบ"
        alternatePrompt="มีบัญชีอยู่แล้ว?"
      >
        <form action={submit} className="space-y-1">
          {/* Error message */}
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-center gap-2 bg-price-red/10 border border-price-red/30 text-price-red text-sm px-3 py-2.5 rounded-md"
            >
              <PhosphorIcon name="warning-circle" weight="fill" />
              {error}
            </div>
          )}

          <TextField
            label="ชื่อ-สกุล"
            name="full_name"
            placeholder="เช่น สมชาย ใจดี"
            autoComplete="name"
            required
            icon="user"
          />

          <TextField
            label="อีเมล"
            name="email"
            type="email"
            placeholder="you@acat.ac.th"
            autoComplete="email"
            required
            icon="envelope-simple"
            helper="แนะนำให้ใช้อีเมลสถาบัน (@acat.ac.th)"
          />

          <TextField
            label="เบอร์โทรศัพท์"
            name="phone"
            type="tel"
            placeholder="0812345678"
            autoComplete="tel"
            icon="phone"
            helper="ใช้สำหรับติดต่อเรื่องการยืม-คืน (ไม่บังคับ)"
          />

          {/* ประเภทผู้ใช้งาน */}
          <SelectField
            label="ประเภทผู้ใช้งาน"
            name="user_type"
            required
            value={userType}
            onChange={(e) => setUserType(e.target.value as any)}
            options={[
              { value: "student", label: "นักเรียน/นักศึกษา (Student)" },
              { value: "teacher", label: "อาจารย์ (Teacher)" },
              { value: "staff", label: "เจ้าหน้าที่ (Staff)" },
              { value: "external", label: "บุคคลภายนอก (External)" },
            ]}
            icon="identification-card"
          />

          {/* Conditional Input Fields */}
          {userType === "student" && (
            <div className="bg-slate-50 p-4 rounded-md border border-slate-100 mb-4 space-y-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ข้อมูลการศึกษา</h3>
              
              <TextField
                label="รหัสนักศึกษา"
                name="user_id_code"
                placeholder="รหัสนักศึกษา 12 หลักขึ้นไป"
                required
                icon="cardholder"
              />

              <SelectField
                label="แผนกวิชา"
                name="department_id"
                required
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                options={departments}
                icon="tree-structure"
              />

              <div className="grid grid-cols-2 gap-4">
                <SelectField
                  label="ระดับชั้น"
                  name="class_level_id"
                  required
                  value={selectedClassLevelId}
                  onChange={(e) => setSelectedClassLevelId(e.target.value)}
                  options={classLevels}
                  icon="graduation-cap"
                />

                <SelectField
                  label="กลุ่มเรียน/ห้องเรียน"
                  name="room_level_id"
                  required
                  options={roomLevels}
                  icon="users"
                />
              </div>

              <SelectField
                label="รหัสกลุ่มเรียน"
                name="class_group_id"
                required
                options={filteredClassGroupsForRegister}
                icon="users"
                helper={
                  filteredClassGroupsForRegister.length === 0
                    ? "❌ ไม่พบรหัสกลุ่มเรียนในแผนกวิชาและระดับชั้นนี้"
                    : "เลือกรหัสกลุ่มเรียนของท่าน"
                }
              />
            </div>
          )}

          {(userType === "teacher" || userType === "staff") && (
            <div className="bg-slate-50 p-4 rounded-md border border-slate-100 mb-4 space-y-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ข้อมูลบุคลากร</h3>
              
              <TextField
                label="รหัสประจำตัวบุคลากร"
                name="user_id_code"
                placeholder="รหัสประจำตัวบุคลากร"
                required
                icon="cardholder"
              />

              <SelectField
                label="แผนกวิชา"
                name="department_id"
                required
                options={departments}
                icon="tree-structure"
              />
            </div>
          )}

          {userType === "external" && (
            <div className="bg-slate-50 p-4 rounded-md border border-slate-100 mb-4 space-y-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ข้อมูลบุคคลภายนอก</h3>
              
              <TextField
                label="เลขบัตรประจำตัวประชาชน"
                name="user_id_code"
                placeholder="เลขบัตรประจำตัวประชาชน 13 หลัก"
                required
                icon="cardholder"
              />

              <div className="space-y-4">
                <TextField
                  label="ที่อยู่ (บ้านเลขที่, หมู่บ้าน, ถนน/ซอย)"
                  name="address_details"
                  placeholder="เช่น 123/4 หมู่ 5 ถนนหลัก"
                  required
                  icon="map-pin"
                />
                
                <AddressAutocomplete
                  value={addressVal}
                  onValueChange={(val) => setAddressVal(val)}
                />
              </div>
            </div>
          )}

          <TextField
            label="รหัสผ่าน"
            name="password"
            type="password"
            placeholder="อย่างน้อย 8 ตัวอักษร"
            autoComplete="new-password"
            required
            icon="lock"
            helper="ใช้ตัวอักษร ตัวเลข และสัญลักษณ์ผสมกันเพื่อความปลอดภัย"
          />

          <TextField
            label="ยืนยันรหัสผ่าน"
            name="confirmPassword"
            type="password"
            placeholder="พิมพ์รหัสผ่านอีกครั้ง"
            autoComplete="new-password"
            required
            icon="lock"
          />

          {/* เงื่อนไข — ตามกฎหน้า transactional ต้องโชว์ก่อน CTA */}
          <label className="flex items-start gap-2 text-sm text-slate-600 cursor-pointer select-none my-5">
            <input
              type="checkbox"
              name="agree"
              required
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-meb-green focus:ring-meb-light"
            />
            <span>
              ฉันยอมรับ{" "}
              <Link
                href="/terms"
                className="text-meb-green hover:text-meb-hover hover:underline"
              >
                ข้อกำหนดการใช้งาน
              </Link>{" "}
              และ{" "}
              <Link
                href="/privacy"
                className="text-meb-green hover:text-meb-hover hover:underline"
              >
                นโยบายความเป็นส่วนตัว
              </Link>
            </span>
          </label>

          {/* role ส่งเป็น hidden — สมัครจากหน้านี้เป็น member เสมอ */}
          <input type="hidden" name="role" value="member" />

          <SubmitButton loading={pending}>
            สมัครสมาชิก
            <PhosphorIcon name="arrow-right" />
          </SubmitButton>
        </form>
      </AuthLayout>
      <SimpleFooter />
    </>
  );
}