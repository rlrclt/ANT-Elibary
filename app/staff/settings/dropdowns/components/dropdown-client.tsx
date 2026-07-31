"use client";

import { useState, useTransition, useEffect } from "react";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import {
  getDropdownOptionsAction,
  addDropdownOptionAction,
  updateDropdownOptionAction,
  deleteDropdownOptionAction,
  reorderDropdownOptionsAction,
  type DropdownOption,
} from "../actions";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

interface DropdownClientProps {
  initialDepartments: DropdownOption[];
  initialClassLevels: DropdownOption[];
  initialRoomLevels: DropdownOption[];
  initialClassGroups: DropdownOption[];
  initialError: string | null;
}

type TabKey = "departments" | "class_levels" | "room_levels" | "class_groups";

const TAB_CONFIG = {
  departments: {
    label: "แผนกวิชา",
    icon: "buildings",
    placeholder: "เช่น เทคโนโลยีสารสนเทศ",
    description: "จัดการข้อมูลรายชื่อแผนกวิชา/สาขางานทั้งหมดของสถาบัน",
    targets: ["student (นักศึกษา)", "teacher (ครู)", "staff (บุคลากร)"],
  },
  class_levels: {
    label: "ระดับชั้น",
    icon: "graduation-cap",
    placeholder: "เช่น ปวช. 1",
    description: "จัดการข้อมูลระดับชั้นการศึกษา (ปวช., ปวส., ม.ปลาย เป็นต้น)",
    targets: ["student (นักศึกษา)"],
  },
  room_levels: {
    label: "ห้องเรียน",
    icon: "door",
    placeholder: "เช่น 121, 324",
    description: "จัดการข้อมูลห้องเรียนหรือกลุ่มเรียนสำหรับนักเรียนนักศึกษา",
    targets: ["student (นักศึกษา)"],
  },
  class_groups: {
    label: "รหัสกลุ่มเรียน",
    icon: "users",
    placeholder: "เช่น IT-PVC1-01",
    description: "จัดการรหัสกลุ่มเรียน (Class Group Code) เชื่อมกับแผนกและระดับชั้น",
    targets: ["student (นักศึกษา)"],
  },
} as const;

