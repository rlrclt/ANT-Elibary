"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getPrintBooksAction } from "../actions";
import { useBarcodeCart, type PrintCartItem } from "../components/barcode-cart-context";

// ==========================================
// ICONS (Phosphor Icons)
// ==========================================
const Icons = {
  Printer: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" {...props}>
      <path d="M224,96V200a8,8,0,0,1-8,8H192v24a8,8,0,0,1-8,8H72a8,8,0,0,1-8-8V208H40a8,8,0,0,1-8-8V96a8,8,0,0,1,8-8H216A8,8,0,0,1,224,96ZM80,224h96V160H80Zm128-120H48v88H64V152a8,8,0,0,1,8-8H184a8,8,0,0,1,8,8v40h32ZM72,32H184a8,8,0,0,0,0-16H72a8,8,0,0,0,0,16Zm120,80a12,12,0,1,0-12-12A12,12,0,0,0,192,112Z"></path>
    </svg>
  ),
  Books: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" {...props}>
      <path d="M232,48V208a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V48A16,16,0,0,1,40,32H216A16,16,0,0,1,232,48ZM40,208H216V48H40V208Zm136-120H136a8,8,0,0,0,0,16h40a8,8,0,0,0,0-16Zm0,32H136a8,8,0,0,0,0,16h40a8,8,0,0,0,0-16ZM96,72H72A16,16,0,0,0,56,88v64a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V88A16,16,0,0,0,96,72Zm0,80H72V88H96v64Z"></path>
    </svg>
  ),
  Sliders: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" {...props}>
      <path d="M112,112a16,16,0,1,1-16-16A16,16,0,0,1,112,112Zm112,0a16,16,0,1,0-16,16A16,16,0,0,0,224,112ZM168,112a16,16,0,1,0-16,16A16,16,0,0,0,168,112Zm-24-32h80a8,8,0,0,0,0-16H144a8,8,0,0,0,0,16Zm-80,0h24a8,8,0,0,0,0-16H64a8,8,0,0,0,0,16Zm120,96h40a8,8,0,0,0,0-16H184a8,8,0,0,0,0,16ZM40,176H120a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16Z"></path>
    </svg>
  ),
  Plus: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" {...props}>
      <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"></path>
    </svg>
  ),
  Minus: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" {...props}>
      <path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128Z"></path>
    </svg>
  ),
  Trash: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" {...props}>
      <path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"></path>
    </svg>
  ),
  ZoomIn: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" {...props}>
      <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Zm112,0a8,8,0,0,1-8,8H120v24a8,8,0,0,1-16,0V120H80a8,8,0,0,1,0-16h24V80a8,8,0,0,1,16,0v24h24A8,8,0,0,1,152,112Z"></path>
    </svg>
  ),
  ZoomOut: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" {...props}>
      <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Zm112,0a8,8,0,0,1-8,8H80a8,8,0,0,1,0-16h64A8,8,0,0,1,152,112Z"></path>
    </svg>
  ),
};

type BookData = {
  id: string;
  book_code: string;
  title: string;
  author: string;
  category: string;
  isbn: string;
  cover: string;
};

type ChildCopy = {
  id: string;
  barcode: string;
  label: string;
};

// ขนาดกระดาษมาตรฐาน (หน่วย mm)
const PAPER_PRESETS: Record<string, { width: number; height: number; name: string }> = {
  A4: { width: 210, height: 297, name: "A4 (210 x 297 mm)" },
  A5: { width: 148, height: 210, name: "A5 (148 x 210 mm)" },
  Letter: { width: 216, height: 279, name: "Letter (216 x 279 mm)" },
  Custom: { width: 210, height: 297, name: "กำหนดเอง (Custom)" },
};

