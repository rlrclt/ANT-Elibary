"use client";

import JsBarcode from "jsbarcode";
import { useEffect, useRef } from "react";

type BarcodeSvgProps = {
  value: string;
  /** ขนาดเส้นบาร์โค้ด 1-5 (default 2) */
  width?: number;
  /** ความสูง px (default 50) */
  height?: number;
  /** ขนาดฟอนต์ตัวอักษร (default 14) */
  fontSize?: number;
  /** แสดงตัวอักษรใต้บาร์โค้ด (default true) */
  displayValue?: boolean;
  className?: string;
};

/**
 * BarcodeSvg — สร้างบาร์โค้ด Code128 แบบ SVG ผ่าน JsBarcode
 * ใช้ฝั่ง client (useEffect + ref) เพราะ JsBarcode ต้องเข้าถึง DOM
 */
export function BarcodeSvg({
  value,
  width = 2,
  height = 50,
  fontSize = 14,
  displayValue = true,
  className,
}: BarcodeSvgProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        width,
        height,
        fontSize,
        displayValue,
        margin: 4,
        textAlign: "center",
        textMargin: 2,
        font: "Noto Sans Thai, monospace",
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch (err) {
      console.error("[barcode] render error:", err);
    }
  }, [value, width, height, fontSize, displayValue]);

  return <svg ref={svgRef} className={className} role="img" aria-label={`barcode ${value}`} />;
}

/**
 * คำนวณเลขออเดอร์ถัดไปของบาร์โค้ด
 * เช่น มี BK-2026-005-03 อยู่แล้ว → ต่อด้วย -04
 */
export function nextBarcode(bookCode: string, latestSequence: number): string {
  const seq = (latestSequence + 1).toString().padStart(2, "0");
  return `${bookCode}-${seq}`;
}

/**
 * สร้างบาร์โค้ดเล่มลูกหลายตัวพร้อมกัน
 * เช่น bookCode=BK-2026-005, startSeq=0, count=3 → ["BK-2026-005-01","-02","-03"]
 */
export function generateCopyBarcodes(
  bookCode: string,
  startSequence: number,
  count: number,
): string[] {
  return Array.from({ length: count }, (_, i) =>
    nextBarcode(bookCode, startSequence + i),
  );
}