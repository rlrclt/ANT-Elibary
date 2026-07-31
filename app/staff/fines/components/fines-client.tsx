"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import {
  getFineSettingsAction,
  updateFineSettingsAction,
  getPaymentMethodsAction,
  createPaymentMethodAction,
  updatePaymentMethodAction,
  deletePaymentMethodAction,
  getPendingFinesAction,
  approveFineAction,
  rejectFineAction,
  type FineSettings,
  type PaymentMethod,
  type PendingFine,
} from "../actions";

type TabKey = "settings" | "payments" | "pending";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "settings", label: "ตั้งค่าค่าปรับ", icon: "gear" },
  { key: "payments", label: "วิธีการชำระ", icon: "qr-code" },
  { key: "pending", label: "ค่าปรับรออนุมัติ", icon: "clock-clockwise" },
];

export function FinesClient() {
  const [tab, setTab] = useState<TabKey>("settings");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // settings state
  const [settings, setSettings] = useState<FineSettings | null>(null);

  // payment methods state
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [showMethodForm, setShowMethodForm] = useState(false);

  // pending fines state
  const [pendingFines, setPendingFines] = useState<PendingFine[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // ---------- loaders ----------
  async function loadSettings() {
    const res = await getFineSettingsAction();
    if (res.error) {
      setError(res.error);
      return;
    }
    setSettings(res.data);
  }

  async function loadMethods() {
    const res = await getPaymentMethodsAction();
    if (res.error) {
      setError(res.error);
      return;
    }
    setMethods(res.data ?? []);
  }

  async function loadPendingFines() {
    const res = await getPendingFinesAction();
    if (res.error) {
      setError(res.error);
      return;
    }
    setPendingFines(res.data ?? []);
  }

  useEffect(() => {
    loadSettings();
    loadMethods();
    loadPendingFines();
  }, []);

  // ---------- helpers ----------
  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  function clearError() {
    setError(null);
  }

  // ---------- settings handlers ----------
  function handleSaveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearError();
    const formData = new FormData(e.currentTarget);
    if (settings) formData.set("id", settings.id);

    startTransition(async () => {
      const res = await updateFineSettingsAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      showSuccess("บันทึกการตั้งค่าค่าปรับสำเร็จ");
      await loadSettings();
    });
  }

  // ---------- payment method handlers ----------
  function handleCreateMethod(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearError();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await createPaymentMethodAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      showSuccess("เพิ่มวิธีการชำระสำเร็จ");
      setShowMethodForm(false);
      await loadMethods();
    });
  }

  function handleUpdateMethod(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingMethod) return;
    clearError();
    const formData = new FormData(e.currentTarget);
    formData.set("id", editingMethod.id);

    startTransition(async () => {
      const res = await updatePaymentMethodAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      showSuccess("แก้ไขวิธีการชำระสำเร็จ");
      setEditingMethod(null);
      setShowMethodForm(false);
      await loadMethods();
    });
  }

  function handleDeleteMethod(id: string, name: string) {
    if (!confirm(`ต้องการลบวิธีการชำระ "${name}" ใช่หรือไม่?`)) return;
    clearError();
    const formData = new FormData();
    formData.set("id", id);

    startTransition(async () => {
      const res = await deletePaymentMethodAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      showSuccess("ลบวิธีการชำระสำเร็จ");
      await loadMethods();
    });
  }

  // ---------- pending fine handlers ----------
  function handleApproveFine(id: string) {
    clearError();
    const formData = new FormData();
    formData.set("id", id);

    startTransition(async () => {
      const res = await approveFineAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      showSuccess("อนุมัติค่าปรับสำเร็จ");
      await loadPendingFines();
    });
  }

  function handleRejectFine(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearError();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await rejectFineAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      showSuccess("ปฏิเสธค่าปรับสำเร็จ");
      setRejectingId(null);
      await loadPendingFines();
    });
  }

  // ---------- render ----------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Link
          href="/staff"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-meb-green hover:bg-gray-100 dark:text-slate-400 dark:hover:text-meb-green dark:hover:bg-white/10 transition-all duration-200"
          title="ย้อนกลับไปหน้าเจ้าหน้าที่"
        >
          <PhosphorIcon name="arrow-left" className="text-xl" weight="bold" />
        </Link>
        <PhosphorIcon name="currency-circle-dollar" weight="fill" className="text-2xl text-meb-green" />
        <h1 className="text-lg md:text-xl font-bold text-forest dark:text-slate-100">
          ตั้งค่าค่าปรับ
        </h1>
      </div>

      {/* Alert */}
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

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-border-base">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 transition ${
              tab === t.key
                ? "text-meb-green border-meb-green"
                : "text-slate-500 border-transparent hover:text-forest dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            <PhosphorIcon name={t.icon} weight={tab === t.key ? "fill" : "regular"} />
            {t.label}
            {t.key === "pending" && pendingFines.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-price-red rounded-full">
                {pendingFines.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "settings" && (
        <SettingsTab
          settings={settings}
          pending={pending}
          onSubmit={handleSaveSettings}
        />
      )}

      {tab === "payments" && (
        <div className="space-y-4">
          {/* Add button */}
          <div className="flex items-center justify-end">
            <button
              onClick={() => {
                setEditingMethod(null);
                setShowMethodForm(true);
              }}
              className="inline-flex items-center gap-2 text-sm font-bold text-white bg-meb-green hover:bg-meb-hover px-4 py-2.5 rounded-md transition"
            >
              <PhosphorIcon name="plus" weight="bold" />
              เพิ่มวิธีการชำระ
            </button>
          </div>

          {/* Form */}
          {showMethodForm && (
            <PaymentMethodForm
              method={editingMethod}
              pending={pending}
              onSubmit={editingMethod ? handleUpdateMethod : handleCreateMethod}
              onCancel={() => {
                setShowMethodForm(false);
                setEditingMethod(null);
              }}
            />
          )}

          {/* List */}
          <div className="space-y-3">
            {methods.length === 0 && !showMethodForm ? (
              <div className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-12 text-center">
                <PhosphorIcon
                  name="qr-code"
                  weight="fill"
                  className="text-4xl text-slate-300 dark:text-slate-600 mx-auto mb-3"
                />
                <p className="text-sm text-slate-400">ยังไม่มีวิธีการชำระ</p>
                <p className="text-xs text-slate-400 mt-1">
                  กดปุ่ม &quot;เพิ่มวิธีการชำระ&quot; เพื่อสร้างใหม่
                </p>
              </div>
            ) : (
              methods.map((method) => (
                <PaymentMethodRow
                  key={method.id}
                  method={method}
                  pending={pending}
                  onEdit={() => {
                    setEditingMethod(method);
                    setShowMethodForm(true);
                  }}
                  onDelete={() => handleDeleteMethod(method.id, method.name)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {tab === "pending" && (
        <div className="space-y-3">
          {pendingFines.length === 0 ? (
            <div className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-12 text-center">
              <PhosphorIcon
                name="check-circle"
                weight="fill"
                className="text-4xl text-slate-300 dark:text-slate-600 mx-auto mb-3"
              />
              <p className="text-sm text-slate-400">ไม่มีค่าปรับรออนุมัติ</p>
            </div>
          ) : (
            pendingFines.map((fine) => (
              <PendingFineRow
                key={fine.id}
                fine={fine}
                pending={pending}
                rejectingId={rejectingId}
                onApprove={() => handleApproveFine(fine.id)}
                onReject={handleRejectFine}
                onCancelReject={() => setRejectingId(null)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------- SettingsTab ----------
function SettingsTab({
  settings,
  pending,
  onSubmit,
}: {
  settings: FineSettings | null;
  pending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-5 shadow-sm space-y-5"
    >
      <h2 className="text-base font-bold text-forest dark:text-slate-100">
        ตั้งค่าอัตราค่าปรับ
      </h2>

      {/* Overdue settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
            อัตราค่าปรับล่าช้า (บาท/วัน)
          </label>
          <input
            type="number"
            name="overdue_rate"
            required
            min={0}
            step="0.01"
            defaultValue={settings?.overdue_rate ?? 5}
            className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
            จำนวนวันสูงสุด (ถ้าเกิน → ปรับเต็มราคาเล่ม)
          </label>
          <input
            type="number"
            name="overdue_max_days"
            required
            min={0}
            step="1"
            defaultValue={settings?.overdue_max_days ?? 30}
            className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
          />
        </div>
      </div>

      {/* Damage settings */}
      <div className="pt-3 border-t border-gray-100 dark:border-border-base">
        <h3 className="text-sm font-bold text-forest dark:text-slate-100 mb-3">
          เปอร์เซ็นต์ค่าปรับตามสภาพหนังสือ (% ของราคาเล่ม)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
              มือหนึ่ง (New)
            </label>
            <input
              type="number"
              name="damage_new_pct"
              required
              min={0}
              max={100}
              step="0.01"
              defaultValue={settings?.damage_new_pct ?? 0}
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
              สภาพดี (Good)
            </label>
            <input
              type="number"
              name="damage_good_pct"
              required
              min={0}
              max={100}
              step="0.01"
              defaultValue={settings?.damage_good_pct ?? 50}
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
              พอใช้ (Fair)
            </label>
            <input
              type="number"
              name="damage_fair_pct"
              required
              min={0}
              max={100}
              step="0.01"
              defaultValue={settings?.damage_fair_pct ?? 75}
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
              ชำรุด (Poor)
            </label>
            <input
              type="number"
              name="damage_poor_pct"
              required
              min={0}
              max={100}
              step="0.01"
              defaultValue={settings?.damage_poor_pct ?? 100}
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 text-sm font-bold text-white bg-meb-green hover:bg-meb-hover px-5 py-2.5 rounded-md transition disabled:opacity-60"
        >
          <PhosphorIcon name="check" weight="bold" />
          บันทึก
        </button>
      </div>
    </form>
  );
}

// ---------- PaymentMethodForm ----------
function PaymentMethodForm({
  method,
  pending,
  onSubmit,
  onCancel,
}: {
  method: PaymentMethod | null;
  pending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(method?.qr_image_url ?? null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-5 shadow-sm space-y-4"
    >
      <h2 className="text-base font-bold text-forest dark:text-slate-100">
        {method ? "แก้ไขวิธีการชำระ" : "เพิ่มวิธีการชำระใหม่"}
      </h2>

      {/* QR image */}
      <div>
        <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
          QR Code
        </label>
        <div className="flex items-start gap-4">
          <div className="w-32 h-32 rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-800 shrink-0">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="QR preview"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <PhosphorIcon name="qr-code" weight="fill" className="text-3xl" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleFileChange}
              name="qr_image"
              className="hidden"
              id="qr-image-upload"
            />
            <label
              htmlFor="qr-image-upload"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-meb-green bg-meb-light hover:bg-meb-light/70 px-3 py-2 rounded-md transition cursor-pointer"
            >
              <PhosphorIcon name="upload-simple" weight="bold" className="text-sm" />
              {method?.qr_image_url ? "เปลี่ยน QR" : "เลือก QR"}
            </label>
            <p className="text-xs text-slate-400 mt-1.5">
              JPEG, PNG (สูงสุด 2MB)
            </p>
          </div>
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
          ชื่อบัญชี *
        </label>
        <input
          type="text"
          name="name"
          required
          defaultValue={method?.name ?? ""}
          placeholder="เช่น ธนาคารกสิกรไทย"
          className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
        />
      </div>

      {/* Account name */}
      <div>
        <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
          ชื่อเจ้าของบัญชี
        </label>
        <input
          type="text"
          name="account_name"
          defaultValue={method?.account_name ?? ""}
          placeholder="ชื่อ-นามสกุล"
          className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
        />
      </div>

      {/* Account number */}
      <div>
        <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
          เลขบัญชี
        </label>
        <input
          type="text"
          name="account_number"
          defaultValue={method?.account_number ?? ""}
          placeholder="เลขบัญชีธนาคาร"
          className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
        />
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 text-sm font-bold text-white bg-meb-green hover:bg-meb-hover px-5 py-2.5 rounded-md transition disabled:opacity-60"
        >
          <PhosphorIcon name="check" weight="bold" />
          {method ? "บันทึก" : "เพิ่ม"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-forest dark:text-slate-400 px-4 py-2.5 rounded-md transition"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  );
}

// ---------- PaymentMethodRow ----------
function PaymentMethodRow({
  method,
  pending,
  onEdit,
  onDelete,
}: {
  method: PaymentMethod;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-4 shadow-sm flex items-center gap-4">
      {/* QR image */}
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-800 shrink-0">
        {method.qr_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={method.qr_image_url}
            alt={method.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <PhosphorIcon name="qr-code" weight="fill" className="text-lg" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold text-forest dark:text-slate-100 truncate">
          {method.name}
        </h3>
        {method.account_name && (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {method.account_name}
          </p>
        )}
        {method.account_number && (
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
            เลขบัญชี: {method.account_number}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEdit}
          disabled={pending}
          className="p-1.5 text-slate-400 hover:text-meb-green transition"
          title="แก้ไข"
        >
          <PhosphorIcon name="pencil-simple" weight="bold" />
        </button>
        <button
          onClick={onDelete}
          disabled={pending}
          className="p-1.5 text-slate-400 hover:text-price-red transition"
          title="ลบ"
        >
          <PhosphorIcon name="trash" weight="bold" />
        </button>
      </div>
    </div>
  );
}

// ---------- PendingFineRow ----------
function PendingFineRow({
  fine,
  pending,
  rejectingId,
  onApprove,
  onReject,
  onCancelReject,
}: {
  fine: PendingFine;
  pending: boolean;
  rejectingId: string | null;
  onApprove: () => void;
  onReject: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancelReject: () => void;
}) {
  const isRejecting = rejectingId === fine.id;
  const fineTypeLabel: Record<string, string> = {
    overdue: "คืนล่าช้า",
    damaged: "หนังสือเสียหาย",
    lost: "หนังสือสูญหาย",
    other: "อื่นๆ",
  };

  return (
    <div className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-4 shadow-sm space-y-3">
      {/* Main info */}
      <div className="flex items-start gap-4">
        {/* Slip image */}
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-800 shrink-0">
          {fine.slip_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fine.slip_url}
              alt="สลิป"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <PhosphorIcon name="receipt" weight="fill" className="text-lg" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-forest dark:text-slate-100 truncate">
              {fine.user?.full_name ?? "ไม่ระบุชื่อ"}
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-bold text-meb-green bg-meb-light rounded-full">
              {fine.user?.user_id_code ?? "-"}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-0.5 text-xs font-bold text-white bg-price-red rounded-full">
              {fineTypeLabel[fine.fine_type] ?? fine.fine_type}
            </span>
            <span className="text-sm font-bold text-forest dark:text-slate-100">
              ฿{fine.amount.toLocaleString()}
            </span>
          </div>
          {fine.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {fine.description}
            </p>
          )}
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            แจ้งเมื่อ {new Date(fine.created_at).toLocaleDateString("th-TH", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      {/* Reject form */}
      {isRejecting ? (
        <form onSubmit={onReject} className="space-y-2 pt-2 border-t border-gray-100 dark:border-border-base">
          <input type="hidden" name="id" value={fine.id} />
          <label className="block text-xs font-medium text-forest dark:text-slate-100">
            เหตุผลที่ปฏิเสธ
          </label>
          <textarea
            name="review_note"
            rows={2}
            placeholder="ระบุเหตุผลที่ปฏิเสธการชำระ..."
            className="w-full px-3 py-2 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100 resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-price-red hover:bg-price-red/80 px-4 py-2 rounded-md transition disabled:opacity-60"
            >
              <PhosphorIcon name="x" weight="bold" />
              ยืนยันปฏิเสธ
            </button>
            <button
              type="button"
              onClick={onCancelReject}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-forest dark:text-slate-400 px-4 py-2 rounded-md transition"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      ) : (
        /* Approve / Reject buttons */
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-border-base">
          <button
            onClick={onApprove}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-meb-green hover:bg-meb-hover px-4 py-2 rounded-md transition disabled:opacity-60"
          >
            <PhosphorIcon name="check" weight="bold" />
            อนุมัติ
          </button>
          <button
            onClick={() => onCancelReject()}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-price-red bg-price-red/10 hover:bg-price-red/20 px-4 py-2 rounded-md transition disabled:opacity-60"
          >
            <PhosphorIcon name="x" weight="bold" />
            ปฏิเสธ
          </button>
        </div>
      )}
    </div>
  );
}