function PrintBarcodeContent() {
  const searchParams = useSearchParams();
  const paramBookId = searchParams.get("book_id");

  // ตะกร้าสะสมบาร์โค้ดข้ามเล่ม
  const { items: cartItems, add, addMany, remove: removeFromCart, clear: clearCart } = useBarcodeCart();

  const [booksList, setBooksList] = useState<BookData[]>([]);
  const [selectedBook, setSelectedBook] = useState<BookData | null>(null);
  const [childCopies, setChildCopies] = useState<ChildCopy[]>([]);
  const [selectedCopies, setSelectedCopies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // State: เลือก 2 แท็บ (copies = ฉบับย่อยเล่มนี้, queue = คิวสะสมทั้งหมด)
  const [activeTab, setActiveTab] = useState<"copies" | "queue">("copies");

  // State: Zoom Scale (50% - 200%)
  const [zoomScale, setZoomScale] = useState(100);
  const [exporting, setExporting] = useState(false);

  // สั่งแปลงภาพ Canvas เป็น PDF แล้วโหลดลงเครื่อง
  const handleExportPDF = async () => {
    const canvas = canvasRef.current;
    if (!canvas || sortedCartItems.length === 0) return;
    setExporting(true);

    try {
      const { jsPDF } = await import("jspdf");
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [printOptions.paperWidth, printOptions.paperHeight],
      });

      pdf.addImage(imgData, "PNG", 0, 0, printOptions.paperWidth, printOptions.paperHeight);
      pdf.save(`barcodes-${selectedBook?.book_code || "batch"}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("[pdf] export error:", err);
      alert("เกิดข้อผิดพลาดในการสร้างไฟล์ PDF — แนะนำให้สั่ง 'พิมพ์รวม' แล้วเลือกปลายทางเป็น Save as PDF");
    } finally {
      setExporting(false);
    }
  };

  // State: ตัวเลือกการพิมพ์ (Print Options)
  const [printOptions, setPrintOptions] = useState({
    paperPreset: "A4", // ค่าเริ่มต้น A4
    paperWidth: 210, // mm
    paperHeight: 297, // mm
    columns: 3,
    labelWidth: 50, // mm
    labelHeight: 25, // mm
    marginTop: 15, // mm
    marginSide: 10, // mm
    fontSize: 12, // px
  });

  // ระบบจัดกลุ่มและเรียงลำดับบาร์โค้ดฉลาด (Smart Auto-Categorize & Grouping)
  // เรียงตาม: 1. หมวดหมู่ (Category) -> 2. รหัสหนังสือแม่ (BookCode) -> 3. เลขบาร์โค้ด (Barcode)
  const sortedCartItems = React.useMemo(() => {
    return [...cartItems].sort((a, b) => {
      const catA = a.categoryName || "ทั่วไป";
      const catB = b.categoryName || "ทั่วไป";
      const catCompare = catA.localeCompare(catB, "th");
      if (catCompare !== 0) return catCompare;

      const codeCompare = (a.bookCode || "").localeCompare(b.bookCode || "", "th");
      if (codeCompare !== 0) return codeCompare;

      return a.barcode.localeCompare(b.barcode, "th", { numeric: true });
    });
  }, [cartItems]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // โหลดข้อมูลจาก Supabase
  useEffect(() => {
    setLoading(true);
    getPrintBooksAction(paramBookId || undefined).then((res) => {
      setBooksList(res.books);
      const current = res.books.find((b) => b.id === res.selectedBookId) || res.books[0] || null;
      setSelectedBook(current);
      setChildCopies(res.copies);
      setLoading(false);
    });
  }, [paramBookId]);

  // เปลี่ยนหนังสือเมื่อคลิกรูปปก
  const handleSelectBook = async (bookId: string) => {
    setLoading(true);
    const res = await getPrintBooksAction(bookId);
    const current = res.books.find((b) => b.id === bookId) || null;
    setSelectedBook(current);
    setChildCopies(res.copies);
    setLoading(false);
  };

  // เลือก / ไม่เลือก Checkbox เล่มลูก (Auto Sync กับคิวพิมพ์ทันที)
  const toggleSelection = (barcode: string) => {
    if (!selectedBook) return;
    const isInCart = cartItems.some((x) => x.barcode === barcode);

    if (isInCart) {
      removeFromCart(barcode);
    } else {
      add({
        barcode,
        bookCode: selectedBook.book_code,
        title: selectedBook.title,
        categoryName: selectedBook.category,
      });
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedBook) return;
    if (e.target.checked) {
      const newItems: PrintCartItem[] = childCopies.map((c) => ({
        barcode: c.barcode,
        bookCode: selectedBook.book_code,
        title: selectedBook.title,
        categoryName: selectedBook.category,
      }));
      addMany(newItems);
    } else {
      childCopies.forEach((c) => removeFromCart(c.barcode));
    }
  };

  // เปลี่ยนขนาดกระดาษ
  const handlePaperPresetChange = (preset: string) => {
    if (preset === "Custom") {
      setPrintOptions((prev) => ({ ...prev, paperPreset: "Custom" }));
    } else {
      const p = PAPER_PRESETS[preset] || PAPER_PRESETS.A4;
      setPrintOptions((prev) => ({
        ...prev,
        paperPreset: preset,
        paperWidth: p.width,
        paperHeight: p.height,
      }));
    }
  };

  const handleOptionChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setPrintOptions((prev) => ({ ...prev, [name]: Number(value) || value }));
  };

  // Zoom Control handlers
  const zoomIn = () => setZoomScale((z) => Math.min(200, z + 20));
  const zoomOut = () => setZoomScale((z) => Math.max(40, z - 20));
  const resetZoom = () => setZoomScale(100);

  // ==========================================
  // CANVAS DRAWING LOGIC (จำลองกระดาษและการพิมพ์)
  // ==========================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // คำนวณ DPI 96 (MM_TO_PX)
    const DPI = 96;
    const MM_TO_PX = DPI / 25.4;

    // ขนาดกระดาษเป็น Pixel ตามค่าความกว้างxยาวที่เลือก
    const paperWidthPx = printOptions.paperWidth * MM_TO_PX;
    const paperHeightPx = printOptions.paperHeight * MM_TO_PX;

    // ตั้งค่าความละเอียด Canvas (Retina display support)
    const scale = window.devicePixelRatio || 1;
    canvas.width = paperWidthPx * scale;
    canvas.height = paperHeightPx * scale;

    // กำหนด CSS ให้ canvas มีขนาดเท่ากระดาษจริง
    canvas.style.width = `${paperWidthPx}px`;
    canvas.style.height = `${paperHeightPx}px`;

    ctx.scale(scale, scale);

    // เคลียร์พื้นหลังกระดาษให้เป็นสีขาว
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, paperWidthPx, paperHeightPx);

    // วาด Grid หรือ Guide เผื่อให้เห็นขอบกระดาษบางๆ
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, paperWidthPx, paperHeightPx);

    // แปลงค่า Margin เป็น Px
    const marginTopPx = printOptions.marginTop * MM_TO_PX;
    const marginSidePx = printOptions.marginSide * MM_TO_PX;
    const labelWidthPx = printOptions.labelWidth * MM_TO_PX;
    const labelHeightPx = printOptions.labelHeight * MM_TO_PX;

    // คำนวณระยะห่างระหว่างคอลัมน์
    const totalLabelWidth = printOptions.columns * labelWidthPx;
    const availableSpace = paperWidthPx - marginSidePx * 2 - totalLabelWidth;
    const gapX =
      printOptions.columns > 1 ? Math.max(0, availableSpace / (printOptions.columns - 1)) : 0;
    const gapY = 5 * MM_TO_PX; // ระยะห่างแนวตั้ง (mm)

    // เริ่มวาด Barcode ทั้งหมดจากคิวสะสมลงบน Canvas (จัดกลุ่มตามหมวดหมู่และเล่มแม่)
    let col = 0;
    let row = 0;

    sortedCartItems.forEach((item) => {
      const barcode = item.barcode;
      const x = marginSidePx + col * (labelWidthPx + gapX);
      const y = marginTopPx + row * (labelHeightPx + gapY);

      // 1. วาดกรอบ Label (สติกเกอร์)
      ctx.strokeStyle = "#cbd5e1";
      ctx.setLineDash([4, 4]); // เส้นประ
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, labelWidthPx, labelHeightPx);
      ctx.setLineDash([]); // คืนค่าเส้นทึบ

      // 2. จำลองการวาดเส้น Barcode
      ctx.fillStyle = "#000000";
      const barcodeMargin = 10;
      const barcodeWidth = labelWidthPx - barcodeMargin * 2;
      const barcodeHeight = labelHeightPx * 0.5;
      const startX = x + barcodeMargin;
      const startY = y + 10;

      let seed = 0;
      for (let i = 0; i < barcode.length; i++) {
        seed += barcode.charCodeAt(i);
      }

      let currentX = startX;
      while (currentX < startX + barcodeWidth) {
        seed = (seed * 9301 + 49297) % 233280;
        const rand = seed / 233280;

        const lineWidth = rand > 0.5 ? 2 : 4;
        const spacing = rand > 0.5 ? 2 : 5;
        if (currentX + lineWidth <= startX + barcodeWidth) {
          ctx.fillRect(currentX, startY, lineWidth, barcodeHeight);
        }
        currentX += lineWidth + spacing;
      }

      // 3. พิมพ์ตัวอักษร Barcode ด้านล่าง
      ctx.font = `bold ${printOptions.fontSize}px sans-serif`;
      ctx.fillStyle = "#1e293b";
      ctx.textAlign = "center";
      ctx.fillText(barcode, x + labelWidthPx / 2, startY + barcodeHeight + 15);

      // 4. พิมพ์ชื่อวิทยาลัย
      ctx.font = `normal 10px sans-serif`;
      ctx.fillStyle = "#64748b";
      ctx.fillText(
        "วิทยาลัยเทคนิคอำนาจเจริญ",
        x + labelWidthPx / 2,
        startY - 3
      );

      // จัดการลำดับคอลัมน์และแถว
      col++;
      if (col >= printOptions.columns) {
        col = 0;
        row++;
      }
    });
  }, [sortedCartItems, printOptions]);

  // คำนวณจำนวนแผ่นกระดาษที่คาดว่าจะใช้
  const labelsPerPage = printOptions.columns * 7;
  const estimatedPages = Math.max(1, Math.ceil(sortedCartItems.length / labelsPerPage));

  return (
    <main className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col">
      {/* ------------------------------------- */}
      {/* HEADER BAR */}
      {/* ------------------------------------- */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#5B2B92] rounded-lg flex items-center justify-center text-[#FFC72C] shadow-sm shrink-0">
            <Icons.Printer className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">
              ระบบพิมพ์บาร์โค้ดสะสม (Batch Print)
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              สะสมบาร์โค้ดหลายเล่ม พิมพ์ลงกระดาษ {printOptions.paperWidth}x{printOptions.paperHeight} mm ให้คุ้มค่าที่สุด
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-700">
              ในคิวพิมพ์: <span className="text-[#5B2B92]">{cartItems.length}</span> ดวง
            </p>
            <p className="text-[10px] text-slate-400">
              ประมาณ {estimatedPages} หน้ากระดาษ
            </p>
          </div>

          {/* ปุ่มส่งออกเป็นไฟล์ PDF */}
          <button
            onClick={handleExportPDF}
            disabled={exporting || sortedCartItems.length === 0}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-lg font-bold shadow-xs transition-all active:scale-95 flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {exporting ? (
              <span className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className="w-4 h-4"><path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66-56.34a8,8,0,0,0,11.32,0l40-40a8,8,0,1,0-11.32-11.32L136,60.69V24a8,8,0,0,0-16,0V60.69L93.66,36.34A8,8,0,0,0,82.34,47.66Z"></path></svg>
            )}
            {exporting ? "กำลังส่งออก..." : "ส่งออก PDF"}
          </button>

          <button
            onClick={() => window.print()}
            disabled={cartItems.length === 0}
            className="bg-[#5B2B92] hover:bg-[#461E75] text-white px-6 py-2.5 rounded-lg font-bold shadow-md shadow-[#5B2B92]/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icons.Printer className="w-5 h-5" />
            สั่งพิมพ์รวม ({cartItems.length})
          </button>
        </div>
      </header>

      {/* ------------------------------------- */}
      {/* MAIN GRID LAYOUT (1/4 | 1/4 | 2/4) */}
      {/* ------------------------------------- */}
      <div className="flex-1 p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-75px)] overflow-hidden print:h-auto print:block print:p-0">
        {/* ========================================== */}
        {/* LEFT 25%: คลังภาพปกหนังสือ */}
        {/* ========================================== */}
        <aside className="lg:col-span-1 flex flex-col gap-4 overflow-hidden print:hidden">
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col h-full overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-[#5B2B92]"></div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 shrink-0">
              <Icons.Books className="w-4 h-4" /> คลังหนังสือแม่ ({booksList.length})
            </h2>

            {/* แสดงการ์ดหนังสือที่กำลังเลือกแบบกะทัดรัด (Selected Book Banner) */}
            {selectedBook && (
              <div className="mb-3 p-2 bg-[#5B2B92]/5 rounded-lg border border-[#5B2B92]/20 flex items-center gap-2.5 shrink-0">
                <img
                  src={selectedBook.cover}
                  alt="Cover"
                  className="w-10 h-14 object-cover rounded border border-slate-200 shadow-xs shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] bg-[#5B2B92] text-white font-mono font-bold px-1.5 py-0.2 rounded">
                      {selectedBook.book_code}
                    </span>
                    <span className="text-[10px] text-[#9e7608] font-bold truncate">
                      {selectedBook.category}
                    </span>
                  </div>
                  <h3 className="font-bold text-xs text-slate-800 truncate">
                    {selectedBook.title}
                  </h3>
                  <p className="text-[10px] text-slate-400 truncate">
                    ISBN: {selectedBook.isbn}
                  </p>
                </div>
              </div>
            )}

            {/* Gallery รูปปกหนังสือ — แบบ Scroll ได้ลื่นไหล */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1.5 shrink-0">
                <label className="text-[11px] font-bold text-slate-600">
                  เลือกสลับหนังสือแม่ ({booksList.length})
                </label>
                <span className="text-[10px] text-slate-400 font-medium">
                  เลื่อนเพื่อดูทั้งหมด
                </span>
              </div>

              <div
                className="max-h-[calc(100vh-230px)] overflow-y-auto grid grid-cols-3 gap-2 p-1.5 border border-slate-200 rounded-lg bg-slate-50/80"
                style={{ scrollbarWidth: "thin" }}
              >
                {booksList.map((b) => {
                  const isSelected = selectedBook?.id === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleSelectBook(b.id)}
                      className={`group relative aspect-[2/3] rounded-lg overflow-hidden border-2 transition-all ${
                        isSelected
                          ? "border-[#5B2B92] ring-2 ring-[#5B2B92]/30 scale-105 shadow-md z-10"
                          : "border-slate-200 opacity-75 hover:opacity-100 hover:border-slate-400"
                      }`}
                      title={b.title}
                    >
                      <img
                        src={b.cover}
                        alt={b.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-1 text-[9px] text-white truncate font-medium leading-tight">
                        {b.title}
                      </div>
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-[#5B2B92] text-[#FFC72C] rounded-full flex items-center justify-center text-[10px] font-extrabold shadow-sm">
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </aside>

        {/* ========================================== */}
        {/* MIDDLE 25%: กล่อง 2 แท็บ + ตั้งค่ากระดาษ */}
        {/* ========================================== */}
        <section className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto print:hidden">
          {/* กล่อง 2 แท็บ (แท็บ 1: ฉบับย่อยเล่มนี้, แท็บ 2: คิวพิมพ์สะสมทั้งหมด) */}
          <article className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col h-[380px] shrink-0">
            {/* Header แท็บ */}
            <div className="flex border-b border-slate-200 mb-3 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("copies")}
                className={`flex-1 py-2 text-xs font-bold border-b-2 transition ${
                  activeTab === "copies"
                    ? "border-[#5B2B92] text-[#5B2B92]"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                ฉบับย่อยเล่มนี้ ({childCopies.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("queue")}
                className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1 ${
                  activeTab === "queue"
                    ? "border-[#5B2B92] text-[#5B2B92]"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                คิวสะสมทั้งหมด
                <span className="bg-[#5B2B92] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {cartItems.length}
                </span>
              </button>
            </div>

            {/* เนื้อหาในแท็บ 1: ฉบับย่อยของเล่มแม่ที่เลือก (Auto Sync) */}
            {activeTab === "copies" && (
              <div className="flex-1 flex flex-col min-h-0">
                {(() => {
                  const selectedInCartCount = childCopies.filter((c) =>
                    cartItems.some((x) => x.barcode === c.barcode)
                  ).length;
                  const isAllSelected =
                    childCopies.length > 0 && selectedInCartCount === childCopies.length;

                  return (
                    <>
                      <div className="flex justify-between items-center mb-2 shrink-0">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded border-slate-300 text-[#5B2B92] focus:ring-[#5B2B92]"
                            checked={isAllSelected}
                            onChange={handleSelectAll}
                          />
                          <span className="text-xs font-bold text-slate-600">
                            เลือกทั้งหมด ({selectedInCartCount}/{childCopies.length})
                          </span>
                        </label>
                        <span className="text-[10px] text-meb-green font-bold">
                          ⚡ Auto Sync คิวพิมพ์
                        </span>
                      </div>

                      <div
                        className="flex-1 overflow-y-auto space-y-1 p-1.5 border border-slate-100 rounded-md bg-slate-50"
                        style={{ scrollbarWidth: "thin" }}
                      >
                        {loading ? (
                          <p className="text-xs text-slate-400 text-center py-6">
                            กำลังโหลดเล่มลูก...
                          </p>
                        ) : childCopies.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-6">
                            ไม่พบเล่มลูก
                          </p>
                        ) : (
                          childCopies.map((copy) => {
                            const isChecked = cartItems.some((x) => x.barcode === copy.barcode);
                            return (
                              <label
                                key={copy.id}
                                className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs transition border ${
                                  isChecked
                                    ? "bg-[#5B2B92]/5 border-[#5B2B92]/30"
                                    : "hover:bg-white border-transparent hover:border-slate-200"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="w-3.5 h-3.5 rounded border-slate-300 text-[#5B2B92] focus:ring-[#5B2B92]"
                                  checked={isChecked}
                                  onChange={() => toggleSelection(copy.barcode)}
                                />
                                <span className="font-mono font-bold text-slate-700">
                                  {copy.barcode}
                                </span>
                                <span className="text-[10px] text-slate-400 ml-auto">
                                  {copy.label}
                                </span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* เนื้อหาในแท็บ 2: คิวพิมพ์สะสมทั้งหมดข้ามเล่ม (Smart Categorized) */}
            {activeTab === "queue" && (
              <div className="flex-1 flex flex-col min-h-0">
                {sortedCartItems.length > 0 && (
                  <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-100 shrink-0">
                    <span className="text-[11px] text-meb-green font-bold flex items-center gap-1">
                      ✨ จัดกลุ่มหมวดหมู่เรียงสวยงาม
                    </span>
                    <button
                      onClick={clearCart}
                      className="text-xs text-red-500 hover:text-red-700 font-bold hover:underline"
                    >
                      ล้างคิวทั้งหมด
                    </button>
                  </div>
                )}

                <div
                  className="flex-1 overflow-y-auto space-y-1.5 pr-1"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {sortedCartItems.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                      <p className="text-xs font-medium">ยังไม่มีรายการในคิวสะสม</p>
                      <p className="text-[10px] mt-1">
                        เลือกติ๊กหนังสือแม่เพื่อสะสมบาร์โค้ดลงในคิว
                      </p>
                    </div>
                  ) : (
                    sortedCartItems.map((item) => (
                      <div
                        key={item.barcode}
                        className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg border border-slate-100 text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-mono font-bold text-[#5B2B92] leading-none">
                              {item.barcode}
                            </span>
                            {item.categoryName && (
                              <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                {item.categoryName}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-600 truncate">
                            {item.title}
                          </p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.barcode)}
                          className="text-slate-400 hover:text-red-500 p-1 transition shrink-0"
                          title="ลบออกจากคิว"
                        >
                          <Icons.Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </article>

          {/* ส่วนตั้งค่าการพิมพ์ (Print Options & Custom Paper Dimensions) */}
          <article className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 overflow-y-auto">
            <h2 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <Icons.Sliders className="w-4 h-4" /> ตั้งค่ากระดาษและเลย์เอาต์
            </h2>
            <form className="space-y-3">
              {/* เลือก Preset ขนาดกระดาษ */}
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">
                  ขนาดกระดาษ
                </label>
                <select
                  value={printOptions.paperPreset}
                  onChange={(e) => handlePaperPresetChange(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-lg p-2 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-[#5B2B92]/20 focus:border-[#5B2B92]"
                >
                  {Object.entries(PAPER_PRESETS).map(([key, item]) => (
                    <option key={key} value={key}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* กำหนดความกว้าง x ความยาว เอง (ถ้าเลือก Custom หรือต้องการปรับแก้) */}
              {printOptions.paperPreset === "Custom" && (
                <fieldset className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">
                      กว้าง (mm)
                    </label>
                    <input
                      type="number"
                      name="paperWidth"
                      value={printOptions.paperWidth}
                      onChange={handleOptionChange}
                      className="w-full text-xs border border-slate-200 rounded-md p-1.5 bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">
                      ยาว/สูง (mm)
                    </label>
                    <input
                      type="number"
                      name="paperHeight"
                      value={printOptions.paperHeight}
                      onChange={handleOptionChange}
                      className="w-full text-xs border border-slate-200 rounded-md p-1.5 bg-white outline-none"
                    />
                  </div>
                </fieldset>
              )}

              <fieldset className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    กว้างป้าย (mm)
                  </label>
                  <input
                    type="number"
                    name="labelWidth"
                    value={printOptions.labelWidth}
                    onChange={handleOptionChange}
                    className="w-full text-xs border border-slate-200 rounded-lg p-1.5 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    สูงป้าย (mm)
                  </label>
                  <input
                    type="number"
                    name="labelHeight"
                    value={printOptions.labelHeight}
                    onChange={handleOptionChange}
                    className="w-full text-xs border border-slate-200 rounded-lg p-1.5 outline-none"
                  />
                </div>
              </fieldset>

              <fieldset className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    จำนวนคอลัมน์
                  </label>
                  <select
                    name="columns"
                    value={printOptions.columns}
                    onChange={handleOptionChange}
                    className="w-full text-xs border border-slate-200 rounded-lg p-1.5 cursor-pointer bg-white outline-none"
                  >
                    <option value="1">1 ดวง</option>
                    <option value="2">2 ดวง</option>
                    <option value="3">3 ดวง</option>
                    <option value="4">4 ดวง</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    ขนาดอักษร (px)
                  </label>
                  <input
                    type="number"
                    name="fontSize"
                    value={printOptions.fontSize}
                    onChange={handleOptionChange}
                    className="w-full text-xs border border-slate-200 rounded-lg p-1.5 outline-none"
                  />
                </div>
              </fieldset>

              <fieldset className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    ขอบบน (mm)
                  </label>
                  <input
                    type="number"
                    name="marginTop"
                    value={printOptions.marginTop}
                    onChange={handleOptionChange}
                    className="w-full text-xs border border-slate-200 rounded-lg p-1.5 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    ขอบข้าง (mm)
                  </label>
                  <input
                    type="number"
                    name="marginSide"
                    value={printOptions.marginSide}
                    onChange={handleOptionChange}
                    className="w-full text-xs border border-slate-200 rounded-lg p-1.5 outline-none"
                  />
                </div>
              </fieldset>
            </form>
          </article>
        </section>

        {/* ========================================== */}
        {/* RIGHT 50%: Live Preview Canvas & Zoom      */}
        {/* ========================================== */}
        <section
          id="printable-canvas-container"
          className="lg:col-span-2 flex flex-col bg-slate-200/50 rounded-xl border border-slate-200 overflow-hidden relative print:block print:w-full print:bg-white print:border-none print:m-0 print:p-0"
        >
          {/* Header แผงควบคุม Zoom */}
          <div className="p-3 bg-white border-b border-slate-200 flex justify-between items-center print:hidden shadow-sm z-10">
            <h2 className="text-xs font-bold text-slate-900">
              พรีวิวกระดาษ ({printOptions.paperWidth}x{printOptions.paperHeight} mm) — แสดง {cartItems.length} ดวง
            </h2>

            {/* ปุ่ม Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={zoomOut}
                className="p-1 hover:bg-white rounded text-slate-600 transition"
                title="ซูมออก (-)"
              >
                <Icons.ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={resetZoom}
                className="px-2 py-0.5 text-[10px] font-bold bg-white rounded text-[#5B2B92] shadow-xs border border-slate-200"
                title="รีเซ็ตซูม (100%)"
              >
                {zoomScale}%
              </button>
              <button
                type="button"
                onClick={zoomIn}
                className="p-1 hover:bg-white rounded text-slate-600 transition"
                title="ซูมเข้า (+)"
              >
                <Icons.ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center items-start print:p-0 print:overflow-visible">
            <figure
              className="bg-white shadow-xl print:shadow-none transition-transform duration-150 origin-top flex items-center justify-center"
              style={{ transform: `scale(${zoomScale / 100})` }}
            >
              {/* Canvas Rendering Area */}
              <canvas
                ref={canvasRef}
                className="block print:w-full print:h-auto"
              ></canvas>
            </figure>
          </div>
        </section>
      </div>

      {/* Global Style เฉพาะ Print เพื่อแสดง Canvas บนกระดาษอย่างถูกต้อง */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            size: ${printOptions.paperWidth}mm ${printOptions.paperHeight}mm;
            margin: 0;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-canvas-container,
          #printable-canvas-container * {
            visibility: visible !important;
          }
          #printable-canvas-container {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: ${printOptions.paperWidth}mm !important;
            height: ${printOptions.paperHeight}mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            border: none !important;
            box-shadow: none !important;
            z-index: 99999 !important;
          }
          #printable-canvas-container figure {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            transform: none !important;
            width: ${printOptions.paperWidth}mm !important;
            height: ${printOptions.paperHeight}mm !important;
          }
          #printable-canvas-container canvas {
            display: block !important;
            width: ${printOptions.paperWidth}mm !important;
            height: ${printOptions.paperHeight}mm !important;
            max-width: none !important;
          }
        }
      `,
        }}
      />
    </main>
  );
}

export default function PrintBarcodePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5B2B92]"></div>
        </div>
      }
    >
      <PrintBarcodeContent />
    </Suspense>
  );
}