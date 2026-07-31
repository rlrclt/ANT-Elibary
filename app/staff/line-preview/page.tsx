"use client";

import { useState, useTransition, useEffect } from "react";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import {
  sendTestAction,
  sendPreviewTestAction,
  getLineUsersAction,
} from "../line-preview/actions";

/**
 * หน้า Preview Flex Message — จำลองหน้าจอ LINE
 * แสดงตัวอย่าง Flex Message ทั้ง 4 แบบก่อนส่งจริง
 *
 * ไฟล์นี้เป็นแค่ preview — คุณสามารถปรับแต่ง UI ได้ที่นี่
 * ส่วน Flex Message จริงที่ส่งไป LINE กำหนดที่ utils/line-notify.ts
 */

type Template = "borrow" | "return" | "reminder" | "renew";

const TEMPLATES: { key: Template; label: string; icon: string }[] = [
  { key: "borrow", label: "ยืมหนังสือ", icon: "book-open" },
  { key: "return", label: "คืนหนังสือ", icon: "check-circle" },
  { key: "reminder", label: "ใกล้ครบกำหนด", icon: "bell-ringing" },
  { key: "renew", label: "ต่ออายุการยืม", icon: "arrows-clockwise" },
];

const HERO_IMAGE_URL =
  "https://fhdgnerfevvfofdnafcj.supabase.co/storage/v1/object/public/media/Gemini_Generated_Image_4i4o444i4o444i4o.png";

// ข้อมูลตัวอย่างสำหรับ borrow (card layout แบบใหม่)
const BORROW_DATA = {
  bookTitle: "หลักการออกแบบ UX/UI Design",
  memberName: "นายลิขิต ใจดี",
  copyNo: "B001",
  borrowDate: "27 กรกฎาคม 2569",
  dueDate: "10 สิงหาคม 2569",
};

// ข้อมูลตัวอย่างสำหรับ return/reminder/renew (list layout แบบเดิม)
const SAMPLE_DATA: Record<
  "return" | "reminder" | "renew",
  {
    headerBg: string;
    headerText: string;
    headerSub: string;
    headerColor: string;
    subColor: string;
    bodyText: string;
    items: { icon: string; label: string; value: string; color?: string }[];
    alertBox?: { bg: string; text: string; subText?: string };
  }
> = {
  return: {
    headerBg: "#10b981",
    headerText: "✅ คืนหนังสือ",
    headerSub: "สำเร็จ!",
    headerColor: "#FFFFFF",
    subColor: "#FFFFFF",
    bodyText: "ขอบคุณที่ส่งคืนตรงตามเวลา",
    items: [
      { icon: "👤", label: "ชื่อสมาชิก", value: "นายลิขิต ใจดี" },
      { icon: "📖", label: "ชื่อหนังสือ", value: "หลักการออกแบบ UX/UI Design" },
      { icon: "🔖", label: "เล่มที่", value: "B001" },
      { icon: "📅", label: "วันที่ยืม", value: "27 กรกฎาคม 2569" },
      { icon: "✅", label: "วันที่คืน", value: "5 สิงหาคม 2569", color: "#10b981" },
    ],
  },
  reminder: {
    headerBg: "#f8b400",
    headerText: "🔔 ใกล้ครบกำหนด",
    headerSub: "คืนหนังสือ",
    headerColor: "#FFFFFF",
    subColor: "#FFFFFF",
    bodyText: "เหลือเวลาอีก 3 วัน",
    items: [
      { icon: "👤", label: "ชื่อผู้ยืม", value: "นายลิขิต ใจดี" },
      { icon: "📖", label: "ชื่อหนังสือ", value: "หลักการออกแบบ UX/UI Design" },
      { icon: "🔖", label: "เล่มที่", value: "B001" },
      { icon: "📅", label: "วันที่ยืม", value: "27 กรกฎาคม 2569" },
      { icon: "📆", label: "กำหนดคืน", value: "10 สิงหาคม 2569", color: "#ef4444" },
    ],
    alertBox: {
      bg: "#fef2f2",
      text: "เหลือเวลาอีก 3 วัน",
      subText: "หลังจากนี้จะถือว่าผิดกำหนด อาจมีค่าปรับ",
    },
  },
  renew: {
    headerBg: "#3b82f6",
    headerText: "🔄 ต่ออายุการยืม",
    headerSub: "สำเร็จ!",
    headerColor: "#FFFFFF",
    subColor: "#FFFFFF",
    bodyText: "เพิ่มเวลาอีก 7 วัน",
    items: [
      { icon: "👤", label: "ชื่อสมาชิก", value: "นายลิขิต ใจดี" },
      { icon: "📖", label: "ชื่อหนังสือ", value: "หลักการออกแบบ UX/UI Design" },
      { icon: "🔖", label: "เล่มที่", value: "B001" },
      { icon: "❌", label: "กำหนดเดิม", value: "10 สิงหาคม 2569", color: "#94a3b8" },
      { icon: "✨", label: "กำหนดใหม่", value: "17 สิงหาคม 2569", color: "#3b82f6" },
    ],
    alertBox: {
      bg: "#eff6ff",
      text: "เพิ่มเวลาอีก 7 วัน",
      subText: "ใช้สิทธิ์ต่ออายุ 1/1 ครั้ง",
    },
  },
};

