"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/** รายการในตะกร้าพิมพ์บาร์โค้ด */
export type PrintCartItem = {
  barcode: string;
  bookCode: string;
  title: string;
  shelfLocation?: string;
  categoryName?: string;
};

type CartContextValue = {
  items: PrintCartItem[];
  /** เพิ่มรายการเข้าตะกร้า (ถ้ามี barcode ซ้ำจะข้าม) */
  add: (item: PrintCartItem) => { added: boolean };
  /** เพิ่มหลายรายการพร้อมกัน */
  addMany: (items: PrintCartItem[]) => { added: number };
  remove: (barcode: string) => void;
  clear: () => void;
  /** จำนวนรายการทั้งหมด */
  count: number;
  /** เช็คว่า barcode นี้อยู่ในตะกร้าแล้วหรือไม่ */
  has: (barcode: string) => boolean;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);
const STORAGE_KEY = "ant-print-cart";

export function BarcodeCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<PrintCartItem[]>([]);

  // โหลดจาก localStorage ตอน mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  // บันทึกทุกครั้งที่ items เปลี่ยน
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const add = (item: PrintCartItem) => {
    let added = false;
    setItems((prev) => {
      if (prev.some((x) => x.barcode === item.barcode)) return prev;
      added = true;
      return [...prev, item];
    });
    return { added };
  };

  const addMany = (newItems: PrintCartItem[]) => {
    let addedCount = 0;
    setItems((prev) => {
      const existing = new Set(prev.map((x) => x.barcode));
      const filtered = newItems.filter((x) => {
        if (existing.has(x.barcode)) return false;
        addedCount++;
        return true;
      });
      return [...prev, ...filtered];
    });
    return { added: addedCount };
  };

  const remove = (barcode: string) =>
    setItems((prev) => prev.filter((x) => x.barcode !== barcode));

  const clear = () => setItems([]);

  const has = (barcode: string) => items.some((x) => x.barcode === barcode);

  return (
    <CartContext.Provider
      value={{ items, add, addMany, remove, clear, count: items.length, has }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useBarcodeCart() {
  const ctx = useContext(CartContext);
  if (!ctx)
    throw new Error("useBarcodeCart ต้องใช้ภายใน BarcodeCartProvider");
  return ctx;
}