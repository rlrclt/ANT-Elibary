import Link from "next/link";
import { PhosphorIcon } from "./phosphor-icon";
import { Rating } from "./rating";

export type Book = {
  id: string;
  title: string;
  author: string;
  publisher?: string;
  category?: string;
  coverUrl: string;
  price: number;
  originalPrice?: number; // ถ้ามี = มีส่วนลด
  rating: number;
  reviewCount?: number;
};

type BadgeStyle = "discount" | "ribbon" | "rank" | "none";

type BookCardProps = {
  book: Book;
  badge?: BadgeStyle;
  rank?: number; // ใช้เมื่อ badge="rank"
};

/**
 * Book Card ตาม meb components.md ข้อ 6
 * 3 สไตล์ป้าย (ห้ามผสมในกริดเดียว):
 * - discount: ป้าย % มุมซ้ายบน พื้นแดง
 * - ribbon: ริบบอน "Best Seller" มุมขวาบน
 * - rank: เหรียญอันดับ 1/2/3 มุมซ้ายบน วงกลมลอยนอกการ์ด
 */
export function BookCard({ book, badge = "none", rank }: BookCardProps) {
  const discountPercent =
    book.originalPrice && book.originalPrice > book.price
      ? Math.round(
          ((book.originalPrice - book.price) / book.originalPrice) * 100,
        )
      : 0;

  return (
    <Link
      href={`/books/${book.id}`}
      className="group flex flex-col cursor-pointer"
    >
      {/* ปกหนังสือ */}
      <div className="relative w-full aspect-[2/3] rounded-md overflow-hidden shadow-sm border border-gray-200 mb-2 bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={book.coverUrl}
          alt={book.title}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
        />

        {/* Badge: ป้าย % ส่วนลด มุมซ้ายบน */}
        {badge === "discount" && discountPercent > 0 && (
          <span className="absolute top-0 left-0 bg-price-red text-white text-xs font-bold px-2 py-1 rounded-br-md shadow">
            -{discountPercent}%
          </span>
        )}

        {/* Badge: ริบบอน "Best Seller" มุมขวาบน */}
        {badge === "ribbon" && (
          <div className="absolute top-0 right-0 bg-ribbon-red text-white text-[10px] font-bold px-2 py-1 rounded-bl-md shadow">
            <PhosphorIcon
              name="trophy"
              weight="fill"
              className="inline text-[10px] mr-0.5"
            />
            ขายดี
          </div>
        )}

        {/* Badge: เหรียญอันดับ มุมซ้ายบน ลอยนอกการ์ด */}
        {badge === "rank" && rank !== undefined && (
          <span
            className={`absolute -top-2 -left-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md border-2 border-white ${rankBadgeClass(
              rank,
            )}`}
          >
            {rank}
          </span>
        )}
      </div>

      {/* ชื่อหนังสือ */}
      <h3 className="text-sm font-bold line-clamp-2 mb-1 group-hover:text-meb-green transition leading-snug">
        {book.title}
      </h3>

      {/* ผู้แต่ง */}
      <p className="text-xs text-slate-500 line-clamp-1">{book.author}</p>

      {/* สำนักพิมพ์ / หมวดหมู่ */}
      {book.publisher && (
        <p className="text-[10px] text-slate-400 mb-2">{book.publisher}</p>
      )}

      {/* ดาว + ราคา */}
      <div className="mt-auto flex items-end justify-between gap-2 pt-1">
        <Rating rating={book.rating} count={book.reviewCount} />
        <div className="flex flex-col items-end leading-tight">
          {book.originalPrice && book.originalPrice > book.price && (
            <span className="text-[10px] line-through text-slate-400">
              ฿{book.originalPrice.toLocaleString()}
            </span>
          )}
          <span className="text-sm font-bold text-meb-green">
            ฿{book.price.toLocaleString()}
          </span>
        </div>
      </div>
    </Link>
  );
}

/** สีเหรียญอันดับตาม design-tokens.md */
function rankBadgeClass(rank: number): string {
  if (rank === 1) return "bg-gradient-to-b from-yellow-400 to-amber-500";
  if (rank === 2) return "bg-gradient-to-b from-gray-200 to-gray-500";
  if (rank === 3) return "bg-gradient-to-b from-orange-200 to-orange-400";
  return "bg-slate-800";
}