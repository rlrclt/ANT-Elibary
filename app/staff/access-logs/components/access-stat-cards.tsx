import { PhosphorIcon } from "../../../components/phosphor-icon";
import type { AccessStats } from "../actions";

/**
 * access-stat-cards — การ์ดสถิติการเข้าใช้ห้องสมุด
 * Server component (ไม่มี "use client")
 * โชว์ 4 การ์ด: กำลังอยู่ในห้องสมุด, เข้าวันนี้, รวมเดือนนี้, เฉลี่ยระยะเวลา
 */
type AccessStatCardsProps = {
  stats: AccessStats;
};

// ฟอร์แมตระยะเวลา "X ชม. Y นาที"
function formatDuration(min: number): string {
  if (min <= 0) return "0 นาที";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0) return `${h} ชม. ${m} นาที`;
  return `${m} นาที`;
}

export function AccessStatCards({ stats }: AccessStatCardsProps) {
  // การ์ดสถิติ — สไตล์เดียวกับ staff/page.tsx
  const cards = [
    {
      label: "กำลังอยู่ในห้องสมุด",
      value: stats.currentlyIn,
      icon: "door-open",
      color: "bg-meb-light text-meb-green",
    },
    {
      label: "เข้าวันนี้",
      value: stats.todayCount,
      icon: "calendar-check",
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "รวมเดือนนี้",
      value: stats.monthCount,
      icon: "calendar",
      color: "bg-amber-50 text-amber-600",
    },
    {
      label: "เฉลี่ยระยะเวลา",
      value: formatDuration(stats.avgDurationMin),
      icon: "clock",
      color: "bg-purple-50 text-purple-600",
      isText: true,
    },
  ];

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-4 flex items-center gap-3 transition-colors"
        >
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0 ${c.color}`}
          >
            <PhosphorIcon name={c.icon} weight="fill" />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-forest dark:text-slate-100 leading-none truncate">
              {c.isText ? c.value : c.value.toLocaleString()}
            </p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">
              {c.label}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}