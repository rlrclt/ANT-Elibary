"use client";

import { useState, useActionState } from "react";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import {
  type DamagedRecord,
  type DamagedStats,
  resolveDamagedByCounterAction,
  resolveDamagedByReplacementAction,
  searchMemberAction,
} from "../actions";

type DamagedBooksClientProps = {
  initialRecords: DamagedRecord[];
  initialStats: DamagedStats;
  initialMembers: {
    user_id: string;
    full_name: string;
    user_id_code: string;
    unresolved_count: number;
    total_fine: number;
  }[];
  error: string | null;
};

type TabKey = "unresolved" | "history" | "members";

const STATUS_BADGE: Record<DamagedRecord["status"], string> = {
  unresolved: "bg-red-50 text-price-red border-price-red/10",
  paid: "bg-meb-light text-meb-green border-meb-green/10",
  replaced: "bg-blue-50 text-blue-600 border-blue-600/10",
};

const STATUS_LABEL: Record<DamagedRecord["status"], string> = {
  unresolved: "ค้างชดใช้",
  paid: "ชำระแล้ว",
  replaced: "รับเล่มคืนแล้ว",
};

function formatDate(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(n);
}

export function DamagedBooksClient({
  initialRecords,
  initialStats,
  initialMembers,
  error: initialError,
}: DamagedBooksClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("unresolved");
  const [records, setRecords] = useState<DamagedRecord[]>(initialRecords);
  const [stats, setStats] = useState<DamagedStats>(initialStats);
  const [members, setMembers] = useState(initialMembers);
  const [error, setError] = useState<string | null>(initialError);

  const [counterRecord, setCounterRecord] = useState<DamagedRecord | null>(null);
  const [replaceRecord, setReplaceRecord] = useState<DamagedRecord | null>(null);

  // ---------- Server Actions (useActionState) ----------
  const [counterState, counterAction, counterPending] = useActionState(
    resolveDamagedByCounterAction,
    { error: null },
  );
  const [replaceState, replaceAction, replacePending] = useActionState(
    resolveDamagedByReplacementAction,
    { error: null },
  );

  // ---------- member search (modal รับเล่มคืน) ----------
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<
    { id: string; full_name: string; user_id_code: string; status: string }[]
  >([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [searchingMember, setSearchingMember] = useState(false);

  async function handleMemberSearch(q: string) {
    setMemberQuery(q);
    if (!q.trim()) {
      setMemberResults([]);
      return;
    }
    setSearchingMember(true);
    const res = await searchMemberAction(q);
    setMemberResults(res.data ?? []);
    setSearchingMember(false);
  }

  function closeModals() {
    setCounterRecord(null);
    setReplaceRecord(null);
    setMemberQuery("");
    setMemberResults([]);
    setSelectedMemberId("");
  }

  // รายการตาม tab
  const visibleRecords =
    activeTab === "unresolved"
      ? records.filter((r) => r.status === "unresolved")
      : records;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-forest dark:text-slate-100">
            หนังสือชำรุด
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            จัดการหนังสือชำรุด ค่าชดใช้เต็มราคา และการรับเล่มทดแทนจากสมาชิก
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-price-red bg-red-50 dark:bg-red-500/10 px-4 py-3 rounded-lg text-sm">
          <PhosphorIcon name="warning" weight="fill" />
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card-bg border border-border-base rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">ค้างชดใช้</p>
          <p className="text-2xl font-bold text-price-red mt-1">
            {stats.unresolved}
          </p>
          <p className="text-xs text-slate-500 mt-1">รายการ</p>
        </div>
        <div className="bg-card-bg border border-border-base rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">ยอดค้างชำระรวม</p>
          <p className="text-2xl font-bold text-price-red mt-1">
            {formatMoney(stats.totalFine)}
          </p>
          <p className="text-xs text-slate-500 mt-1">เต็มราคาเล่ม</p>
        </div>
        <div className="bg-card-bg border border-border-base rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">ชำระแล้ว</p>
          <p className="text-2xl font-bold text-meb-green mt-1">{stats.paid}</p>
          <p className="text-xs text-slate-500 mt-1">รายการ</p>
        </div>
        <div className="bg-card-bg border border-border-base rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">รับเล่มคืนแล้ว</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {stats.replaced}
          </p>
          <p className="text-xs text-slate-500 mt-1">รายการ</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
        {(
          [
            { key: "unresolved", label: "ค้างชดใช้", icon: "warning-circle" },
            { key: "history", label: "ประวัติทั้งหมด", icon: "clock-counter-clockwise" },
            { key: "members", label: "สมาชิกที่ถูกบล็อก", icon: "users" },
          ] as { key: TabKey; label: string; icon: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === tab.key
                ? "bg-meb-green text-white"
                : "bg-card-bg text-slate-600 border border-border-base hover:bg-meb-light/50"
            }`}
          >
            <PhosphorIcon name={tab.icon} className="text-base" />
            {tab.label}
            {tab.key === "members" && members.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-price-red text-white text-[10px]">
                {members.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ===== Tab: สมาชิกที่ถูกบล็อก ===== */}
      {activeTab === "members" && (
        <div className="bg-card-bg border border-border-base rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border-base">
            <h2 className="font-bold text-forest dark:text-slate-100">
              สมาชิกที่ถูกบล็อกการยืม
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              มีหนังสือชำรุดค้างชดใช้ — ต้องจ่ายค่าปรับเต็มราคาหรือซื้อหนังสือมาคืนก่อน
            </p>
          </div>
          {members.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              <PhosphorIcon name="check-circle" className="text-4xl mx-auto mb-2" />
              <p className="text-sm">ไม่มีสมาชิกที่ถูกบล็อก</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-border-base">
                    <th className="px-4 py-3">สมาชิก</th>
                    <th className="px-4 py-3">รหัสสมาชิก</th>
                    <th className="px-4 py-3 text-center">จำนวนที่ค้าง</th>
                    <th className="px-4 py-3 text-right">ยอดค้างรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr
                      key={m.user_id}
                      className="border-b border-border-base last:border-0"
                    >
                      <td className="px-4 py-3 font-bold text-forest dark:text-slate-100">
                        {m.full_name}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{m.user_id_code}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-red-50 text-price-red text-xs font-bold">
                          {m.unresolved_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-price-red">
                        {formatMoney(m.total_fine)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== Tab: รายการชำรุด (ค้างชดใช้ / ประวัติทั้งหมด) ===== */}
      {(activeTab === "unresolved" || activeTab === "history") && (
        <div className="bg-card-bg border border-border-base rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border-base flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-forest dark:text-slate-100">
              {activeTab === "unresolved"
                ? `รายการค้างชดใช้ (${visibleRecords.length})`
                : `ประวัติทั้งหมด (${visibleRecords.length})`}
            </h2>
            {activeTab === "history" && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <PhosphorIcon name="info" className="text-sm" />
                เฉพาะสถานะชำรุด / ชำระแล้ว / รับเล่มคืนแล้ว
              </div>
            )}
          </div>

          {visibleRecords.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              <PhosphorIcon name="book" className="text-4xl mx-auto mb-2" />
              <p className="text-sm">
                {activeTab === "unresolved"
                  ? "ไม่มีหนังสือชำรุดค้างชดใช้"
                  : "ยังไม่มีประวัติหนังสือชำรุด"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[820px]">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-border-base">
                    <th className="px-4 py-3">หนังสือ</th>
                    <th className="px-4 py-3">บาร์โค้ด</th>
                    <th className="px-4 py-3">สมาชิกผู้รับผิดชอบ</th>
                    <th className="px-4 py-3">ราคาเต็ม</th>
                    <th className="px-4 py-3">สถานะ</th>
                    <th className="px-4 py-3">วันที่</th>
                    <th className="px-4 py-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-border-base last:border-0"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-10 rounded bg-gray-100 dark:bg-white/5 overflow-hidden shrink-0">
                            {r.book_copy?.book?.cover_image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={r.book_copy.book.cover_image_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <PhosphorIcon name="book" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-forest dark:text-slate-100 truncate">
                              {r.book_copy?.book?.title ?? "ไม่ระบุชื่อ"}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {r.book_copy?.book?.book_code ?? "-"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {r.book_copy?.barcode ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-forest dark:text-slate-100">
                          {r.user?.full_name ?? "-"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {r.user?.user_id_code ?? "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-bold text-price-red">
                        {formatMoney(r.fine_amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${STATUS_BADGE[r.status]}`}
                        >
                          {STATUS_LABEL[r.status]}
                        </span>
                        {r.resolution_method === "replacement" &&
                          r.replacement_user && (
                            <p className="text-[11px] text-slate-500 mt-1">
                              นำคืนโดย {r.replacement_user.full_name}
                            </p>
                          )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {r.status === "unresolved" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setCounterRecord(r)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold text-meb-green bg-meb-light hover:bg-meb-light/70 transition"
                            >
                              <PhosphorIcon name="currency-circle-dollar" className="text-sm" />
                              รับชำระ
                            </button>
                            <button
                              type="button"
                              onClick={() => setReplaceRecord(r)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition"
                            >
                              <PhosphorIcon name="arrows-clockwise" className="text-sm" />
                              รับเล่มคืน
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {r.fine_payment?.status === "counter_paid"
                              ? "จ่ายที่เคาน์เตอร์"
                              : r.status === "paid"
                                ? "ชำระผ่านสลิป"
                                : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== Modal: รับชำระที่เคาน์เตอร์ ===== */}
      {counterRecord && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={closeModals}
        >
          <div
            className="bg-white dark:bg-card-bg rounded-2xl w-full max-w-md p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg text-forest dark:text-slate-100">
                  รับชำระเต็มราคาที่เคาน์เตอร์
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  สร้างรายการชำระ (counter_paid) และปลดบล็อกการยืมของสมาชิก
                </p>
              </div>
              <button
                type="button"
                onClick={closeModals}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <PhosphorIcon name="x" />
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">หนังสือ</span>
                <span className="font-bold text-forest dark:text-slate-100">
                  {counterRecord.book_copy?.book?.title ?? "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">สมาชิก</span>
                <span className="font-medium">
                  {counterRecord.user?.full_name ?? "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ยอดชดใช้</span>
                <span className="font-bold text-price-red">
                  {formatMoney(counterRecord.fine_amount)}
                </span>
              </div>
            </div>

            <form action={counterAction} className="mt-4 space-y-3">
              <input type="hidden" name="record_id" value={counterRecord.id} />
              {counterState?.error && (
                <div className="text-price-red text-xs bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-md">
                  {counterState.error}
                </div>
              )}
              <button
                type="submit"
                disabled={counterPending}
                className="w-full inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-2.5 rounded-md text-sm transition disabled:opacity-60"
              >
                {counterPending ? (
                  <PhosphorIcon name="circle-notch" className="animate-spin" />
                ) : (
                  <PhosphorIcon name="check" weight="bold" />
                )}
                ยืนยันรับชำระ {formatMoney(counterRecord.fine_amount)}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Modal: รับเล่มทดแทน ===== */}
      {replaceRecord && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={closeModals}
        >
          <div
            className="bg-white dark:bg-card-bg rounded-2xl w-full max-w-md p-5 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg text-forest dark:text-slate-100">
                  รับเล่มทดแทน
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  เล่มลูกจะกลับเป็น <b>พร้อมยืม</b> โดยใช้บาร์โค้ดเดิม และปลดบล็อกการยืมของสมาชิก
                </p>
              </div>
              <button
                type="button"
                onClick={closeModals}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <PhosphorIcon name="x" />
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3 text-sm space-y-1 mb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">หนังสือ</span>
                <span className="font-bold text-forest dark:text-slate-100">
                  {replaceRecord.book_copy?.book?.title ?? "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">บาร์โค้ด</span>
                <span className="font-mono text-xs">
                  {replaceRecord.book_copy?.barcode ?? "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ผู้รับผิดชอบชำรุด</span>
                <span className="font-medium">
                  {replaceRecord.user?.full_name ?? "-"}
                </span>
              </div>
            </div>

            <form action={replaceAction} className="space-y-3">
              <input type="hidden" name="record_id" value={replaceRecord.id} />

              {/* เลือกคนนำหนังสือมาคืน */}
              <div>
                <label className="block text-xs font-medium text-forest dark:text-slate-100 mb-1">
                  สมาชิกที่นำหนังสือมาคืน <span className="text-price-red">*</span>
                </label>
                <input
                  type="text"
                  value={memberQuery}
                  onChange={(e) => handleMemberSearch(e.target.value)}
                  placeholder="ค้นหาชื่อ / รหัสสมาชิก..."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light"
                />
                {searchingMember && (
                  <p className="text-xs text-slate-400 mt-1">
                    <PhosphorIcon name="circle-notch" className="animate-spin inline-block" />{" "}
                    กำลังค้นหา...
                  </p>
                )}
                {memberResults.length > 0 && (
                  <div className="mt-1 bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md max-h-48 overflow-y-auto">
                    {memberResults.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedMemberId(m.id);
                          setMemberQuery(`${m.full_name} (${m.user_id_code})`);
                          setMemberResults([]);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-meb-light/50 flex items-center justify-between gap-2 ${
                          selectedMemberId === m.id
                            ? "bg-meb-light text-meb-green"
                            : ""
                        }`}
                      >
                        <span>
                          <span className="font-bold">{m.full_name}</span>{" "}
                          <span className="text-slate-500">({m.user_id_code})</span>
                        </span>
                        {selectedMemberId === m.id && (
                          <PhosphorIcon name="check" weight="bold" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <input type="hidden" name="replacement_user_id" value={selectedMemberId} />
              </div>

              {/* หมายเหตุ */}
              <div>
                <label className="block text-xs font-medium text-forest dark:text-slate-100 mb-1">
                  หมายเหตุ
                </label>
                <textarea
                  name="note"
                  rows={2}
                  placeholder="เช่น วันที่นำมาคืน, สภาพเล่มใหม่..."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green resize-none"
                />
              </div>

              {replaceState?.error && (
                <div className="text-price-red text-xs bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-md">
                  {replaceState.error}
                </div>
              )}

              <button
                type="submit"
                disabled={replacePending}
                className="w-full inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-2.5 rounded-md text-sm transition disabled:opacity-60"
              >
                {replacePending ? (
                  <PhosphorIcon name="circle-notch" className="animate-spin" />
                ) : (
                  <PhosphorIcon name="check" weight="bold" />
                )}
                ยืนยันรับเล่มทดแทน
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
