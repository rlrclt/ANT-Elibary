import { PhosphorIcon } from "../../../components/phosphor-icon";
import type { UserStats } from "../actions";

/**
 * member-stat-cards — การ์ดสถิติสมาชิก
 * Server component (ไม่มี "use client")
 * โชว์ 4 การ์ด: สมาชิกทั้งหมด, สมาชิกทั่วไป, เจ้าหน้าที่, ระงับบัญชี
 */
type MemberStatCardsProps = {
  stats: UserStats;
};

export function MemberStatCards({ stats }: MemberStatCardsProps) {
  // การ์ดสถิติ — สไตล์เดียวกับ staff/page.tsx
  const cards = [
    {
      label: "สมาชิกทั้งหมด",
      value: stats.total,
      icon: "users",
      color: "bg-meb-light text-meb-green",
    },
    {
      label: "สมาชิกทั่วไป",
      value: stats.members,
      icon: "user",
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "เจ้าหน้าที่",
      value: stats.staff,
      icon: "shield-check",
      color: "bg-amber-50 text-amber-600",
    },
    {
      label: "ระงับบัญชี",
      value: stats.suspended,
      icon: "prohibition",
      color: "bg-red-50 text-price-red",
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
            <p className="text-xl sm:text-2xl font-bold text-forest dark:text-slate-100 leading-none">
              {c.value.toLocaleString()}
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