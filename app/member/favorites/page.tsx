import type { Metadata } from "next";
import Link from "next/link";
import { PhosphorIcon } from "../../components/phosphor-icon";
import { FavoritesClient } from "./components/favorites-client";
import { getMyFavoritesAction } from "./actions";

export const metadata: Metadata = {
  title: "รายการโปรด",
};

/**
 * หน้ารายการโปรดของฉัน — /member/favorites
 * - ดึงรายการโปรดของสมาชิกผ่าน getMyFavoritesAction
 * - ส่งให้ <FavoritesClient /> เรนเดอร์กริดหนังสือ + ปุ่มลบ
 * - มี auth guard ฝั่ง layout (member/layout.tsx)
 */
export default async function FavoritesPage() {
  const { data: favorites, error } = await getMyFavoritesAction();

  return (
    <div className="space-y-5">
      {/* Breadcrumbs */}
      <nav
        aria-label="breadcrumb"
        className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap"
      >
        <Link href="/member" className="hover:text-meb-green transition">
          หน้าแรก
        </Link>
        <PhosphorIcon name="caret-right" className="text-[10px] text-slate-400" />
        <span className="text-slate-700 dark:text-slate-200 font-medium">
          รายการโปรด
        </span>
      </nav>

      {/* Header */}
      <div className="p-5 sm:p-6 bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base relative overflow-hidden transition-colors shadow-sm">
        <div className="absolute top-0 left-0 bottom-0 w-2 bg-price-red" />
        <div className="pl-2 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-forest dark:text-slate-100 flex items-center gap-2">
              <PhosphorIcon
                name="heart"
                weight="fill"
                className="text-price-red"
              />
              รายการโปรดของฉัน
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              หนังสือที่คุณบันทึกไว้เพื่ออ่านภายหลัง
            </p>
          </div>

          {/* ป้ายจำนวน */}
          {favorites && favorites.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-price-red/10 text-price-red">
              <PhosphorIcon name="heart" weight="fill" className="text-sm" />
              {favorites.length} เล่ม
            </span>
          )}
        </div>
      </div>

      {/* เนื้อหาหลัก */}
      {error ? (
        <div className="bg-red-50 dark:bg-red-500/10 text-price-red p-4 rounded-lg text-sm">
          {error}
        </div>
      ) : (
        <FavoritesClient initialFavorites={favorites ?? []} />
      )}
    </div>
  );
}