export function DropdownClient({
  initialDepartments,
  initialClassLevels,
  initialRoomLevels,
  initialClassGroups,
  initialError,
}: DropdownClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("departments");
  const [departments, setDepartments] = useState<DropdownOption[]>(initialDepartments);
  const [classLevels, setClassLevels] = useState<DropdownOption[]>(initialClassLevels);
  const [roomLevels, setRoomLevels] = useState<DropdownOption[]>(initialRoomLevels);
  const [classGroups, setClassGroups] = useState<DropdownOption[]>(initialClassGroups);

  const [inputVal, setInputVal] = useState("");
  const [isActiveVal, setIsActiveVal] = useState<boolean>(true);
  const [editingOption, setEditingOption] = useState<DropdownOption | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>(TAB_CONFIG.departments.targets[0]);

  // Form states for class_groups
  const [formDeptId, setFormDeptId] = useState("");
  const [formClassLevelId, setFormClassLevelId] = useState("");
  const [formAcademicYear, setFormAcademicYear] = useState("");

  // Filter states for class_groups list
  const [filterDeptId, setFilterDeptId] = useState("");
  const [filterClassLevelId, setFilterClassLevelId] = useState("");

  // Drag-and-drop reorder state (local only until user saves)
  const [reorderedOptions, setReorderedOptions] = useState<DropdownOption[] | null>(null);
  const hasReorderChanges = reorderedOptions !== null;

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState<string | null>(null);

  // Set initial filter values when departments/classLevels are available
  useEffect(() => {
    if (departments.length > 0 && !filterDeptId) {
      setFilterDeptId(departments[0].id);
    }
  }, [departments, filterDeptId]);

  useEffect(() => {
    if (classLevels.length > 0 && !filterClassLevelId) {
      setFilterClassLevelId(classLevels[0].id);
    }
  }, [classLevels, filterClassLevelId]);

  // Sync form inputs with active filters when not in edit mode
  useEffect(() => {
    if (activeTab === "class_groups" && !editingOption) {
      setFormDeptId(filterDeptId);
    }
  }, [filterDeptId, activeTab, editingOption]);

  useEffect(() => {
    if (activeTab === "class_groups" && !editingOption) {
      setFormClassLevelId(filterClassLevelId);
    }
  }, [filterClassLevelId, activeTab, editingOption]);

  // เมื่อเปลี่ยนแท็บ ให้ล้างค่าที่กรอกและโหมดแก้ไข
  useEffect(() => {
    setInputVal("");
    setIsActiveVal(true);
    setEditingOption(null);
    setReorderedOptions(null);
    setSelectedRole(TAB_CONFIG[activeTab].targets[0]);
    if (activeTab === "class_groups") {
      setFormDeptId(filterDeptId || (departments[0]?.id ?? ""));
      setFormClassLevelId(filterClassLevelId || (classLevels[0]?.id ?? ""));
      setFormAcademicYear("2569");
    } else {
      setFormDeptId("");
      setFormClassLevelId("");
      setFormAcademicYear("");
    }
    setError(null);
    setSuccess(null);
  }, [activeTab, departments, classLevels, filterDeptId, filterClassLevelId]);

  function getActiveOptions(): DropdownOption[] {
    if (activeTab === "departments") return departments;
    if (activeTab === "class_levels") return classLevels;
    if (activeTab === "room_levels") return roomLevels;
    return classGroups;
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
    setClassGroups(res.classGroups || []);
  }

  // Reorder options via drag-and-drop (local only, user must click Save)
  function handleDragEnd(result: any) {
    const { source, destination } = result;
    if (!destination || source.index === destination.index) return;
    const currentList = reorderedOptions ?? filteredOptions;
    const reordered = Array.from(currentList);
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);
    setReorderedOptions(reordered);
  }

  // Save the reordered list to backend
  function handleSaveReorder() {
    if (!reorderedOptions) return;
    setError(null);
    startTransition(async () => {
      const orderedIds = reorderedOptions.map((o) => o.id);
      const res = await reorderDropdownOptionsAction(activeTab, orderedIds);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setReorderedOptions(null);
      showSuccessMessage("บันทึกลำดับใหม่เรียบร้อยแล้ว");
      await refreshData();
    });
  }

  // Undo drag reorder (revert to server order)
  function handleUndoReorder() {
    setReorderedOptions(null);
  }

  function handleRandomizeClassGroupCode() {
    const dept = departments.find((d) => d.id === formDeptId);
    const level = classLevels.find((c) => c.id === formClassLevelId);
    
    let deptCode = "GP";
    if (dept) {
      const name = dept.name;
      if (name.includes("สารสนเทศ")) deptCode = "IT";
      else if (name.includes("บัญชี")) deptCode = "AC";
      else if (name.includes("การตลาด")) deptCode = "MK";
      else if (name.includes("ไฟฟ้า")) deptCode = "EP";
      else if (name.includes("อิเล็ก")) deptCode = "EL";
      else if (name.includes("ยนต์")) deptCode = "ME";
      else if (name.includes("กลโรงงาน")) deptCode = "MC";
      else if (name.includes("เชื่อม")) deptCode = "WL";
      else if (name.includes("คอมพิวเตอร์")) deptCode = "BC";
      else if (name.includes("ก่อสร้าง")) deptCode = "CE";
      else if (name.includes("คหกรรม")) deptCode = "HE";
      else if (name.includes("ศิลป์")) deptCode = "FA";
      else {
        deptCode = name.slice(0, 2);
      }
    }

    let levelCode = "LV";
    if (level) {
      const name = level.name;
      if (name.includes("ปวช")) {
        const num = name.replace(/[^0-9]/g, "");
        levelCode = `PVC${num || "1"}`;
      } else if (name.includes("ปวส")) {
        const num = name.replace(/[^0-9]/g, "");
        levelCode = `PVS${num || "1"}`;
      } else {
        levelCode = name.replace(/[\s\.]/g, "").slice(0, 4);
      }
    }

    const yearSuffix = formAcademicYear ? formAcademicYear.slice(-2) : "69";
    const randNum = Math.floor(Math.random() * 90) + 10; // 10 - 99
    
    setInputVal(`${deptCode}-${levelCode}-${yearSuffix}-${randNum}`);
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

    // Auto-determine visible_to from current role filter
    const autoVisibleRoles = selectedRole ? [selectedRole] : [...activeConfig.targets];
    // Auto-calculate sort_order (max + 1 of current options)
    const currentOptions = getActiveOptions();
    const maxOrder = currentOptions.reduce((max, o) => Math.max(max, o.sort_order ?? 0), 0);

    if (activeTab === "class_groups" && (!formDeptId || !formClassLevelId)) {
      setError("กรุณาเลือกแผนกวิชาและระดับชั้น");
      return;
    }

    startTransition(async () => {
      if (editingOption) {
        // โหมดแก้ไข
        const res = await updateDropdownOptionAction(
          activeTab,
          editingOption.id,
          trimmed,
          editingOption.sort_order ?? maxOrder + 1,
          isActiveVal,
          autoVisibleRoles,
          activeTab === "class_groups" ? formDeptId : undefined,
          activeTab === "class_groups" ? formClassLevelId : undefined,
          activeTab === "class_groups" ? formAcademicYear : undefined
        );
        if (!res.success) {
          setError(res.error);
          return;
        }
        showSuccessMessage(`แก้ไขข้อมูลเรียบร้อยแล้ว`);
        setEditingOption(null);
        setInputVal("");
        setIsActiveVal(true);
      } else {
        // โหมดเพิ่มใหม่ — auto sort_order = maxOrder + 1
        const res = await addDropdownOptionAction(
          activeTab,
          trimmed,
          maxOrder + 1,
          autoVisibleRoles,
          activeTab === "class_groups" ? formDeptId : undefined,
          activeTab === "class_groups" ? formClassLevelId : undefined,
          activeTab === "class_groups" ? formAcademicYear : undefined
        );
        if (!res.success) {
          setError(res.error);
          return;
        }
        showSuccessMessage(`เพิ่มตัวเลือก "${trimmed}" สำเร็จแล้ว`);
        setInputVal("");
        setIsActiveVal(true);
      }
      setReorderedOptions(null);
      await refreshData();
    });
  }

  function startEdit(option: DropdownOption) {
    setEditingOption(option);
    setInputVal(option.name);
    setIsActiveVal(option.is_active ?? true);
    if (activeTab === "class_groups") {
      setFormDeptId(option.department_id ?? "");
      setFormClassLevelId(option.class_level_id ?? "");
      setFormAcademicYear(option.academic_year ?? "");
    }
    setError(null);
    setSuccess(null);
  }

  function cancelEdit() {
    setEditingOption(null);
    setInputVal("");
    setIsActiveVal(true);
    if (activeTab === "class_groups") {
      setFormDeptId(filterDeptId);
      setFormClassLevelId(filterClassLevelId);
      setFormAcademicYear("2569");
    }
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
        setIsActiveVal(true);
      }
      setReorderedOptions(null);
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
        !option.is_active,
        option.visible_to
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
  let baseFiltered = selectedRole ? activeOptions.filter((opt) => opt.visible_to?.includes(selectedRole)) : activeOptions;

  if (activeTab === "class_groups") {
    if (filterDeptId) {
      baseFiltered = baseFiltered.filter((opt) => opt.department_id === filterDeptId);
    }
    if (filterClassLevelId) {
      baseFiltered = baseFiltered.filter((opt) => opt.class_level_id === filterClassLevelId);
    }
  }

  // Use reordered list if user has dragged, otherwise use server order
  const filteredOptions = reorderedOptions ?? baseFiltered;

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
                  : key === "room_levels"
                  ? roomLevels.length
                  : classGroups.length}
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

      {/* Filter Row */}
      <div className="mt-2 mb-4 flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-white/[0.02] p-3 rounded-xl border border-gray-100 dark:border-border-base">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">กลุ่มผู้ใช้:</label>
          <select
            value={selectedRole}
            onChange={(e) => { setSelectedRole(e.target.value); setReorderedOptions(null); }}
            className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-card-bg border-gray-200 dark:border-border-base focus:outline-none focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-200"
          >
            {activeConfig.targets.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        {activeTab === "class_groups" && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">แผนกวิชา:</label>
              <select
                value={filterDeptId}
                onChange={(e) => { setFilterDeptId(e.target.value); setReorderedOptions(null); }}
                className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-card-bg border-gray-200 dark:border-border-base focus:outline-none focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-200"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ระดับชั้น:</label>
              <select
                value={filterClassLevelId}
                onChange={(e) => { setFilterClassLevelId(e.target.value); setReorderedOptions(null); }}
                className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-card-bg border-gray-200 dark:border-border-base focus:outline-none focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-200"
              >
                {classLevels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

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
            {/* แสดง role ที่กำลังกรองอยู่ */}
            {selectedRole && (
              <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-border-base/50">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                  เพิ่มให้กลุ่ม:
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-meb-light text-meb-green border border-meb-green/10">
                  {selectedRole}
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {activeTab === "class_groups" && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="formDept" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    แผนกวิชา <span className="text-price-red">*</span>
                  </label>
                  <select
                    id="formDept"
                    value={formDeptId}
                    onChange={(e) => setFormDeptId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-black/20 border border-gray-200 dark:border-border-base rounded-xl outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100 transition"
                    required
                    disabled={pending}
                  >
                    <option value="">-- เลือกแผนกวิชา --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="formClassLevel" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ระดับชั้น <span className="text-price-red">*</span>
                  </label>
                  <select
                    id="formClassLevel"
                    value={formClassLevelId}
                    onChange={(e) => setFormClassLevelId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-black/20 border border-gray-200 dark:border-border-base rounded-xl outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100 transition"
                    required
                    disabled={pending}
                  >
                    <option value="">-- เลือกระดับชั้น --</option>
                    {classLevels.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="formAcademicYear" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ปีการศึกษา <span className="text-price-red">*</span>
                  </label>
                  <input
                    id="formAcademicYear"
                    type="text"
                    placeholder="เช่น 2569"
                    value={formAcademicYear}
                    onChange={(e) => setFormAcademicYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-black/20 border border-gray-200 dark:border-border-base rounded-xl outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100 transition"
                    required
                    disabled={pending}
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="optionName"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
                >
                  {activeTab === "class_groups" ? "รหัสกลุ่มเรียน" : "ชื่อตัวเลือก"} <span className="text-price-red">*</span>
                </label>
                {activeTab === "class_groups" && (
                  <button
                    type="button"
                    onClick={handleRandomizeClassGroupCode}
                    className="text-xs font-bold text-meb-green hover:text-meb-hover flex items-center gap-1 transition cursor-pointer"
                  >
                    <PhosphorIcon name="shuffle" weight="bold" />
                    สุ่มรหัส
                  </button>
                )}
              </div>
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
                รายการตัวเลือกทั้งหมด มีจำนวน {filteredOptions.length} รายการ — ลากเพื่อจัดลำดับ
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 space-y-2">
                <PhosphorIcon name="info" className="mx-auto opacity-60 text-3xl" />
                <p>ไม่มีตัวเลือก</p>
              </div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="dropdown-options">
                  {(provided) => (
                    <table className="w-full text-sm" ref={provided.innerRef} {...provided.droppableProps}>
                      <thead>
                        <tr className="bg-gray-50/80 dark:bg-white/5 border-b border-gray-100 dark:border-border-base text-left">
                          <th className="px-5 py-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 w-10"></th>
                          <th className="px-5 py-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">ลำดับ</th>
                          <th className="px-5 py-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                            {activeTab === "class_groups" ? "รหัสกลุ่มเรียน" : "ชื่อตัวเลือก"}
                          </th>
                          {activeTab === "class_groups" ? (
                            <>
                              <th className="px-5 py-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">แผนกวิชา</th>
                              <th className="px-5 py-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">ระดับชั้น</th>
                              <th className="px-5 py-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">ปีการศึกษา</th>
                            </>
                          ) : (
                            <th className="px-5 py-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">กลุ่มที่มองเห็น</th>
                          )}
                          <th className="px-5 py-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 text-center">สถานะ</th>
                          <th className="px-5 py-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 text-center">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOptions.map((opt, index) => {
                          const isEditingThis = editingOption?.id === opt.id;
                          return (
                            <Draggable key={opt.id} draggableId={opt.id} index={index}>
                              {(dragProvided, snapshot) => (
                                <tr
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  className={`border-b border-gray-50 dark:border-border-base/50 transition-colors ${
                                    snapshot.isDragging
                                      ? "bg-meb-light/40 dark:bg-meb-green/10 shadow-lg"
                                      : isEditingThis
                                      ? "bg-meb-light/30 dark:bg-meb-green/5"
                                      : "hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
                                  }`}
                                >
                                  {/* Drag handle */}
                                  <td className="px-3 py-3.5" {...dragProvided.dragHandleProps}>
                                    <PhosphorIcon name="dots-six-vertical" weight="bold" className="text-slate-400 hover:text-meb-green cursor-grab active:cursor-grabbing transition-colors" />
                                  </td>
                                  {/* ลำดับ */}
                                  <td className="px-5 py-3.5">
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/10 text-xs font-bold text-slate-600 dark:text-slate-300">
                                      {index + 1}
                                    </span>
                                  </td>
                                  {/* ชื่อตัวเลือก */}
                                  <td className="px-5 py-3.5">
                                    <span className={`font-semibold ${isEditingThis ? "text-meb-green" : "text-forest dark:text-slate-100"}`}>
                                      {opt.name}
                                    </span>
                                  </td>
                                  {/* กลุ่มที่มองเห็น / แผนกวิชา & ระดับชั้น */}
                                  {activeTab === "class_groups" ? (
                                    <>
                                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                                        {departments.find((d) => d.id === opt.department_id)?.name || opt.department_id || "—"}
                                      </td>
                                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                                        {classLevels.find((c) => c.id === opt.class_level_id)?.name || opt.class_level_id || "—"}
                                      </td>
                                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                                        {opt.academic_year || "—"}
                                      </td>
                                    </>
                                  ) : (
                                    <td className="px-5 py-3.5">
                                      <div className="flex flex-wrap gap-1">
                                        {opt.visible_to && opt.visible_to.length > 0 ? (
                                          opt.visible_to.map((role) => (
                                            <span key={role} className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-meb-light text-meb-green border border-meb-green/10">
                                              {role}
                                            </span>
                                          ))
                                        ) : (
                                          <span className="text-[10px] text-slate-400">—</span>
                                        )}
                                      </div>
                                    </td>
                                  )}
                                  {/* สถานะ */}
                                  <td className="px-5 py-3.5 text-center">
                                    <button
                                      onClick={() => handleToggleActive(opt)}
                                      disabled={pending}
                                      className={`text-xs px-3 py-1 rounded-full font-bold transition ${
                                        opt.is_active
                                          ? "bg-meb-light text-meb-green border border-meb-green/20"
                                          : "bg-gray-100 text-slate-400 border border-gray-200 dark:bg-white/5 dark:border-border-base"
                                      }`}
                                    >
                                      {opt.is_active ? "ใช้งานอยู่" : "ปิดใช้งาน"}
                                    </button>
                                  </td>
                                  {/* จัดการ */}
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
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </tbody>
                    </table>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>

          {/* Save / Undo reorder bar */}
          {hasReorderChanges && (
            <div className="px-5 py-3 border-t border-gray-100 dark:border-border-base flex items-center justify-between bg-amber-50/80 dark:bg-amber-900/10">
              <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                <PhosphorIcon name="warning" weight="fill" className="text-base" />
                <span className="font-medium">มีการเปลี่ยนลำดับที่ยังไม่ได้บันทึก</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUndoReorder}
                  disabled={pending}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-white/10 border border-gray-200 dark:border-border-base rounded-lg hover:bg-gray-50 dark:hover:bg-white/15 transition disabled:opacity-50"
                >
                  <PhosphorIcon name="arrow-counter-clockwise" weight="bold" />
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveReorder}
                  disabled={pending}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-meb-green hover:bg-meb-hover rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {pending ? (
                    <PhosphorIcon name="circle-notch" className="animate-spin" />
                  ) : (
                    <PhosphorIcon name="floppy-disk" weight="bold" />
                  )}
                  บันทึกลำดับ
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
