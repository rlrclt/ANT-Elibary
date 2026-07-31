"use client";

import Link from "next/link";
import { useBarcodeCart } from "./barcode-cart-context";
import { PhosphorIcon } from "../../../components/phosphor-icon";

/**
 * PrintCartButton — floating button มุมขวาล่าง แสดงจำนวนในตะกร้าพิมพ์
 * คล้ายตะกร้าสินค้า — คลิกไปหน้า /staff/books/print
 */
export function PrintCartButton() {
  const { count } = useBarcodeCart();

  if (count === 0) return null;

  return (
    <Link
      href="/staff/books/print"
      className="fixed bottom-6 right-6 z-50 btn-cta flex items-center gap-2 bg-terracotta hover:bg-terracotta-hover text-white font-bold px-5 py-3.5 rounded-full shadow-lg"
    >
      <PhosphorIcon name="printer" weight="fill" className="text-xl" />
      <span>ตะกร้าพิมพ์</span>
      <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 bg-white text-terracotta text-xs font-bold rounded-full">
        {count}
      </span>
    </Link>
  );
}