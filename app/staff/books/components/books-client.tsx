"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import {
  getBooksAction,
  type BookWithCategory,
  type Category,
} from "../actions";
import { BookStatCards } from "./book-stat-cards";
import { BookTable } from "./book-table";
import { RegisterBookModal } from "./register-book-modal";
import { AddCopyByIsbnModal } from "./add-copy-by-isbn-modal";
import { BookCopiesDrawer } from "./book-copies-drawer";
import { CategoryManagerModal } from "./category-manager-modal";
import { PrintCartButton } from "./print-cart-button";

type Stats = {
  titles: number;
  totalCopies: number;
  availableCopies: number;
  damagedLost: number;
};

type BooksClientProps = {
  initialBooks: BookWithCategory[];
  initialStats: Stats;
  categories: Category[];
};

/**
 * BooksClient — client-side controller สำหรับ /staff/books
 * จัดการ state: search/filter, modals, drawer, refresh ข้อมูล
 */
export function BooksClient({
  initialBooks,
  initialStats,
  categories,
}: BooksClientProps) {
  const [books, setBooks] = useState(initialBooks);
  const [stats, setStats] = useState(initialStats);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available" | "out">(
    "all",
  );
  const [pending, startTransition] = useTransition();

  // modals
  const [registerOpen, setRegisterOpen] = useState(false);
  const [addCopyOpen, setAddCopyOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  // drawer
  const [drawerBook, setDrawerBook] = useState<BookWithCategory | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function handleSearch() {
    startTransition(async () => {
      const result = await getBooksAction({
        search: search || undefined,
        categoryId: categoryFilter !== "all" ? categoryFilter : undefined,
        availability: availabilityFilter,
      });
      if (result.data) setBooks(result.data);
    });
  }

  function handleRowClick(book: BookWithCategory) {
    setDrawerBook(book);
    setDrawerOpen(true);
  }

  return (
    <>
      {/* Header + actions */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2.5">
            <Link
              href="/staff"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-meb-green hover:bg-gray-100 dark:text-slate-400 dark:hover:text-meb-green dark:hover:bg-white/10 transition-all duration-200"
              title="ย้อนกลับไปหน้าเจ้าหน้าที่"
            >
              <PhosphorIcon name="arrow-left" className="text-xl" weight="bold" />
            </Link>
            <PhosphorIcon name="books" weight="fill" className="text-2xl text-meb-green" />
            <h1 className="text-lg md:text-xl font-bold text-forest dark:text-slate-100">
              จัดการหนังสือ
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCategoryOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md border border-gray-200 dark:border-border-base transition"
            >
              <PhosphorIcon name="tag" className="text-base" />
              หมวดหมู่
            </button>
            <button
              onClick={() => setAddCopyOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md border border-gray-200 dark:border-border-base transition"
            >
              <PhosphorIcon name="scan" className="text-base" />
              เพิ่มเล่ม (ISBN)
            </button>
            <Link
              href="/staff/books/print"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md border border-gray-200 dark:border-border-base transition"
            >
              <PhosphorIcon name="printer" className="text-base" />
              พิมพ์บาร์โค้ด
            </Link>
            <Link
              href="/staff/books/history"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md border border-gray-200 dark:border-border-base transition"
            >
              <PhosphorIcon name="chart-pie-slice" className="text-base" />
              รายงานยืม-คืน
            </Link>
            <button
              onClick={() => setRegisterOpen(true)}
              className="btn-cta inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-meb-green hover:bg-meb-hover rounded-md shadow-sm"
            >
              <PhosphorIcon name="plus" weight="bold" />
              ลงทะเบียนใหม่
            </button>
          </div>
        </div>

        {/* Search + filter toolbar */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <PhosphorIcon
              name="magnifying-glass"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="ค้นหา ชื่อ ผู้แต่ง ISBN รหัส หรือพิกัดชั้นวาง..."
              className="w-full pl-10 pr-3 py-2.5 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light dark:text-slate-100"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              startTransition(async () => {
                const r = await getBooksAction({
                  search: search || undefined,
                  categoryId: e.target.value !== "all" ? e.target.value : undefined,
                  availability: availabilityFilter,
                });
                if (r.data) setBooks(r.data);
              });
            }}
            className="px-3 py-2.5 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100"
          >
            <option value="all">ทุกหมวด</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={availabilityFilter}
            onChange={(e) => {
              const v = e.target.value as "all" | "available" | "out";
              setAvailabilityFilter(v);
              startTransition(async () => {
                const r = await getBooksAction({
                  search: search || undefined,
                  categoryId: categoryFilter !== "all" ? categoryFilter : undefined,
                  availability: v,
                });
                if (r.data) setBooks(r.data);
              });
            }}
            className="px-3 py-2.5 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="available">พร้อมยืม</option>
            <option value="out">หมด</option>
          </select>
          <button
            onClick={handleSearch}
            disabled={pending}
            className="px-4 py-2.5 text-sm font-bold text-white bg-meb-green hover:bg-meb-hover rounded-md disabled:opacity-60 transition"
          >
            ค้นหา
          </button>
        </div>
      </section>

      {/* Stat cards */}
      <BookStatCards stats={stats} />

      {/* Book table */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        <BookTable books={books} onRowClick={handleRowClick} />
      </section>

      {/* Modals */}
      <RegisterBookModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        categories={categories}
      />
      <AddCopyByIsbnModal open={addCopyOpen} onClose={() => setAddCopyOpen(false)} />
      <CategoryManagerModal
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        categories={categories}
      />

      {/* Drawer */}
      <BookCopiesDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        book={drawerBook}
        categories={categories}
      />

      {/* Floating cart button — ลอยมุมขวาล่าง */}
      <PrintCartButton />
    </>
  );
}