export default function LinePreviewPage() {
  const [active, setActive] = useState<Template>("borrow");
  const [pending, startTransition] = useTransition();
  const [debugLogs, setDebugLogs] = useState<
    { step: string; status: "ok" | "error"; message: string }[]
  >([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [lineUsers, setLineUsers] = useState<
    { id: string; full_name: string; user_id_code: string }[]
  >([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [sendMode, setSendMode] = useState<"real" | "preview">("preview");

  // ดึงรายการ users ที่เชื่อม LINE แล้ว
  useEffect(() => {
    getLineUsersAction().then((res) => {
      if (res.data) setLineUsers(res.data);
    });
  }, []);

  function handleSendTest() {
    setSendError(null);
    setSendSuccess(null);
    setDebugLogs([]);

    const formData = new FormData();
    formData.set("template", active);
    formData.set("target_user_id", selectedUser);

    startTransition(async () => {
      // เลือก action ตามโหมด
      const res =
        sendMode === "preview"
          ? await sendPreviewTestAction(formData)
          : await sendTestAction(formData);

      if (res.debug) setDebugLogs(res.debug);
      if (res.error) {
        setSendError(res.error);
        return;
      }
      setSendSuccess(
        sendMode === "preview"
          ? "ส่งแบบพรีวิวสำเร็จ — ตรวจสอบ LINE ของ user ที่เลือก"
          : "ส่งแบบจริงสำเร็จ — ตรวจสอบ LINE ของ user ที่เลือก",
      );
    });
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-forest dark:text-slate-100 flex items-center gap-2">
            <PhosphorIcon name="line-logo" weight="fill" className="text-[#06C755]" />
            Preview Flex Message
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ตัวอย่างการแจ้งเตือน LINE ทั้ง 4 แบบ — ปรับแต่งได้ที่{" "}
            <code className="text-xs bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
              utils/line-notify.ts
            </code>
          </p>
        </div>

        {/* เลือก template */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TEMPLATES.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
                active === t.key
                  ? "bg-[#06C755] text-white"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              }`}
            >
              <PhosphorIcon name={t.icon} weight="fill" className="text-sm" />
              {t.label}
            </button>
          ))}
        </div>

        {/* LINE Phone Mockup */}
        <div className="flex justify-center">
          <div className="w-full max-w-[380px] bg-[#7B5544] rounded-[2.5rem] p-3 shadow-2xl">
            {/* Phone screen */}
            <div className="bg-[#F5F5F5] rounded-[2rem] overflow-hidden h-[650px] flex flex-col">
              {/* LINE header */}
              <div className="bg-[#06C755] px-4 py-3 flex items-center gap-3">
                <PhosphorIcon name="arrow-left" weight="bold" className="text-white text-lg" />
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <PhosphorIcon name="line-logo" weight="fill" className="text-white text-sm" />
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-semibold">ANT-ELIBARY</p>
                  <p className="text-white/70 text-xs">Official Account</p>
                </div>
                <PhosphorIcon name="dots-three-vertical" weight="bold" className="text-white text-sm" />
              </div>

              {/* Chat area */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#EAEAEA]">
                {/* Time */}
                <p className="text-center text-xs text-slate-400">
                  {new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                </p>

                {/* Bot avatar + message */}
                <div className="flex gap-2 items-start">
                  <div className="w-8 h-8 rounded-full bg-[#06C755] flex items-center justify-center shrink-0">
                    <PhosphorIcon name="line-logo" weight="fill" className="text-white text-sm" />
                  </div>

                  {/* Flex Message bubble */}
                  <div className="flex-1 max-w-[310px]">
                    {active === "borrow" ? (
                      /* ===== Borrow: hero image + card layout แบบใหม่ ===== */
                      <div className="bg-white rounded-2xl rounded-tl-sm overflow-hidden shadow-lg">
                        {/* Hero image */}
                        <div
                          className="relative h-32 bg-cover bg-center"
                          style={{ backgroundImage: `url(${HERO_IMAGE_URL})` }}
                        >
                          <div
                            className="absolute inset-0"
                            style={{
                              background:
                                "linear-gradient(180deg, rgba(9,37,76,0.55) 0%, rgba(9,37,76,0.8) 100%)",
                            }}
                          />
                        
                        </div>

                        {/* Body */}
                        <div className="px-4 py-4 space-y-3 bg-gradient-to-b from-slate-50/50 to-white">
                          {/* Book title card */}
                          <div className="rounded-xl p-3.5 flex items-center gap-3">
                            <div className="w-16 h-20 shrink-0 overflow-hidden rounded-lg shadow-md">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src="https://www.bloggang.com/data/vinitsiri/picture/1326027812.jpg"
                                alt="book cover"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wider mb-1">
                                ชื่อหนังสือ
                              </p>
                              <p className="text-sm font-bold text-slate-800 leading-snug line-clamp-2">
                                {BORROW_DATA.bookTitle}
                              </p>
                            </div>
                          </div>

                          {/* Grid: ผู้ยืม + เล่มที่ */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                                  <span className="text-sm">👤</span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                                  ผู้ยืม
                                </p>
                              </div>
                              <p className="text-xs font-bold text-slate-800 leading-tight">
                                {BORROW_DATA.memberName}
                              </p>
                            </div>
                            <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                                  <span className="text-sm">🔖</span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                                  เล่มที่
                                </p>
                              </div>
                              <p className="text-sm font-bold text-slate-800">
                                {BORROW_DATA.copyNo}
                              </p>
                            </div>
                          </div>

                          {/* Grid: วันที่ยืม + กำหนดคืน */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                                  <span className="text-sm">📅</span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                                  วันที่ยืม
                                </p>
                              </div>
                              <p className="text-xs font-bold text-slate-800 leading-tight">
                                {BORROW_DATA.borrowDate}
                              </p>
                            </div>
                            {/* Deadline card */}
                            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-3 border border-dashed border-red-300 relative overflow-hidden">
                              <div className="absolute -top-2 -right-2 w-12 h-12 bg-red-400/15 rounded-full" />
                              <div className="relative">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shadow-sm">
                                    <span className="text-sm">📆</span>
                                  </div>
                                  <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider">
                                    กำหนดคืน
                                  </p>
                                </div>
                                <p className="text-xs font-bold text-red-700 leading-tight">
                                  {BORROW_DATA.dueDate}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 border-t border-slate-100 bg-gradient-to-b from-white to-slate-50/50">
                          <div className="w-full bg-gradient-to-br from-[#2e96a8] to-[#1e7a8a] text-white text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md">
                            <span>📋 ดูรายละเอียด</span>
                            <span>→</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* ===== Return / Reminder / Renew: list layout แบบเดิม ===== */
                      <ListLayoutBubble data={SAMPLE_DATA[active]} />
                    )}
                  </div>
                </div>
              </div>

              {/* Input bar */}
              <div className="bg-white px-3 py-2 flex items-center gap-2 border-t border-gray-200">
                <div className="flex-1 bg-gray-100 rounded-full px-3 py-2">
                  <span className="text-xs text-slate-400">Aa</span>
                </div>
                <PhosphorIcon name="smiley" className="text-slate-400 text-lg" />
                <PhosphorIcon name="paper-plane-tilt" className="text-[#06C755] text-lg" />
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
          <h2 className="text-sm font-bold text-forest dark:text-slate-100 mb-2">
            ปรับแต่ง Flex Message
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            ไฟล์ที่กำหนด UI จริง:{" "}
            <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
              utils/line-notify.ts
            </code>
            <br />
            ฟังก์ชัน:{" "}
            <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
              borrowTemplate()
            </code>{" "}
            /{" "}
            <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
              returnTemplate()
            </code>{" "}
            /{" "}
            <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
              reminderTemplate()
            </code>{" "}
            /{" "}
            <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
              renewTemplate()
            </code>
            <br />
            สีธีม:{" "}
            <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
              COLORS
            </code>{" "}
            (บรรทัด 28-39)
          </p>
        </div>

        {/* ส่งทดสอบ + Debug */}
        <div className="mt-6 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-bold text-forest dark:text-slate-100 mb-4">
            ส่งทดสอบไปยัง LINE
          </h2>

          {/* เลือก user */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              เลือกสมาชิกที่จะส่งแจ้งเตือน
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
            >
              <option value="">— เลือกสมาชิก —</option>
              {lineUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.user_id_code})
                </option>
              ))}
            </select>
            {lineUsers.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                ยังไม่มีสมาชิกที่เชื่อมต่อ LINE
              </p>
            )}
          </div>

          {/* เลือกโหมดส่ง */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              โหมดส่ง
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSendMode("preview")}
                className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                  sendMode === "preview"
                    ? "bg-[#06C755] text-white"
                    : "bg-gray-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/10"
                }`}
              >
                แบบพรีวิว (hero + card)
              </button>
              <button
                type="button"
                onClick={() => setSendMode("real")}
                className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                  sendMode === "real"
                    ? "bg-[#06C755] text-white"
                    : "bg-gray-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/10"
                }`}
              >
                แบบจริง (list layout)
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">
              {sendMode === "preview"
                ? "ส่ง Flex Message แบบ hero image + card layout (เหมือนที่เห็นในพรีวิว) — ใช้สำหรับทดสอบดีไซน์ใหม่"
                : "ส่ง Flex Message แบบจริงที่ใช้ในระบบ (list layout) — เหมือนที่สมาชิกจะได้รับจริง"}
            </p>
          </div>

          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ส่ง Flex Message แบบ "{TEMPLATES.find((t) => t.key === active)?.label}" (
              {sendMode === "preview" ? "พรีวิว" : "จริง"})
            </p>
            <button
              onClick={handleSendTest}
              disabled={pending || !selectedUser}
              className="inline-flex items-center gap-2 text-sm font-bold text-white bg-[#06C755] hover:bg-[#05b24d] px-4 py-2 rounded-md transition disabled:opacity-60"
            >
              <PhosphorIcon
                name={pending ? "circle-notch" : "paper-plane-tilt"}
                weight="fill"
                className={pending ? "text-sm animate-spin" : "text-sm"}
              />
              {pending ? "กำลังส่ง..." : "ส่งทดสอบ"}
            </button>
          </div>

          {/* แจ้งเตือนผล */}
          {sendError && (
            <div className="mb-3 flex items-start gap-2 bg-price-red/10 border border-price-red/30 text-price-red text-sm px-3 py-2 rounded-md">
              <PhosphorIcon name="warning-circle" weight="fill" className="text-sm shrink-0 mt-0.5" />
              <span className="break-all">{sendError}</span>
            </div>
          )}
          {sendSuccess && (
            <div className="mb-3 flex items-center gap-2 bg-meb-light/50 border border-meb-green/30 text-meb-hover text-sm px-3 py-2 rounded-md">
              <PhosphorIcon name="check-circle" weight="fill" className="text-sm" />
              {sendSuccess}
            </div>
          )}

          {/* Debug Console */}
          {debugLogs.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                <PhosphorIcon name="terminal" weight="fill" className="text-sm" />
                Debug Console
              </h3>
              <div className="bg-slate-900 dark:bg-black/50 rounded-lg p-3 font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
                {debugLogs.map((log, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 ${
                      log.status === "ok" ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    <span className="shrink-0">
                      {log.status === "ok" ? "✓" : "✗"}
                    </span>
                    <span className="shrink-0 font-bold">{log.step}:</span>
                    <span className="break-all whitespace-pre-wrap">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- ListLayoutBubble (สำหรับ return/reminder/renew) ----------
function ListLayoutBubble({
  data,
}: {
  data: {
    headerBg: string;
    headerText: string;
    headerSub: string;
    headerColor: string;
    subColor: string;
    bodyText: string;
    items: { icon: string; label: string; value: string; color?: string }[];
    alertBox?: { bg: string; text: string; subText?: string };
  };
}) {
  return (
    <div className="bg-white rounded-2xl rounded-tl-sm overflow-hidden shadow-sm">
      {/* Header */}
      <div
        className="px-5 py-6 text-center"
        style={{ backgroundColor: data.headerBg }}
      >
        <p className="font-bold text-xl" style={{ color: data.headerColor }}>
          {data.headerText}
        </p>
        <p className="font-bold text-xl mt-1" style={{ color: data.subColor }}>
          {data.headerSub}
        </p>
        <p className="text-xs mt-3 opacity-90" style={{ color: data.headerColor }}>
          {data.bodyText}
        </p>
      </div>

      {/* Body */}
      <div className="px-4 py-4 space-y-3">
        {data.items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-2 pb-2 border-b border-gray-100 last:border-0 last:pb-0"
          >
            <span className="text-sm">{item.icon}</span>
            <span className="text-xs text-slate-500 flex-1">{item.label}</span>
            <span
              className="text-sm font-semibold"
              style={{ color: item.color || "#09254c" }}
            >
              {item.value}
            </span>
          </div>
        ))}

        {/* Alert box (ถ้ามี) */}
        {data.alertBox && (
          <div
            className="rounded-xl p-3 flex items-center gap-2"
            style={{ backgroundColor: data.alertBox.bg }}
          >
            <span className="text-sm font-bold text-slate-700">
              {data.alertBox.text}
            </span>
            {data.alertBox.subText && (
              <span className="text-xs text-slate-500 ml-auto">
                {data.alertBox.subText}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
        <div className="w-full bg-gradient-to-br from-[#2e96a8] to-[#1e7a8a] text-white text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md">
          <span>📋 ดูรายละเอียด</span>
          <span>→</span>
        </div>
      </div>
    </div>
  );
}