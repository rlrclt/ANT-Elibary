"use client";

import { useState, useTransition } from "react";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import { updateLibraryHoursAction, type LibraryHour } from "../actions";

/**
 * library-hours-settings — ตั้งค่าเวลาเปิด-ปิดห้องสมุด รายวัน (7 วัน)
 * แสดงเป็นตาราง: วัน / เวลาเปิด / เวลาปิด / สถานะเปิด-ปิด
 * บันทึกทีละวันด้วย updateLibraryHoursAction (staff/admin)
 */
const DAY_LABELS = [
  { value: 1, label: "จันทร์" },
  { value: 2, label: "อังคาร" },
  { value: 3, label: "พุธ" },
  { value: 4, label: "พฤหัสบดี" },
  { value: 5, label: "ศุกร์" },
  { value: 6, label: "เสาร์" },
  { value: 7, label: "อาทิตย์" },
];

type LibraryHoursSettingsProps = {
  initialHours: LibraryHour[];
};

export function LibraryHoursSettings({ initialHours }: LibraryHoursSettingsProps) {
  const [hours, setHours] = useState<LibraryHour[]>(initialHours);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  function updateRow(dayOfWeek: number, patch: Partial<LibraryHour>) {
    setHours((prev) =>
      prev.map((h) => (h.day_of_week === dayOfWeek ? { ...h, ...patch } : h)),
    );
  }

  /**
   * กรอง input เวลาให้เป็นรูปแบบ 24 ชั่วโมง HH:mm เสมอ
   * - รับเฉพาะตัวเลข + auto ใส่ ":" หลังชั่วโมง
   * - ไม่ให้เกิด AM/PM (บังคับ 00-23 ชม., 00-59 นาที)
   */
  function normalizeHHMM(raw: string): string {
    // ตัดทุกอย่างที่ไม่ใช่ตัวเลขออก
    let digits = raw.replace(/\D/g, "").slice(0, 4);
    if (digits.length === 0) return "";
    // บังคับชั่วโมง 00-23, นาที 00-59
    let hh = digits.slice(0, 2);
    let mm = digits.slice(2, 4);
    if (Number(hh) > 23) hh = "23";
    if (Number(mm) > 59) mm = "59";
    if (digits.length <= 2) return hh;
    return `${hh}:${mm}`;
  }

  function handleSave(dayOfWeek: number) {
    const row = hours.find((h) => h.day_of_week === dayOfWeek);
    if (!row) return;
    // DB คืนค่า TIME เป็น "HH:mm:ss" → ตัดเป็น HH:mm ก่อนตรวจสอบ/ส่ง
    const openTime = row.open_time.slice(0, 5);
    const closeTime = row.close_time.slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(openTime) || !/^\d{2}:\d{2}$/.test(closeTime)) {
      showToast("error", "กรุณากรอกเวลาในรูปแบบ HH:mm (24 ชั่วโมง)");
      return;
    }
    if (row.is_open && closeTime <= openTime) {
      showToast("error", "เวลาปิดต้องอยู่หลังจากเวลาเปิด");
      return;
    }
    setSavingDay(dayOfWeek);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("day_of_week", String(dayOfWeek));
      fd.append("open_time", openTime);
      fd.append("close_time", closeTime);
      fd.append("is_open", row.is_open ? "true" : "false");
      const res = await updateLibraryHoursAction(fd);
      setSavingDay(null);
      if (res.error) {
        showToast("error", res.error);
      } else {
        showToast("success", "บันทึกเวลาเรียบร้อยแล้ว");
      }
    });
  }

  if (hours.length === 0) {
    return (
      <div className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-6 transition-colors">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          ยังไม่มีข้อมูลเวลาเปิด-ปิดห้องสมุด (กรุณารัน migration 023)
        </p>
      </div>
    );
  }

  return (
    <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-base font-bold text-forest dark:text-slate-100 flex items-center gap-2">
          <PhosphorIcon name="clock" weight="fill" className="text-meb-green" />
          เวลาเปิด-ปิดห้องสมุด
        </h2>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          ระบบจะปิด session เองเมื่อพ้นเวลาปิดทำการ
        </p>
      </div>

      {toast && (
        <div
          className={`mb-3 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ${
            toast.type === "success"
              ? "bg-meb-light text-meb-green dark:bg-meb-green/10"
              : "bg-red-50 text-price-red dark:bg-red-500/10"
          }`}
        >
          <PhosphorIcon
            name={toast.type === "success" ? "check-circle" : "warning-circle"}
            weight="fill"
          />
          {toast.msg}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-border-base text-left text-xs text-slate-500 dark:text-slate-400">
              <th className="py-2.5 pr-4 font-semibold">วัน</th>
              <th className="py-2.5 pr-4 font-semibold">เวลาเปิด</th>
              <th className="py-2.5 pr-4 font-semibold">เวลาปิด</th>
              <th className="py-2.5 pr-4 font-semibold text-center">สถานะ</th>
              <th className="py-2.5 font-semibold text-right">บันทึก</th>
            </tr>
          </thead>
          <tbody>
            {DAY_LABELS.map((d) => {
              const row = hours.find((h) => h.day_of_week === d.value);
              if (!row) return null;
              const isSaving = savingDay === d.value && pending;
              return (
                <tr
                  key={d.value}
                  className="border-b border-gray-50 dark:border-border-base/40 last:border-0"
                >
                  <td className="py-2.5 pr-4 font-medium text-forest dark:text-slate-100 whitespace-nowrap">
                    {d.label}
                  </td>
                  <td className="py-2.5 pr-4">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="HH:mm"
                      maxLength={5}
                      value={row.open_time.slice(0, 5)}
                      disabled={!row.is_open || pending}
                      onChange={(e) =>
                        updateRow(d.value, { open_time: normalizeHHMM(e.target.value) })
                      }
                      className="w-20 px-2.5 py-1.5 text-sm font-mono text-center bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green disabled:opacity-40 dark:text-slate-100"
                    />
                  </td>
                  <td className="py-2.5 pr-4">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="HH:mm"
                      maxLength={5}
                      value={row.close_time.slice(0, 5)}
                      disabled={!row.is_open || pending}
                      onChange={(e) =>
                        updateRow(d.value, { close_time: normalizeHHMM(e.target.value) })
                      }
                      className="w-20 px-2.5 py-1.5 text-sm font-mono text-center bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green disabled:opacity-40 dark:text-slate-100"
                    />
                  </td>
                  <td className="py-2.5 pr-4 text-center">
                    <button
                      type="button"
                      onClick={() => updateRow(d.value, { is_open: !row.is_open })}
                      disabled={pending}
                      className={`text-xs px-3 py-1 rounded-full font-bold transition ${
                        row.is_open
                          ? "bg-meb-light text-meb-green border border-meb-green/20"
                          : "bg-gray-100 text-slate-400 border border-gray-200 dark:bg-white/5 dark:border-border-base"
                      }`}
                    >
                      {row.is_open ? "เปิดทำการ" : "ปิดทำการ"}
                    </button>
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleSave(d.value)}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-meb-green hover:bg-meb-hover rounded-md transition disabled:opacity-50"
                    >
                      {isSaving ? (
                        <PhosphorIcon name="circle-notch" className="animate-spin" />
                      ) : (
                        <PhosphorIcon name="floppy-disk" weight="bold" />
                      )}
                      บันทึก
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
