"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import { checkInAction, checkOutAction, type AccessLog } from "../actions";

type ActiveLog = { id: string; check_in_at: string };

type AccessClientProps = {
  initialActiveLog: ActiveLog | null;
  initialHistory: AccessLog[];
};

// ---------- Helper functions ----------

/**
 * ฟอร์แมตวันที่เวลา → "dd/MM/yyyy HH:mm"
 */
function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/**
 * ฟอร์แมตเฉพาะวันที่ → "dd/MM/yyyy"
 */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * ฟอร์แมตเฉพาะเวลา → "HH:mm"
 */
function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const hh = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${min}`;
}

/**
 * ฟอร์แมตระยะเวลา → "X ชม. Y นาที" หรือ "X นาที" (ถ้า < 1 ชม.)
 */
function formatDuration(checkIn: string, checkOut: string): string {
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  const diffMs = Math.max(0, end - start);
  const totalMin = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;

  if (hours > 0) {
    return `${hours} ชม. ${mins} นาที`;
  }
  return `${mins} นาที`;
}

/**
 * คำนวณระยะเวลาปัจจุบันจากเวลาเข้า (สำหรับ active log, อัปเดตสด)
 */
function calcDuration(checkIn: string, now: number): string {
  const start = new Date(checkIn).getTime();
  const diffMs = Math.max(0, now - start);
  const totalMin = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;

  if (hours > 0) {
    return `${hours} ชม. ${mins} นาที`;
  }
  return `${mins} นาที`;
}

/**
 * AccessClient — UI หลักของหน้าเช็คอิน/เช็คเอาท์ห้องสมุด
 * - ถ้าไม่มี active log: แสดงปุ่มเช็คอินใหญ่
 * - ถ้ามี active log: แสดงการ์ด "คุณอยู่ในห้องสมุด" + ปุ่มเช็คเอาท์
 * - ด้านล่าง: ประวัติการเข้าใช้
 */
export function AccessClient({
  initialActiveLog,
  initialHistory,
}: AccessClientProps) {
  const router = useRouter();
  const [activeLog, setActiveLog] = useState<ActiveLog | null>(initialActiveLog);
  const [history, setHistory] = useState<AccessLog[]>(initialHistory);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  // tick สำหรับอัปเดตระยะเวลาสด (ทุก 1 นาที) — เริ่มจาก 0 เพื่อป้องกัน hydration mismatch
  const [now, setNow] = useState(0);

  // ตั้งค่า now หลัง mount (client เท่านั้น) + อัปเดตทุก 60 วินาที
  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // เคลียร์ toast อัตโนมัติหลัง 3 วินาที
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // โหลดข้อมูลใหม่ (หลังเช็คอิน/เช็คเอาท์) ผ่าน server actions
  async function refreshData() {
    const [activeRes, historyRes] = await Promise.all([
      import("../actions").then((m) => m.getMyActiveLogAction()),
      import("../actions").then((m) => m.getMyAccessHistoryAction()),
    ]);
    if (activeRes.data) setActiveLog(activeRes.data);
    else if (!activeRes.error) setActiveLog(null);
    if (historyRes.data) setHistory(historyRes.data);
  }

  // --- จัดการเช็คอิน ---
  async function handleCheckIn() {
    if (isPending) return;
    setToast(null);
    try {
      const res = await checkInAction();
      if (res.error) {
        setToast({ type: "error", message: res.error });
      } else {
        setToast({ type: "success", message: "เช็คอินสำเร็จ" });
        startTransition(() => {
          refreshData();
          router.refresh();
        });
      }
    } catch {
      setToast({ type: "error", message: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    }
  }

  // --- จัดการเช็คเอาท์ ---
  async function handleCheckOut() {
    if (isPending || !activeLog) return;
    setToast(null);
    try {
      const formData = new FormData();
      formData.set("logId", activeLog.id);
      const res = await checkOutAction(formData);
      if (res.error) {
        setToast({ type: "error", message: res.error });
      } else {
        setToast({ type: "success", message: "เช็คเอาท์สำเร็จ" });
        startTransition(() => {
          refreshData();
          router.refresh();
        });
      }
    } catch {
      setToast({ type: "error", message: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    }
  }

  return (
    <div className="space-y-6">
      {/* ====== ส่วนเช็คอิน/เช็คเอาท์ ====== */}
      {!activeLog ? (
        // ไม่มี active log → ปุ่มเช็คอินใหญ่ตรงกลาง
        <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-8 sm:p-12 transition-colors">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-20 h-20 rounded-full bg-meb-light dark:bg-meb-green/15 flex items-center justify-center text-meb-green text-4xl">
              <PhosphorIcon name="door-open" weight="fill" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-forest dark:text-slate-100">
                เช็คอินเข้าห้องสมุด
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                กดเพื่อบันทึกการเข้าใช้
              </p>
            </div>
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={isPending}
              className="mt-2 inline-flex items-center justify-center gap-2.5 bg-meb-green hover:bg-meb-hover text-white font-bold px-8 py-4 rounded-xl text-lg shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <PhosphorIcon name="circle-notch" className="animate-spin text-xl" />
                  กำลังเช็คอิน...
                </>
              ) : (
                <>
                  <PhosphorIcon name="door-open" weight="bold" className="text-xl" />
                  เช็คอินเข้าห้องสมุด
                </>
              )}
            </button>
          </div>
        </section>
      ) : (
        // มี active log → การ์ด "คุณอยู่ในห้องสมุด"
        <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-6 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-3 flex-1">
              {/* หัวการ์ด: จุดเขียวกระพริบ + สถานะ */}
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-meb-green opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-meb-green" />
                </span>
                <h2 className="text-lg font-bold text-forest dark:text-slate-100">
                  คุณอยู่ในห้องสมุด
                </h2>
              </div>

              {/* รายละเอียด */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <PhosphorIcon name="clock" className="text-meb-green" />
                    เวลาเข้า
                  </p>
                  <p className="font-semibold text-forest dark:text-slate-100 mt-0.5">
                    {formatDateTime(activeLog.check_in_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <PhosphorIcon name="timer" className="text-meb-green" />
                    ระยะเวลาที่อยู่
                  </p>
                  <p className="font-semibold text-forest dark:text-slate-100 mt-0.5">
                    {calcDuration(activeLog.check_in_at, now)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <PhosphorIcon name="book-open" className="text-meb-green" />
                    วัตถุประสงค์
                  </p>
                  <p className="font-semibold text-forest dark:text-slate-100 mt-0.5">
                    อ่านหนังสือ
                  </p>
                </div>
              </div>
            </div>

            {/* ปุ่มเช็คเอาท์ */}
            <button
              type="button"
              onClick={handleCheckOut}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-3.5 rounded-xl text-base shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
            >
              {isPending ? (
                <>
                  <PhosphorIcon name="circle-notch" className="animate-spin text-lg" />
                  กำลังเช็คเอาท์...
                </>
              ) : (
                <>
                  <PhosphorIcon name="sign-out" weight="bold" className="text-lg" />
                  เช็คเอาท์
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {/* Toast feedback */}
      {toast && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${
            toast.type === "success"
              ? "bg-meb-light/50 dark:bg-meb-green/10 text-meb-green"
              : "bg-red-50 dark:bg-red-500/10 text-price-red"
          }`}
        >
          <PhosphorIcon
            name={toast.type === "success" ? "check-circle" : "warning-circle"}
            weight="fill"
            className="text-lg shrink-0"
          />
          <span>{toast.message}</span>
        </div>
      )}

      {/* ====== ประวัติการเข้าใช้ ====== */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        {/* หัวข้อ + จำนวน */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-base font-bold text-forest dark:text-slate-100 flex items-center gap-2">
            <PhosphorIcon name="clock-countdown" weight="fill" className="text-meb-green" />
            ประวัติการเข้าใช้
          </h2>
          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-bold text-white bg-meb-green rounded-full">
            {history.length}
          </span>
        </div>

        {history.length === 0 ? (
          // สถานะว่าง
          <div className="flex flex-col items-center text-center py-10 gap-2">
            <div className="w-14 h-14 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-slate-300 dark:text-slate-600 text-2xl">
              <PhosphorIcon name="door" weight="fill" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ยังไม่มีประวัติการเข้าใช้
            </p>
          </div>
        ) : (
          // ตารางประวัติ
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-gray-100 dark:border-border-base">
                  <th className="py-2.5 pr-4 font-semibold">วันที่</th>
                  <th className="py-2.5 pr-4 font-semibold">เวลาเข้า</th>
                  <th className="py-2.5 pr-4 font-semibold">เวลาออก</th>
                  <th className="py-2.5 pr-4 font-semibold">ระยะเวลา</th>
                  <th className="py-2.5 pr-4 font-semibold">วัตถุประสงค์</th>
                </tr>
              </thead>
              <tbody>
                {history.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-gray-50 dark:border-border-base/40 last:border-0"
                  >
                    <td className="py-3 pr-4 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {formatDate(log.check_in_at)}
                    </td>
                    <td className="py-3 pr-4 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {formatTime(log.check_in_at)}
                    </td>
                    <td className="py-3 pr-4 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {log.check_out_at ? (
                        formatTime(log.check_out_at)
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-meb-green font-medium">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-meb-green opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-meb-green" />
                          </span>
                          อยู่ในห้องสมุด
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {log.check_out_at ? (
                        formatDuration(log.check_in_at, log.check_out_at)
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-700 dark:text-slate-200">
                      {log.purpose}
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