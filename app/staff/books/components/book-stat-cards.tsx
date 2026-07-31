import { PhosphorIcon } from "../../../components/phosphor-icon";

/**
 * book-stat-cards — การ์ดสถิติของหน้าจัดการหนังสือ
 * Server component (ไม่มี "use client")
 * โชว์ 4 การ์ด: จำนวนชื่อเรื่อง, รวมเล่มทั้งหมด, พร้อมยืม, ชำรุด/สูญหาย
 */
type BookStatCardsProps = {
  stats: {
    titles: number;
    totalCopies: number;
    availableCopies: number;
    damagedLost: number;
  };
};

export function BookStatCards({ stats }: BookStatCardsProps) {
  // การ์ดสถิติ — สไตล์เดียวกับ staff/page.tsx
  const cards = [
    {
      label: "จำนวนชื่อเรื่อง",
      value: stats.titles,
      icon: "books",
      color: "bg-meb-light text-meb-green",
    },
    {
      label: "รวมเล่มทั้งหมด",
      value: stats.totalCopies,
      icon: "stack",
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "พร้อมยืม",
      value: stats.availableCopies,
      icon: "check-circle",
      color: "bg-meb-light text-meb-green",
    },
    {
      label: "ชำรุด/สูญหาย",
      value: stats.damagedLost,
      icon: "warning",
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