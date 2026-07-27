import { PhosphorIcon } from "../../../components/phosphor-icon";
import type { LoanStats } from "../actions";

/**
 * loan-stat-cards — การ์ดสถิติของหน้ายืม-คืน
 * Server component (ไม่มี "use client")
 * โชว์ 4 การ์ด: กำลังยืม, เกินกำหนด, คืนวันนี้, ค่าปรับรวม
 */
type LoanStatCardsProps = {
  stats: LoanStats;
};

export function LoanStatCards({ stats }: LoanStatCardsProps) {
  // การ์ดสถิติ — สไตล์เดียวกับ staff/page.tsx
  const cards = [
    {
      label: "กำลังยืม",
      value: stats.active,
      icon: "book-open",
      color: "bg-meb-light text-meb-green",
    },
    {
      label: "เกินกำหนด",
      value: stats.overdue,
      icon: "warning",
      color: "bg-red-50 text-price-red",
    },
    {
      label: "คืนวันนี้",
      value: stats.returnedToday,
      icon: "check-circle",
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "ค่าปรับรวม",
      value: stats.totalFines,
      icon: "currency-dollar",
      color: "bg-amber-50 text-amber-600",
      isMoney: true,
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
              {c.isMoney
                ? `฿${c.value.toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}`
                : c.value.toLocaleString()}
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