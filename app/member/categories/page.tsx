import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { PhosphorIcon } from "../../components/phosphor-icon";

export const metadata: Metadata = {
  title: "หมวดหมู่หนังสือ",
};

type CategoryRow = {
  id: string;
  name: string;
  color_code: string | null;
};

type BookCountRow = {
  category_id: string;
};

/**
 * หน้าหมวดหมู่หนังสือ — แสดงกริดของการ์ดหมวดหมู่
 * - ดึง book_categories เรียงตาม name ASC
 * - นับจำนวนหนังสือ active ในแต่ละหมวด
 * - คลิกการ์ด → ไปหน้ารายละเอียดหมวด /member/category/[id]
 */
export default async function CategoriesPage() {
  const supabase = await createClient();

  // ดึงหมวดหมู่ทั้งหมด เรียงตามชื่อ ASC
  const { data: categories } = (await supabase
    .from("book_categories")
    .select("id, name, color_code")
    .order("name", { ascending: true })) as { data: CategoryRow[] | null };

  // นับจำนวนหนังสือ active แยกตามหมวด
  const { data: bookCounts } = (await supabase
    .from("books")
    .select("category_id")
    .eq("status", "active")) as { data: BookCountRow[] | null };

  // สร้าง map ของจำนวนหนังสือต่อหมวด
  const countMap = new Map<string, number>();
  for (const row of bookCounts ?? []) {
    if (row.category_id) {
      countMap.set(
        row.category_id,
        (countMap.get(row.category_id) ?? 0) + 1,
      );
    }
  }

  const categoryList = categories ?? [];

  return (
    <div className="space-y-6">
      {/* หัวข้อหน้า */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-forest dark:text-slate-100">
          หมวดหมู่หนังสือ
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          เลือกหมวดหมู่ที่คุณสนใจ
        </p>
      </div>

      {categoryList.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categoryList.map((cat) => {
            const count = countMap.get(cat.id) ?? 0;
            const color = cat.color_code ?? "#60a5fa";
            return (
              <Link
                key={cat.id}
                href={`/member/category/${cat.id}`}
                className="group bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
              >
                {/* หัวการ์ด — gradient สีตาม color_code */}
                <div
                  className="relative h-20 flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${color}33 0%, ${color}66 100%)`,
                  }}
                >
                  <span style={{ color }}>
                    <PhosphorIcon
                      name="books"
                      weight="fill"
                      className="text-3xl drop-shadow-sm"
                    />
                  </span>
                  {/* ป้ายจำนวนเล่ม */}
                  <span className="absolute top-2 right-2 bg-white/90 dark:bg-slate-800/90 text-xs font-bold px-2 py-0.5 rounded-full shadow-sm text-slate-700 dark:text-slate-200">
                    {count} เล่ม
                  </span>
                </div>
                {/* ตัวการ์ด */}
                <div className="p-3 md:p-4">
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 line-clamp-1 group-hover:text-meb-green transition">
                    {cat.name}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {count} เล่ม
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-12 text-center">
          <PhosphorIcon
            name="books"
            weight="fill"
            className="text-5xl text-slate-300 dark:text-slate-600 mb-3"
          />
          <p className="text-sm text-slate-400 dark:text-slate-500">
            ยังไม่มีหมวดหมู่ในระบบ
          </p>
        </div>
      )}
    </div>
  );
}