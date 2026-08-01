"use client";

import { PhosphorIcon } from "../../../components/phosphor-icon";
import type { AccessLogWithUser } from "../actions";

/**
 * access-log-table — ตารางประวัติการเข้าใช้ห้องสมุด
 * คอลัมน์: สมาชิก, วัตถุประสงค์, เวลาเข้า, เวลาออก, ระยะเวลา, สถานะ, การจัดการ
 */
type AccessLogTableProps = {
  logs: AccessLogWithUser[];
  onManualCheckOut: (logId: string) => void;
};

// ฟอร์แมตวันที่เวลา dd/MM/yyyy HH:mm
function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = d.getHours().toString().padStart(2, "0");
  const mi = d.getMinutes().toString().padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

// ฟอร์แมตระยะเวลา "X ชม. Y นาที" หรือ "X นาที"
function formatDuration(checkIn: string, checkOut: string): string {
  const inAt = new Date(checkIn).getTime();
  const outAt = new Date(checkOut).getTime();
  const diffMin = Math.round((outAt - inAt) / 60000);
  if (diffMin <= 0) return "0 นาที";
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h > 0) return `${h} ชม. ${m} นาที`;
  return `${m} นาที`;
}

// คำนวณระยะเวลาปัจจุบัน สำหรับ log ที่ยังอยู่ในห้องสมุด
function calcDuration(checkIn: string): string {
  const inAt = new Date(checkIn).getTime();
  const now = Date.now();
  const diffMin = Math.max(0, Math.round((now - inAt) / 60000));
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h > 0) return `${h} ชม. ${m} นาที`;
  return `${m} นาที`;
}

// ดึง 2 ตัวอักษรแรกของชื่อสำหรับ avatar initials
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function AccessLogTable({ logs, onManualCheckOut }: AccessLogTableProps) {
  // กรณีไม่มีรายการ — โชว์ empty state
  if (logs.length === 0) {
    return (
      <div className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-12 transition-colors">
        <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
          <PhosphorIcon name="door" className="text-5xl mb-3" />
          <p className="text-sm">ไม่พบข้อมูล</p>
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
              <th className="px-4 py-3 font-medium">วัตถุประสงค์</th>
              <th className="px-4 py-3 font-medium">เวลาเข้า</th>
              <th className="px-4 py-3 font-medium">เวลาออก</th>
              <th className="px-4 py-3 font-medium">ระยะเวลา</th>
              <th className="px-4 py-3 font-medium text-center">สถานะ</th>
              <th className="px-4 py-3 font-medium text-center">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const isInside = log.check_out_at === null;
              return (
                <tr
                  key={log.id}
                  className="border-b border-gray-50 dark:border-border-base last:border-0 hover:bg-meb-light/50 dark:hover:bg-white/5 transition-colors"
                >
                  {/* สมาชิก */}
                  <td className="px-4 py-3 min-w-[160px]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-meb-light text-meb-green flex items-center justify-center text-xs font-bold shrink-0">
                        {log.user?.full_name ? getInitials(log.user.full_name) : "?"}
                      </div>
                      <div className="min-w-0">
                        {log.user_id === null ? (
                          <p className="font-medium text-slate-400 dark:text-slate-500 truncate">
                            ไม่ระบุตัวตน
                          </p>
                        ) : (
                          <>
                            <p className="font-medium text-forest dark:text-slate-100 truncate">
                              {log.user?.full_name ?? "-"}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {log.user?.user_id_code ?? "-"}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* วัตถุประสงค์ */}
                  <td className="px-4 py-3 min-w-[140px]">
                    <p className="text-slate-600 dark:text-slate-300">{log.purpose}</p>
                    {log.note && (
                      <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        <PhosphorIcon name="warning" className="text-[10px]" />
                        ระบบปิดให้อัตโนมัติ
                      </span>
                    )}
                  </td>

                  {/* เวลาเข้า */}
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {formatDateTime(log.check_in_at)}
                  </td>

                  {/* เวลาออก */}
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {log.check_out_at ? formatDateTime(log.check_out_at) : "—"}
                  </td>

                  {/* ระยะเวลา */}
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {isInside ? calcDuration(log.check_in_at) : formatDuration(log.check_in_at, log.check_out_at!)}
                  </td>

                  {/* สถานะ */}
                  <td className="px-4 py-3 text-center">
                    {isInside ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-meb-light text-meb-green">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-meb-green opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-meb-green" />
                        </span>
                        อยู่ในห้อง
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                        <span className="inline-flex rounded-full h-2 w-2 bg-slate-400" />
                        ออกแล้ว
                      </span>
                    )}
                  </td>

                  {/* การจัดการ */}
                  <td className="px-4 py-3 text-center">
                    {isInside ? (
                      <button
                        onClick={() => onManualCheckOut(log.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-meb-green bg-meb-light hover:bg-meb-green hover:text-white rounded-md border border-meb-green/20 transition"
                      >
                        <PhosphorIcon name="sign-out" className="text-sm" />
                        เช็คเอาท์แทน
                      </button>
                    ) : (
                      <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}