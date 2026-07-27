"use client";

import { useState } from "react";
import Link from "next/link";
import { PhosphorIcon } from "../../../components/phosphor-icon";

type CategoryItem = {
  id: string;
  name: string;
  color_code: string;
  bookCount: number;
};

type CategoriesClientProps = {
  categories: CategoryItem[];
};

export function CategoriesClient({ categories }: CategoriesClientProps) {
  const [search, setSearch] = useState("");

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Title section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest dark:text-slate-100 flex items-center gap-2">
            <PhosphorIcon name="grid-four" weight="fill" className="text-meb-green" />
            หมวดหมู่ตำราเรียนทั้งหมด
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ค้นหาและเลือกอ่านหนังสือตามหมวดวิชาและสาขาที่คุณต้องการ
          </p>
        </div>

        {/* Search bar */}
        <div className="relative w-full md:max-w-xs">
          <PhosphorIcon
            name="magnifying-glass"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาหมวดหมู่..."
            className="w-full pl-10 pr-3 py-2 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-lg outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light dark:text-slate-100 transition"
          />
        </div>
      </div>

      {filteredCategories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base text-slate-400">
          <PhosphorIcon name="folder-open" className="text-5xl mb-3" />
          <p className="text-sm">ไม่พบหมวดหมู่ที่ตรงกับการค้นหา</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredCategories.map((c) => {
            const icon = getCategoryIcon(c.name);
            return (
              <Link
                key={c.id}
                href={`/member/categories/${c.id}`}
                className="group relative bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-5 hover:shadow-md transition duration-200 overflow-hidden flex flex-col justify-between"
              >
                {/* Color accent line */}
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: c.color_code || "#60a5fa" }}
                />

                <div className="space-y-4">
                  {/* Icon with colored bg */}
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl transition duration-200"
                    style={{
                      backgroundColor: `${c.color_code || "#60a5fa"}15`,
                      color: c.color_code || "#60a5fa",
                    }}
                  >
                    <PhosphorIcon name={icon} weight="fill" />
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-meb-green transition leading-snug">
                      {c.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {c.bookCount.toLocaleString()} เล่มในระบบ
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-bold text-meb-green mt-5 opacity-0 group-hover:opacity-100 transition duration-200">
                  <span>ดูหนังสือทั้งหมด</span>
                  <PhosphorIcon name="arrow-right" weight="bold" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getCategoryIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("ไฟ") || n.includes("อิเล็ก")) return "lightning";
  if (n.includes("ยนต์") || n.includes("เครื่องกล") || n.includes("เครื่องมือ") || n.includes("เทคนิค")) return "gear";
  if (n.includes("ก่อสร้าง") || n.includes("โยธา") || n.includes("สถาปัตย์")) return "hard-hat";
  if (n.includes("คอม") || n.includes("สารสนเทศ") || n.includes("โปรแกรม") || n.includes("เว็บ") || n.includes("ซอฟต์แวร์")) return "desktop";
  if (n.includes("บัญชี") || n.includes("การเงิน")) return "calculator";
  if (n.includes("ตลาด") || n.includes("ธุรกิจ") || n.includes("พาณิชย์") || n.includes("ค้า")) return "storefront";
  if (n.includes("ศิลป์") || n.includes("ดีไซน์") || n.includes("ออกแบบ") || n.includes("วาด") || n.includes("ภาพ")) return "palette";
  if (n.includes("ภาษา") || n.includes("อังกฤษ") || n.includes("ไทย")) return "translate";
  return "books";
}
