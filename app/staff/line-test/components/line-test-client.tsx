"use client";

import { useState, useTransition, useEffect } from "react";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import {
  getLineUsersAction,
  sendTestNotificationAction,
  sendBroadcastAction,
  getQueueStatsAction,
  getQueueListAction,
  triggerDispatchAction,
} from "../actions";

type LineUser = {
  id: string;
  full_name: string;
  user_id_code: string;
  line_user_id: string | null;
};

type QueueItem = {
  id: string;
  user_id: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  payload: any;
};

type QueueStats = {
  pending: number;
  sent: number;
  failed: number;
  total: number;
};

const TEMPLATES = [
  { value: "borrow", label: "ยืมหนังสือ", icon: "book-open" },
  { value: "return", label: "คืนหนังสือ", icon: "check-circle" },
  { value: "reminder", label: "ใกล้ครบกำหนด", icon: "bell-ringing" },
  { value: "renew", label: "ต่ออายุการยืม", icon: "arrows-clockwise" },
];

export function LineTestClient() {
  const [users, setUsers] = useState<LineUser[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("borrow");
  const [customTitle, setCustomTitle] = useState("");
  const [customBody, setCustomBody] = useState("");

  async function loadData() {
    const [usersRes, statsRes, queueRes] = await Promise.all([
      getLineUsersAction(),
      getQueueStatsAction(),
      getQueueListAction(),
    ]);
    if (usersRes.data) setUsers(usersRes.data);
    if (statsRes.data) setStats(statsRes.data);
    if (queueRes.data) setQueue(queueRes.data);
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleSendTest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    formData.set("user_id", selectedUser);
    formData.set("template", selectedTemplate);

    startTransition(async () => {
      const res = await sendTestNotificationAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(
        `ส่งแจ้งเตือนเข้าคิวแล้ว (ID: ${res.queueId?.slice(0, 8)}...) — ระบบจะส่งไป LINE ทันทีผ่าน after()`,
      );
      await loadData();
    });
  }

  function handleBroadcast(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!confirm(`ส่งแจ้งเตือนไปยังผู้ใช้ที่เชื่อม LINE ทั้งหมด ${users.length} คน?`))
      return;

    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await sendBroadcastAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(`ส่งแจ้งเตือนไปยัง ${res.sent} คนแล้ว`);
      await loadData();
    });
  }

  function handleDispatch() {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const res = await triggerDispatchAction();
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(`Dispatch สำเร็จ: ส่ง ${res.sent} รายการ, ล้มเหลว ${res.failed} รายการ`);
      await loadData();
    });
  }

  const statusColor = (status: string) => {
    if (status === "sent") return "text-meb-green bg-meb-light";
    if (status === "failed") return "text-price-red bg-price-red/10";
    return "text-amber-600 bg-amber-100";
  };

  const statusLabel = (status: string) => {
    if (status === "sent") return "ส่งแล้ว";
    if (status === "failed") return "ล้มเหลว";
    return "รอส่ง";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forest dark:text-slate-100 flex items-center gap-2">
            <PhosphorIcon name="line-logo" weight="fill" className="text-[#06C755]" />
            ทดสอบแจ้งเตือน LINE
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ส่งแจ้งเตือน LINE ทดสอบไปยังสมาชิก และตรวจสอบสถานะคิว
          </p>
        </div>
      </div>

      {/* สถานะ Queue */}
      <section className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-forest dark:text-slate-100 flex items-center gap-2">
            <PhosphorIcon name="chart-bar" className="text-meb-green" weight="fill" />
            สถานะ Notification Queue
          </h2>
          <button
            onClick={handleDispatch}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-meb-green hover:bg-meb-hover px-3 py-2 rounded-md transition disabled:opacity-60"
          >
            <PhosphorIcon name="paper-plane-tilt" weight="fill" className="text-sm" />
            ส่ง pending ทั้งหมด
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="รอส่ง" value={stats.pending} color="amber" icon="clock" />
            <StatCard label="ส่งแล้ว" value={stats.sent} color="green" icon="check-circle" />
            <StatCard label="ล้มเหลว" value={stats.failed} color="red" icon="x-circle" />
            <StatCard label="ทั้งหมด" value={stats.total} color="blue" icon="database" />
          </div>
        )}
      </section>

      {/* ส่งทดสอบไปยังคนเดียว */}
      <section className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-5 shadow-sm">
        <h2 className="text-base font-bold text-forest dark:text-slate-100 flex items-center gap-2 mb-4">
          <PhosphorIcon name="paper-plane-tilt" className="text-meb-green" weight="fill" />
          ส่งแจ้งเตือนทดสอบ
        </h2>

        <form onSubmit={handleSendTest} className="space-y-4">
          {/* เลือกสมาชิก */}
          <div>
            <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
              เลือกสมาชิก
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
            >
              <option value="">— เลือกสมาชิก —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.user_id_code})
                </option>
              ))}
            </select>
            {users.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                ยังไม่มีสมาชิกที่เชื่อมต่อ LINE
              </p>
            )}
          </div>

          {/* เลือก template */}
          <div>
            <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
              ประเภทแจ้งเตือน
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setSelectedTemplate(t.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                    selectedTemplate === t.value
                      ? "bg-meb-green text-white"
                      : "bg-gray-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/10"
                  }`}
                >
                  <PhosphorIcon name={t.icon} weight="fill" className="text-sm" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* หัวข้อ + ข้อความกำหนดเอง */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                หัวข้อ (ไม่บังคับ)
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="ใช้ค่าเริ่มต้นถ้าไม่กรอก"
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                ข้อความ (ไม่บังคับ)
              </label>
              <input
                type="text"
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                placeholder="ใช้ค่าเริ่มต้นถ้าไม่กรอก"
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={pending || !selectedUser}
            className="inline-flex items-center gap-2 text-sm font-bold text-white bg-meb-green hover:bg-meb-hover px-5 py-2.5 rounded-md transition disabled:opacity-60"
          >
            <PhosphorIcon name="paper-plane-tilt" weight="fill" />
            ส่งแจ้งเตือนทดสอบ
          </button>
        </form>
      </section>

      {/* ส่ง broadcast */}
      <section className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-5 shadow-sm">
        <h2 className="text-base font-bold text-forest dark:text-slate-100 flex items-center gap-2 mb-4">
          <PhosphorIcon name="megaphone" className="text-meb-green" weight="fill" />
          ส่งแจ้งเตือนทุกคน (Broadcast)
        </h2>

        <form onSubmit={handleBroadcast} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                หัวข้อ *
              </label>
              <input
                name="title"
                type="text"
                required
                placeholder="หัวข้อแจ้งเตือน"
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                ข้อความ *
              </label>
              <input
                name="body"
                type="text"
                required
                placeholder="ข้อความแจ้งเตือน"
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={pending || users.length === 0}
            className="inline-flex items-center gap-2 text-sm font-bold text-white bg-[#06C755] hover:bg-[#05b24d] px-5 py-2.5 rounded-md transition disabled:opacity-60"
          >
            <PhosphorIcon name="megaphone" weight="fill" />
            ส่งไปยัง {users.length} คน
          </button>
        </form>
      </section>

      {/* แจ้งเตือนผล */}
      {error && (
        <div className="flex items-center gap-2 bg-price-red/10 border border-price-red/30 text-price-red text-sm px-4 py-3 rounded-md">
          <PhosphorIcon name="warning-circle" weight="fill" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 bg-meb-light/50 border border-meb-green/30 text-meb-hover text-sm px-4 py-3 rounded-md">
          <PhosphorIcon name="check-circle" weight="fill" />
          {success}
        </div>
      )}

      {/* รายการ Queue ล่าสุด */}
      <section className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-5 shadow-sm">
        <h2 className="text-base font-bold text-forest dark:text-slate-100 flex items-center gap-2 mb-4">
          <PhosphorIcon name="list-checks" className="text-meb-green" weight="fill" />
          รายการ Queue ล่าสุด
        </h2>

        {queue.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            ยังไม่มีรายการใน Queue
          </p>
        ) : (
          <div className="space-y-2">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-md"
              >
                <span
                  className={`px-2 py-0.5 text-xs rounded-full font-bold ${statusColor(item.status)}`}
                >
                  {statusLabel(item.status)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-forest dark:text-slate-100 truncate">
                    {item.payload?.title ?? "—"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(item.created_at).toLocaleString("th-TH")}
                    {item.attempts > 0 && ` • พยายาม ${item.attempts} ครั้ง`}
                    {item.last_error && ` • ${item.last_error}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: "amber" | "green" | "red" | "blue";
  icon: string;
}) {
  const colorClasses = {
    amber: "bg-amber-50 text-amber-600 border-amber-200",
    green: "bg-meb-light text-meb-green border-meb-green/20",
    red: "bg-price-red/10 text-price-red border-price-red/20",
    blue: "bg-blue-50 text-blue-600 border-blue-200",
  };

  return (
    <div className={`rounded-lg border p-3 ${colorClasses[color]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <PhosphorIcon name={icon} weight="fill" className="text-sm" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}