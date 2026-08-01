import { createClient } from "@/utils/supabase/server";
import { PLAN_LIMITS } from "@/utils/server-limits";
import { formatBytes, usagePercent } from "@/utils/format-bytes";
import { PhosphorIcon } from "../../components/phosphor-icon";

export const metadata = {
  title: "การใช้งานเซิร์ฟเวอร์",
};

/**
 * หน้าแดชบอร์ดการใช้งานเซิร์ฟเวอร์ (/staff/server)
 * - เรียก RPC function (SECURITY DEFINER) จาก DB เพื่อคำนวณขนาดจริง
 *   (Supabase ไม่มี API ให้ดึงขนาด/โควตาโดยตรง)
 * - โชว์ ใช้/เหลือ เทียบกับโควตา Free plan (DB 500MB / Storage 1GB)
 */
export default async function ServerUsagePage() {
  const supabase = await createClient();

  // เรียก RPC — try-catch เผื่อ function ยังไม่ถูกรัน migration (page ไม่ hang)
  let databaseSize: number | null = null;
  let tableSizes: { table_name: string; size_bytes: number; row_count: number }[] = [];
  let storageUsage: { bucket_name: string; bytes: number; object_count: number }[] = [];
  try {
    const [dbRes, tablesRes, storageRes] = await Promise.all([
      supabase.rpc("fn_get_database_size"),
      supabase.rpc("fn_get_table_sizes"),
      supabase.rpc("fn_get_storage_usage"),
    ]);
    if (!dbRes.error) databaseSize = dbRes.data as number;
    if (!tablesRes.error) tableSizes = (tablesRes.data ?? []) as typeof tableSizes;
    if (!storageRes.error) storageUsage = (storageRes.data ?? []) as typeof storageUsage;
  } catch {
    // ปล่อยค่า default (null / ว่าง) — แสดงข้อความให้รัน migration
  }

  const totalStorageBytes = storageUsage.reduce((sum, b) => sum + Number(b.bytes ?? 0), 0);

  const dbPercent = usagePercent(databaseSize, PLAN_LIMITS.databaseBytes);
  const storagePercent = usagePercent(totalStorageBytes, PLAN_LIMITS.storageBytes);
  const dbOver = (databaseSize ?? 0) > PLAN_LIMITS.databaseBytes;
  const storageOver = totalStorageBytes > PLAN_LIMITS.storageBytes;

  const summaryCards = [
    {
      label: "ฐานข้อมูล",
      used: databaseSize,
      limit: PLAN_LIMITS.databaseBytes,
      percent: dbPercent,
      over: dbOver,
      icon: "database",
      color: "bg-meb-light text-meb-green",
    },
    {
      label: "Storage",
      used: totalStorageBytes,
      limit: PLAN_LIMITS.storageBytes,
      percent: storagePercent,
      over: storageOver,
      icon: "hard-drives",
      color: "bg-blue-50 text-blue-600",
    },
  ];

  return (
    <>
      {/* หัวข้อหน้า */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-meb-light flex items-center justify-center text-meb-green text-xl">
            <PhosphorIcon name="gauge" weight="fill" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-forest dark:text-slate-100">
              การใช้งานเซิร์ฟเวอร์
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              โควตาแผน {PLAN_LIMITS.planName} — ฐานข้อมูล {formatBytes(PLAN_LIMITS.databaseBytes)} • Storage {formatBytes(PLAN_LIMITS.storageBytes)}
            </p>
          </div>
        </div>
      </section>

      {/* การ์ดสรุป ใช้/เหลือ */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {summaryCards.map((c) => (
          <div
            key={c.label}
            className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${c.color}`}>
                  <PhosphorIcon name={c.icon} weight="fill" />
                </div>
                <div>
                  <p className="text-sm font-bold text-forest dark:text-slate-100">{c.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {c.used === null ? "ยังไม่มีข้อมูล" : `${formatBytes(c.used)} / ${formatBytes(c.limit)}`}
                  </p>
                </div>
              </div>
              <span
                className={`text-lg font-bold ${
                  c.over ? "text-price-red" : "text-meb-green"
                }`}
              >
                {c.percent}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  c.over ? "bg-price-red" : "bg-meb-green"
                }`}
                style={{ width: `${Math.max(c.percent, 3)}%` }}
              />
            </div>
            <p className={`mt-2 text-xs ${c.over ? "text-price-red font-medium" : "text-slate-500 dark:text-slate-400"}`}>
              {c.used === null
                ? "ยังไม่ได้รัน migration 027_server_usage.sql"
                : c.over
                  ? `เกินโควตาแล้ว ${formatBytes((c.used ?? 0) - c.limit)}`
                  : `เหลือ ${formatBytes(c.limit - (c.used ?? 0))}`}
            </p>
          </div>
        ))}
      </section>

      {/* ตารางราย bucket ใน storage */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-5 bg-meb-green rounded-full" />
          <h2 className="text-base font-bold text-forest dark:text-slate-100">
            ขนาดไฟล์ใน Storage แยกตาม Bucket
          </h2>
        </div>
        {storageUsage.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ยังไม่มีข้อมูล (รัน migration 027 แล้วลองใหม่)
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-gray-100 dark:border-border-base">
                  <th className="py-2 pr-4 font-semibold">Bucket</th>
                  <th className="py-2 pr-4 font-semibold">ขนาด</th>
                  <th className="py-2 font-semibold">จำนวนไฟล์</th>
                </tr>
              </thead>
              <tbody>
                {storageUsage.map((b) => (
                  <tr
                    key={b.bucket_name}
                    className="border-b border-gray-50 dark:border-white/5 last:border-0"
                  >
                    <td className="py-2.5 pr-4 font-medium text-forest dark:text-slate-200">
                      {b.bucket_name}
                    </td>
                    <td className="py-2.5 pr-4">{formatBytes(b.bytes)}</td>
                    <td className="py-2.5">{Number(b.object_count ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ตารางรายตารางในฐานข้อมูล */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-5 bg-meb-green rounded-full" />
          <h2 className="text-base font-bold text-forest dark:text-slate-100">
            ขนาดตารางในฐานข้อมูล (รวม index)
          </h2>
        </div>
        {tableSizes.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ยังไม่มีข้อมูล (รัน migration 027 แล้วลองใหม่)
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-gray-100 dark:border-border-base">
                  <th className="py-2 pr-4 font-semibold">ตาราง</th>
                  <th className="py-2 pr-4 font-semibold">ขนาด</th>
                  <th className="py-2 font-semibold">จำนวนแถว (โดยประมาณ)</th>
                </tr>
              </thead>
              <tbody>
                {tableSizes.map((t) => (
                  <tr
                    key={t.table_name}
                    className="border-b border-gray-50 dark:border-white/5 last:border-0"
                  >
                    <td className="py-2.5 pr-4 font-medium text-forest dark:text-slate-200">
                      {t.table_name}
                    </td>
                    <td className="py-2.5 pr-4">{formatBytes(t.size_bytes)}</td>
                    <td className="py-2.5">{Number(t.row_count ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
