import { PhosphorIcon } from "./phosphor-icon";
import type { InputHTMLAttributes, ReactNode } from "react";

/**
 * Form controls สำหรับหน้า auth — อิง meb tokens
 * - Label ชิดซ้ายตาม F-pattern
 * - Input มี focus ring สีเขียวอ่อน (meb-light) ตาม design-tokens
 * - Password input มีปุ่ม toggle ตา
 */

type TextFieldProps = {
  label: string;
  name: string;
  type?: "text" | "email" | "password" | "tel";
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  icon?: string; // phosphor icon name นำหน้า input
  helper?: ReactNode;
  defaultValue?: string;
};

export function TextField({
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
  required,
  icon,
  helper,
  defaultValue,
}: TextFieldProps) {
  return (
    <div className="mb-4">
      <label
        htmlFor={name}
        className="block text-sm font-medium text-forest mb-1.5"
      >
        {label}
        {required && <span className="text-terracotta ml-0.5">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <PhosphorIcon
            name={icon}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"
          />
        )}
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          defaultValue={defaultValue}
          className={`w-full ${icon ? "pl-10" : "pl-3"} pr-3 py-2.5 text-sm bg-white border border-gray-200 rounded-md outline-none transition focus:border-meb-green focus:ring-2 focus:ring-meb-light placeholder:text-slate-400`}
        />
      </div>
      {helper && <p className="text-xs text-slate-500 mt-1.5">{helper}</p>}
    </div>
  );
}

type SubmitButtonProps = {
  children: ReactNode;
  loading?: boolean;
};

export function SubmitButton({ children, loading }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="btn-cta spotlight w-full inline-flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta-hover text-white font-bold px-6 py-3 rounded-md text-sm shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <PhosphorIcon name="circle-notch" className="animate-spin" />
          กำลังดำเนินการ...
        </>
      ) : (
        children
      )}
    </button>
  );
}

type SelectFieldProps = {
  label: string;
  name: string;
  options: (string | { value: string; label: string })[];
  required?: boolean;
  icon?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  helper?: ReactNode;
};

export function SelectField({
  label,
  name,
  options,
  required,
  icon,
  value,
  onChange,
  helper,
}: SelectFieldProps) {
  return (
    <div className="mb-4">
      <label
        htmlFor={name}
        className="block text-sm font-medium text-forest mb-1.5"
      >
        {label}
        {required && <span className="text-terracotta ml-0.5">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <PhosphorIcon
            name={icon}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"
          />
        )}
        <select
          id={name}
          name={name}
          required={required}
          value={value}
          onChange={onChange}
          className={`w-full ${icon ? "pl-10" : "pl-3"} pr-10 py-2.5 text-sm bg-white border border-gray-200 rounded-md outline-none transition focus:border-meb-green focus:ring-2 focus:ring-meb-light appearance-none`}
        >
          <option value="">-- เลือก{label} --</option>
          {options.map((opt) => {
            const val = typeof opt === "string" ? opt : opt.value;
            const lbl = typeof opt === "string" ? opt : opt.label;
            return (
              <option key={val} value={val}>
                {lbl}
              </option>
            );
          })}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
          <PhosphorIcon name="caret-down" />
        </div>
      </div>
      {helper && <p className="text-xs text-slate-500 mt-1.5">{helper}</p>}
    </div>
  );
}