"use client";

import { useState, useTransition } from "react";
import { Modal } from "../../../components/modal";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  type Category,
} from "../actions";

type CategoryManagerModalProps = {
  open: boolean;
  onClose: () => void;
  categories: Category[];
};

/** ตัวเลือกสี preset สำหรับหมวดหมู่ */
const COLOR_PRESETS = [
  "#60a5fa", // blue
  "#00a651", // meb green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#64748b", // slate
];

export function CategoryManagerModal({
  open,
  onClose,
  categories,
}: CategoryManagerModalProps) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setEditing(null);
    setName("");
    setColor(COLOR_PRESETS[0]);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function startEdit(cat: Category) {
    setEditing(cat);
    setName(cat.name);
    setColor(cat.color_code ?? COLOR_PRESETS[0]);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) return;

    // เช็คหมวดหมู่ซ้ำ (Case-insensitive)
    const isDuplicate = categories.some(
      (c) =>
        c.name.toLowerCase() === trimmedName.toLowerCase() &&
        c.id !== editing?.id,
    );
    if (isDuplicate) {
      setError(`หมวดหมู่ "${trimmedName}" มีในระบบเรียบร้อยแล้ว`);
      return;
    }

    const formData = new FormData();
    formData.set("name", trimmedName);
    formData.set("color_code", color);
    if (editing) formData.set("id", editing.id);

    startTransition(async () => {
      const action = editing ? updateCategoryAction : createCategoryAction;
      const result = await action(formData);
      if (result.error) {
        setError(result.error);
      } else {
        reset();
      }
    });
  }

  function handleDelete(cat: Category) {
    if (!confirm(`ต้องการลบหมวดหมู่ "${cat.name}" ใช่ไหม?`)) return;
    const formData = new FormData();
    formData.set("id", cat.id);
    startTransition(async () => {
      const result = await deleteCategoryAction(formData);
      if (result.error) setError(result.error);
    });
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="จัดการหมวดหมู่หนังสือ"
      description="เพิ่ม แก้ไข ลบ และกำหนดสีหมวดหมู่"
      size="md"
    >
      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 bg-price-red/10 border border-price-red/30 text-price-red text-sm px-3 py-2.5 rounded-md">
          <PhosphorIcon name="warning-circle" weight="fill" />
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="mb-3">
          <label className="block text-sm font-medium text-forest dark:text-slate-200 mb-1.5">
            {editing ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่ใหม่"}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น คอมพิวเตอร์"
            required
            className="w-full px-3 py-2.5 text-sm bg-white dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light dark:text-slate-100"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-forest dark:text-slate-200 mb-1.5">
            สีประจำหมวด
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 transition shrink-0 ${
                  color.toLowerCase() === c.toLowerCase()
                    ? "border-slate-800 dark:border-white scale-110 shadow-sm"
                    : "border-transparent opacity-80 hover:opacity-100"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`สี ${c}`}
              />
            ))}

            {/* Custom Color Picker & Hex Input */}
            <div className="flex items-center gap-2 ml-1 pl-3 border-l border-gray-200 dark:border-border-base">
              <label
                htmlFor="custom-color"
                className="w-8 h-8 rounded-full cursor-pointer border-2 border-dashed border-gray-300 dark:border-slate-600 flex items-center justify-center overflow-hidden hover:scale-105 transition shrink-0"
                title="เลือกสีเอง (Custom Color)"
              >
                <input
                  id="custom-color"
                  type="color"
                  value={color.startsWith("#") ? color : "#60a5fa"}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 -m-2 cursor-pointer"
                />
              </label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#60a5fa"
                maxLength={7}
                className="w-24 px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green uppercase text-forest dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="btn-cta inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-2 rounded-md text-sm disabled:opacity-60"
          >
            <PhosphorIcon name={editing ? "pencil-simple" : "plus"} weight="bold" />
            {editing ? "บันทึก" : "เพิ่ม"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition"
            >
              ยกเลิกแก้ไข
            </button>
          )}
        </div>
      </form>

      {/* List */}
      <div className="border-t border-gray-100 dark:border-border-base pt-4">
        <h3 className="text-sm font-bold text-forest dark:text-slate-200 mb-3">
          หมวดหมู่ทั้งหมด ({categories.length})
        </h3>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {categories.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">
              ยังไม่มีหมวดหมู่
            </p>
          ) : (
            categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color_code ?? "#60a5fa" }}
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                    {cat.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(cat)}
                    className="p-1.5 text-slate-400 hover:text-meb-green hover:bg-meb-light/50 rounded transition"
                    aria-label="แก้ไข"
                  >
                    <PhosphorIcon name="pencil-simple" className="text-sm" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    className="p-1.5 text-slate-400 hover:text-price-red hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                    aria-label="ลบ"
                  >
                    <PhosphorIcon name="trash" className="text-sm" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}