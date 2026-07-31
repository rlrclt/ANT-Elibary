"use client";

import { useState, useTransition, useEffect } from "react";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import {
  getDropdownOptionsAction,
  addDropdownOptionAction,
  updateDropdownOptionAction,
  deleteDropdownOptionAction,
  type DropdownOption,
} from "../actions";

interface DropdownClientProps {
  initialDepartments: DropdownOption[];
  initialClassLevels: DropdownOption[];
  initialRoomLevels: DropdownOption[];
  initialError: string | null;
}

type TabKey = "departments" | "class_levels" | "room_levels";

const TAB_CONFIG = {
  departments: {
    label: "แผนกวิชา",
    icon: "buildings",
    placeholder: "เช่น เทคโนโลยีสารสนเทศ",
    description: "จัดการข้อมูลรายชื่อแผนกวิชา/สาขางานทั้งหมดของสถาบัน",
  },
  class_levels: {
    label: "ระดับชั้น",
    icon: "graduation-cap",
    placeholder: "เช่น ปวช. 1",
    description: "จัดการข้อมูลระดับชั้นการศึกษา (ปวช., ปวส., ม.ปลาย เป็นต้น)",
  },
  room_levels: {
    label: "ห้องเรียน",
    icon: "door",
    placeholder: "เช่น 121, 324",
    description: "จัดการข้อมูลห้องเรียนหรือกลุ่มเรียนสำหรับนักเรียนนักศึกษา",
  },
} as const;

