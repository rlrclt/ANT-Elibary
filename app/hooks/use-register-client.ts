"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

/**
 * ใช้ signUp ฝั่ง client (ไม่ใช่ server action)
 * เพราะ PKCE flow ต้องเก็บ code_verifier ใน browser cookie
 * ถ้า signUp ใน server action → verifier ไม่อยู่ใน browser → callback ค้าง
 */
export function useRegisterClient() {
  const supabase = createClient();
  const router = useRouter();
  const [error, setError] = useState<string | undefined>();
  const [info, setInfo] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError(undefined);
    setInfo(undefined);

    const fullName = String(formData.get("full_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    const userType = String(formData.get("user_type") ?? "student").trim();
    const userIdCode = String(formData.get("user_id_code") ?? "").trim();
    const departmentId = String(formData.get("department_id") ?? "").trim();
    const classLevelId = String(formData.get("class_level_id") ?? "").trim();
    const roomLevelId = String(formData.get("room_level_id") ?? "").trim();
    const classGroupId = String(formData.get("class_group_id") ?? "").trim();
    
    // Address components for external user
    const addressDetails = String(formData.get("address_details") ?? "").trim();
    const subdistrict = String(formData.get("subdistrict") ?? "").trim();
    const district = String(formData.get("district") ?? "").trim();
    const province = String(formData.get("province") ?? "").trim();
    const postalCode = String(formData.get("postal_code") ?? "").trim();

    // Basic core fields validation
    if (!fullName || !email || !password) {
      setError("กรุณากรอกข้อมูลให้ครบ");
      setPending(false);
      return;
    }
    if (password.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      setPending(false);
      return;
    }
    if (password !== confirmPassword) {
      setError("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
      setPending(false);
      return;
    }

    // Role split validation
    let address = "";
    if (userType === "student") {
      if (!userIdCode || userIdCode.length < 12) {
        setError("รหัสนักศึกษาต้องมีอย่างน้อย 12 ตัวอักษร");
        setPending(false);
        return;
      }
      if (!departmentId) {
        setError("กรุณาเลือกแผนกวิชา");
        setPending(false);
        return;
      }
      if (!classLevelId) {
        setError("กรุณาเลือกระดับชั้น");
        setPending(false);
        return;
      }
      if (!roomLevelId) {
        setError("กรุณาเลือกกลุ่มเรียน");
        setPending(false);
        return;
      }
      if (!classGroupId) {
        setError("กรุณาเลือกรหัสกลุ่มเรียน");
        setPending(false);
        return;
      }
    } else if (userType === "teacher" || userType === "staff") {
      if (!userIdCode) {
        setError("กรุณากรอกรหัสประจำตัว");
        setPending(false);
        return;
      }
      if (!departmentId) {
        setError("กรุณาเลือกแผนกวิชา");
        setPending(false);
        return;
      }
    } else if (userType === "external") {
      if (!userIdCode || !validateThaiCitizenId(userIdCode)) {
        setError("เลขบัตรประจำตัวประชาชนไม่ถูกต้อง");
        setPending(false);
        return;
      }
      
      // Construct external address string
      if (addressDetails || subdistrict || district || province || postalCode) {
        address = [
          addressDetails,
          subdistrict ? `ต.${subdistrict}` : "",
          district ? `อ.${district}` : "",
          province ? `จ.${province}` : "",
          postalCode
        ].filter(Boolean).join(" ");
      }

      if (!address) {
        setError("กรุณากรอกที่อยู่");
        setPending(false);
        return;
      }
    } else {
      setError("ประเภทผู้ใช้งานไม่ถูกต้อง");
      setPending(false);
      return;
    }

    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: fullName,
          phone: phone || null,
          user_type: userType,
          user_id_code: userIdCode,
          department_id: userType !== "external" ? departmentId : null,
          class_level_id: userType === "student" ? classLevelId : null,
          room_level_id: userType === "student" ? roomLevelId : null,
          class_group_id: userType === "student" ? classGroupId : null,
          address: userType === "external" ? address : null,
        },
      },
    });

    // Debug log — เช็คว่า Supabase ส่งอะไรกลับมา
    console.log("[register] signUp result:", {
      data: result.data,
      error: result.error,
    });

    if (result.error) {
      console.error("[register] signUp error:", result.error);
      setError(translateAuthError(result.error.message));
      setPending(false);
      return;
    }

    // สมัครสำเร็จ → ถ้ามี session ล็อกอินให้อัตโนมัติส่งไป dashboard ถ้าไม่มีส่งไปหน้า login ทันที
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("id", userData.user.id)
          .maybeSingle();

        if (profile?.role === "staff" || profile?.role === "admin") {
          router.push("/staff");
        } else {
          router.push("/member");
        }
        router.refresh();
        return;
      }
    }

    // ถ้าไม่มี session (หรือต้องใช้รหัสผ่านล็อกอินเอง) → ส่งไปหน้า login พร้อมแจ้งสมัครสำเร็จ
    router.push("/login?registered=1");
    router.refresh();
  }

  return { error, info, pending, submit };
}

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("rate limit")) return "ส่งอีเมลบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่";
  if (m.includes("user already registered")) return "อีเมลนี้ถูกใช้สมัครแล้ว";
  if (m.includes("password should be at least"))
    return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
  return msg;
}

function validateThaiCitizenId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(id.charAt(i), 10) * (13 - i);
  }
  const lastDigit = parseInt(id.charAt(12), 10);
  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === lastDigit;
}