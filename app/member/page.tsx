import { createClient } from "@/utils/supabase/server";
import { BannerCarousel, type BannerSlide } from "./components/banner-carousel";
import { SectionWrapper } from "./components/section-wrapper";
import {
  MemberBookCard,
  type MemberBook,
} from "./components/member-book-card";
import { PhosphorIcon } from "../components/phosphor-icon";

/** สร้าง URL รูป placeholder สำรองเมื่อหนังสือไม่มี cover_image_url */
function fallbackCover(title: string) {
  return `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    `book cover ${title} thai textbook technical college`,
  )}&image_size=portrait_4_3`;
}

/** แปลงข้อมูลหนังสือจาก DB → MemberBook (พร้อม rating) */
function toMemberBook(
  b: any,
  ratingMap: Map<string, { avg: number; count: number }>,
  favSet: Set<string>,
): MemberBook {
  const rating = ratingMap.get(b.id);
  return {
    id: b.id,
    title: b.title,
    author: b.author ?? "ไม่ระบุผู้แต่ง",
    coverUrl: b.cover_image_url || fallbackCover(b.title),
    price: 0,
    rating: rating?.avg ?? 0,
    reviewCount: rating?.count ?? 0,
    isFree: true,
    isFavorited: favSet.has(b.id),
  };
}

/**
 * หน้าหลักสมาชิก (member home)
 * แสดงหนังสือแยกตามหมวดหมู่ — แต่ละหมวดดึงหนังสือ 5 เล่มแรก
 * พร้อม rating เฉลี่ย + สถานะรายการโปรด
 */
export default async function MemberPage() {
  const supabase = await createClient();

  // ดึง user id (ถ้า login แล้ว) เพื่อเช็ครายการโปรด
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ดึงหมวดหมู่ทั้งหมด เรียงตามชื่อ ASC
  const { data: categories } = await supabase
    .from("book_categories")
    .select("id, name, color_code")
    .order("name", { ascending: true });

  // ดึงหนังสือ active ทั้งหมด (พร้อม category_id)
  const { data: allBooks } = await supabase
    .from("books")
    .select("id, title, author, cover_image_url, category_id")
    .eq("status", "active")
    .order("title", { ascending: true });

  // ดึง rating เฉลี่ยของหนังสือทั้งหมด (group by book_id)
  // ใช้ try-catch เพื่อป้องกัน error ถ้า table ยังไม่ถูกสร้าง (migration 005 ยังไม่ได้รัน)
  const bookIds = (allBooks ?? []).map((b) => (b as any).id);
  let ratingMap = new Map<string, { avg: number; count: number }>();
  if (bookIds.length > 0) {
    try {
      const { data: ratings, error: ratingErr } = await supabase
        .from("book_ratings")
        .select("book_id, rating")
        .in("book_id", bookIds);
      if (!ratingErr && ratings) {
        for (const r of ratings) {
          const row = r as { book_id: string; rating: number };
          const existing = ratingMap.get(row.book_id) ?? { avg: 0, count: 0 };
          existing.avg = (existing.avg * existing.count + row.rating) / (existing.count + 1);
          existing.count += 1;
          ratingMap.set(row.book_id, existing);
        }
      }
    } catch {
      // table ไม่มี → ข้ามไป
    }
  }

  // ดึงรายการโปรดของ user (ถ้า login)
  // ใช้ try-catch เพื่อป้องกัน error ถ้า table ยังไม่ถูกสร้าง
  let favSet = new Set<string>();
  if (user) {
    try {
      const { data: favs, error: favErr } = await supabase
        .from("book_favorites")
        .select("book_id")
        .eq("user_id", user.id);
      if (!favErr && favs) {
        for (const f of favs) {
          favSet.add((f as any).book_id);
        }
      }
    } catch {
      // table ไม่มี → ข้ามไป
    }
  }

  // ดึง banners ที่ active จาก DB
  const { data: bannersData } = await supabase
    .from("banners")
    .select("id, badge, headline, subtitle, image_url, action_url, action_label")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const bannerSlides: BannerSlide[] = (bannersData ?? []).map((b: any) => ({
    id: b.id,
    badge: b.badge ?? "",
    headline: b.headline,
    subtitle: b.subtitle ?? "",
    imageUrl: b.image_url ?? undefined,
    actionUrl: b.action_url ?? undefined,
    actionLabel: b.action_label ?? undefined,
  }));

  // group หนังสือตาม category_id — แต่ละหมวดเก็บแค่ 5 เล่มแรก
  const booksByCategory = new Map<string, MemberBook[]>();
  for (const book of allBooks ?? []) {
    const cid = (book as any).category_id as string | null;
    if (!cid) continue;
    const list = booksByCategory.get(cid) ?? [];
    if (list.length < 5) {
      list.push(toMemberBook(book, ratingMap, favSet));
    }
    booksByCategory.set(cid, list);
  }

  return (
    <>
      {/* แบนเนอร์ carousel */}
      <BannerCarousel slides={bannerSlides} />

      {/* แสดงหนังสือแยกตามหมวดหมู่ */}
      {(categories ?? []).map((cat) => {
        const books = booksByCategory.get(cat.id) ?? [];
        if (books.length === 0) return null;

        return (
          <SectionWrapper
            key={cat.id}
            title={cat.name}
            href={`/member/category/${cat.id}`}
            accent="bar"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-5">
              {books.map((book) => (
                <MemberBookCard key={book.id} book={book} badge="none" />
              ))}
            </div>
          </SectionWrapper>
        );
      })}

      {/* ถ้าไม่มีหนังสือเลย */}
      {categories && categories.length === 0 && (
        <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-12 text-center">
          <PhosphorIcon
            name="books"
            weight="fill"
            className="text-4xl text-slate-300 dark:text-slate-600 mx-auto mb-3"
          />
          <p className="text-sm text-slate-400 dark:text-slate-500">
            ยังไม่มีหนังสือในระบบ
          </p>
        </section>
      )}
    </>
  );
}