export function DropdownClient({
  initialDepartments,
  initialClassLevels,
  initialRoomLevels,
  initialError,
}: DropdownClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("departments");
  const [departments, setDepartments] = useState<DropdownOption[]>(initialDepartments);
  const [classLevels, setClassLevels] = useState<DropdownOption[]>(initialClassLevels);
  const [roomLevels, setRoomLevels] = useState<DropdownOption[]>(initialRoomLevels);

  const [inputVal, setInputVal] = useState("");
  const [sortOrderVal, setSortOrderVal] = useState<number>(0);
  const [isActiveVal, setIsActiveVal] = useState<boolean>(true);
  const [editingOption, setEditingOption] = useState<DropdownOption | null>(null);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState<string | null>(null);

  // เมื่อเปลี่ยนแท็บ ให้ล้างค่าที่กรอกและโหมดแก้ไข
  useEffect(() => {
    setInputVal("");
    setSortOrderVal(0);
    setIsActiveVal(true);
    setEditingOption(null);
    setError(null);
    setSuccess(null);
  }, [activeTab]);

  function getActiveOptions(): DropdownOption[] {
    if (activeTab === "departments") return departments;
    if (activeTab === "class_levels") return classLevels;
    return roomLevels;
  }

  function showSuccessMessage(msg: string) {
    setSuccess(msg);
    setError(null);
    // เคลียร์ความสำเร็จใน 4 วินาที
    setTimeout(() => {
      setSuccess((prev) => (prev === msg ? null : prev));
    }, 4000);
  }

  // รีเฟรชข้อมูลล่าสุดจากเซิร์ฟเวอร์
  async function refreshData() {
    const res = await getDropdownOptionsAction();
    if (res.error) {
      setError(res.error);
      return;
    }
    setDepartments(res.departments);
    setClassLevels(res.classLevels);
    setRoomLevels(res.roomLevels);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmed = inputVal.trim();
    if (!trimmed) {
      setError("กรุณากรอกชื่อตัวเลือก");
      return;
    }

    startTransition(async () => {
      if (editingOption) {
        // โหมดแก้ไข
        const res = await updateDropdownOptionAction(
          activeTab,
          editingOption.id,
          trimmed,
          sortOrderVal,
          isActiveVal
        );
        if (!res.success) {
          setError(res.error);
          return;
        }
        showSuccessMessage(`แก้ไขข้อมูลเรียบร้อยแล้ว`);
        setEditingOption(null);
        setInputVal("");
        setSortOrderVal(0);
        setIsActiveVal(true);
      } else {
        // โหมดเพิ่มใหม่
        const res = await addDropdownOptionAction(activeTab, trimmed, sortOrderVal);
        if (!res.success) {
          setError(res.error);
          return;
        }
        showSuccessMessage(`เพิ่มตัวเลือก "${trimmed}" สำเร็จแล้ว`);
        setInputVal("");
        setSortOrderVal(0);
        setIsActiveVal(true);
      }
      await refreshData();
    });
  }

  function startEdit(option: DropdownOption) {
    setEditingOption(option);
    setInputVal(option.name);
    setSortOrderVal(option.sort_order ?? 0);
    setIsActiveVal(option.is_active ?? true);
    setError(null);
    setSuccess(null);
  }

  function cancelEdit() {
    setEditingOption(null);
    setInputVal("");
    setSortOrderVal(0);
    setIsActiveVal(true);
    setError(null);
  }

  function handleDelete(option: DropdownOption) {
    const config = TAB_CONFIG[activeTab];
    if (!confirm(`คุณต้องการลบตัวเลือก "${option.name}" จากข้อมูล ${config.label} ใช่หรือไม่?`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const res = await deleteDropdownOptionAction(activeTab, option.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      showSuccessMessage(`ลบตัวเลือก "${option.name}" เรียบร้อยแล้ว`);
      // ถ้ากำลังแก้ไขตัวเลือกที่ถูกลบอยู่ ให้ยกเลิกการแก้ไข
      if (editingOption?.id === option.id) {
        setEditingOption(null);
        setInputVal("");
        setSortOrderVal(0);
        setIsActiveVal(true);
      }
      await refreshData();
    });
  }

  function handleToggleActive(option: DropdownOption) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await updateDropdownOptionAction(
        activeTab,
        option.id,
        option.name,
        option.sort_order,
        !option.is_active
      );
      if (!res.success) {
        setError(res.error);
        return;
      }
      showSuccessMessage(
        `เปลี่ยนสถานะ "${option.name}" เป็น${!option.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน"}เรียบร้อยแล้ว`
      );
      await refreshData();
    });
  }

  function formatDate(dateStr: string) {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  }

  const activeConfig = TAB_CONFIG[activeTab];
  const activeOptions = getActiveOptions();

  return (
    <div className="space-y-6">
      {/* ส่วนหัวหน้าเว็บ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest dark:text-slate-100 flex items-center gap-2">
            <PhosphorIcon name="sliders" weight="fill" className="text-meb-green" />
            จัดการข้อมูลตัวเลือก
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ตั้งค่ารายการตัวเลือกสำหรับข้อมูลส่วนตัวตอนลงทะเบียนและหน้าโปรไฟล์ของสมาชิก
          </p>
        </div>
      </div>

      {/* แท็บเมนู */}
      <nav
        className="flex border-b border-gray-100 dark:border-border-base overflow-x-auto whitespace-nowrap hide-scrollbar"
        aria-label="แท็บเมนูจัดการตัวเลือก"
      >
        {(Object.keys(TAB_CONFIG) as TabKey[]).map((key) => {
          const config = TAB_CONFIG[key];
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-colors -mb-px border-b-2 ${
                active
                  ? "border-meb-green text-meb-green"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-forest dark:hover:text-slate-200"
              }`}
            >
              <PhosphorIcon name={config.icon} weight={active ? "fill" : "regular"} />
              {config.label}
              <span
                className={`ml-1 text-xs px-2 py-0.5 rounded-full font-bold ${
                  active
                    ? "bg-meb-green/10 text-meb-green"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {key === "departments"
                  ? departments.length
                  : key === "class_levels"
                  ? classLevels.length
                  : roomLevels.length}
              </span>
            </button>
          );
        })}
      </nav>

      {/* แจ้งเตือนสถานะการทำงาน (Error / Success) */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-price-red/10 border border-price-red/20 text-price-red rounded-xl text-sm leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
          <PhosphorIcon name="warning-circle" weight="fill" className="text-xl shrink-0" />
          <div className="flex-1 font-medium">{error}</div>
          <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100 transition">
            <PhosphorIcon name="x" weight="bold" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 p-4 bg-meb-light border border-meb-green/20 text-meb-green rounded-xl text-sm leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
          <PhosphorIcon name="check-circle" weight="fill" className="text-xl shrink-0" />
          <div className="flex-1 font-bold">{success}</div>
          <button onClick={() => setSuccess(null)} className="opacity-60 hover:opacity-100 transition">
            <PhosphorIcon name="x" weight="bold" />
          </button>
        </div>
      )}

      {/* เนื้อหารายละเอียดแท็บ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ฟอร์ม เพิ่ม/แก้ไข ข้อมูล */}
        <div className="lg:col-span-1 bg-white dark:bg-card-bg border border-gray-100 dark:border-border-base rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
          <div>
            <h2 className="text-base font-bold text-forest dark:text-slate-100 flex items-center gap-2">
              <PhosphorIcon
                name={editingOption ? "pencil" : "plus-circle"}
                weight="fill"
                className="text-meb-green"
              />
              {editingOption ? "แก้ไขตัวเลือก" : `เพิ่ม${activeConfig.label}ใหม่`}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {editingOption
                ? `แก้ไขชื่อรายการของข้อมูล ${activeConfig.label}`
                : activeConfig.description}
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="optionName"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                ชื่อตัวเลือก <span className="text-price-red">*</span>
              </label>
              <div className="relative">
                <PhosphorIcon
                  name={activeConfig.icon}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"
                />
                <input
                  id="optionName"
                  type="text"
                  placeholder={activeConfig.placeholder}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-black/20 border border-gray-200 dark:border-border-base rounded-xl outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100 transition placeholder:text-slate-400/80"
                  required
                  disabled={pending}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="sortOrder"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                ลำดับการจัดเรียง
              </label>
              <div className="relative">
                <PhosphorIcon
                  name="sort-ascending"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"
                />
                <input
                  id="sortOrder"
                  type="number"
                  placeholder="เช่น 0, 1, 2"
                  value={sortOrderVal}
                  onChange={(e) => setSortOrderVal(parseInt(e.target.value) || 0)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-black/20 border border-gray-200 dark:border-border-base rounded-xl outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100 transition placeholder:text-slate-400/80"
                  disabled={pending}
                />
              </div>
              <p className="text-xs text-slate-400">ใช้สำหรับจัดเรียงรายการในหน้าลงทะเบียน (ค่าน้อยจะแสดงก่อน)</p>
            </div>

            {editingOption && (
              <div className="flex items-center gap-2 py-1">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={isActiveVal}
                  onChange={(e) => setIsActiveVal(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-meb-green focus:ring-meb-light disabled:opacity-50"
                  disabled={pending}
                />
                <label
                  htmlFor="isActive"
                  className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                >
                  เปิดใช้งานข้อมูลนี้
                </label>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="submit"
                disabled={pending}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white bg-meb-green hover:bg-meb-hover rounded-xl shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending ? (
                  <PhosphorIcon name="circle-notch" className="animate-spin text-base" />
                ) : (
                  <PhosphorIcon name={editingOption ? "floppy-disk" : "plus"} weight="bold" />
                )}
                {editingOption ? "บันทึกการเปลี่ยนแปลง" : "เพิ่มตัวเลือก"}
              </button>

              {editingOption && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={pending}
                  className="inline-flex items-center justify-center gap-1 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-border-base rounded-xl transition disabled:opacity-50"
                >
                  ยกเลิก
                </button>
              )}
            </div>
          </form>
        </div>

        {/* รายการตัวเลือกที่มีอยู่ */}
        <div className="lg:col-span-2 bg-white dark:bg-card-bg border border-gray-100 dark:border-border-base rounded-2xl shadow-sm transition-colors overflow-hidden">
          <div className="p-5 border-b border-gray-50 dark:border-border-base flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-forest dark:text-slate-100">
                รายการข้อมูล {activeConfig.label}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                รายการตัวเลือกทั้งหมด มีจำนวน {activeOptions.length} รายการ (เรียงตาม ลำดับ และ ชื่อ)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {activeOptions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 space-y-2">
                <PhosphorIcon name="info" className="mx-auto opacity-60 text-3xl" />
                <p className="text-sm font-medium">ยังไม่มีรายการตัวเลือก</p>
                <p className="text-xs">กรอกแบบฟอร์มด้านข้างเพื่อเพิ่มตัวเลือกรายการแรก</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-black/20 border-b border-gray-100 dark:border-border-base text-slate-500 dark:text-slate-400 font-bold">
                    <th className="px-5 py-3 w-16 text-center">#</th>
                    <th className="px-5 py-3">ชื่อตัวเลือก</th>
                    <th className="px-5 py-3 w-24 text-center">ลำดับ</th>
                    <th className="px-5 py-3 w-28 text-center">สถานะ</th>
                    <th className="px-5 py-3 w-44">วันที่เพิ่ม</th>
                    <th className="px-5 py-3 w-32 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-border-base/50">
                  {activeOptions.map((opt, idx) => {
                    const isEditingThis = editingOption?.id === opt.id;
                    const isInactive = !opt.is_active;
                    return (
                      <tr
                        key={opt.id}
                        className={`hover:bg-slate-50/30 dark:hover:bg-white/2 transition ${
                          isEditingThis ? "bg-meb-green/5 dark:bg-meb-green/5 font-semibold" : ""
                        } ${isInactive ? "opacity-60 bg-slate-50/5 dark:bg-white/5" : ""}`}
                      >
                        <td className="px-5 py-3.5 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="px-5 py-3.5 text-forest dark:text-slate-100 font-medium">
                          {opt.name}
                        </td>
                        <td className="px-5 py-3.5 text-center font-mono text-slate-600 dark:text-slate-300">
                          {opt.sort_order}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => handleToggleActive(opt)}
                            disabled={pending}
                            title={opt.is_active ? "คลิกเพื่อปิดใช้งาน" : "คลิกเพื่อเปิดใช้งาน"}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition ${
                              opt.is_active
                                ? "bg-meb-light text-meb-green hover:bg-meb-green/20"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${opt.is_active ? "bg-meb-green" : "bg-slate-400"}`} />
                            {opt.is_active ? "ใช้งานอยู่" : "ปิดใช้งาน"}
                          </button>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-400 dark:text-slate-500 font-mono">
                          {formatDate(opt.created_at)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => startEdit(opt)}
                              disabled={pending}
                              title="แก้ไขข้อมูล"
                              className={`p-1.5 rounded-lg border transition ${
                                isEditingThis
                                  ? "bg-meb-green text-white border-meb-green"
                                  : "text-slate-500 border-gray-200 hover:border-meb-green hover:text-meb-green dark:border-border-base dark:hover:border-meb-green"
                              }`}
                            >
                              <PhosphorIcon name="pencil-simple" weight="bold" />
                            </button>
                            <button
                              onClick={() => handleDelete(opt)}
                              disabled={pending}
                              title="ลบตัวเลือก"
                              className="p-1.5 rounded-lg text-slate-500 border border-gray-200 hover:border-price-red hover:text-price-red dark:border-border-base dark:hover:border-price-red transition"
                            >
                              <PhosphorIcon name="trash" weight="bold" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
