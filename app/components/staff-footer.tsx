import Link from "next/link";
import { PhosphorIcon } from "./phosphor-icon";

/**
 * StaffFooter — simple footer (Group 4 deep pages pattern)
 * clone จาก AmnatCharoen.html footer
 */
export function StaffFooter() {
  return (
    <footer className="bg-white dark:bg-card-bg border-t border-gray-200 dark:border-border-base mt-auto py-6 transition-colors print:hidden">
      <div className="max-w-[1200px] mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500 dark:text-slate-400">
        <p>&copy; {new Date().getFullYear()} วิทยาลัยเทคนิคอำนาจเจริญ E-Library.</p>
        <div className="flex gap-4">
          <Link href="/terms" className="hover:text-meb-green">
            เงื่อนไขการใช้งาน
          </Link>
          <Link href="/contact" className="hover:text-meb-green">
            ติดต่อศูนย์วิทยบริการ
          </Link>
          <Link
            href="/help/faq"
            className="hover:text-meb-green flex items-center gap-1"
          >
            <PhosphorIcon name="question" weight="fill" className="text-sm" />
            ช่วยเหลือ
          </Link>
        </div>
      </div>
    </footer>
  );
}