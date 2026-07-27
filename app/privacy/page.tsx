import { Header } from "@/app/components/header";
import { Footer } from "@/app/components/footer";

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col max-w-[1200px] mx-auto px-4 py-12 w-full">
        <h1 className="text-3xl font-bold text-forest mb-6">นโยบายความเป็นส่วนตัว</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8 prose max-w-none text-slate-600">
          <h2 className="text-xl font-bold text-slate-800 mb-4">1. การจัดเก็บข้อมูลส่วนบุคคล</h2>
          <p className="mb-4">เราจัดเก็บข้อมูลที่จำเป็นต่อการให้บริการห้องสมุดดิจิทัลเท่านั้น เช่น ชื่อ-นามสกุล รหัสนักศึกษา และประวัติการยืม-คืนหนังสือ</p>
          
          <h2 className="text-xl font-bold text-slate-800 mb-4">2. การใช้ข้อมูล</h2>
          <p className="mb-4">ข้อมูลของท่านจะถูกใช้เพื่อยืนยันตัวตนในการเข้าใช้ระบบ และวิเคราะห์สถิติการใช้งานเพื่อพัฒนาห้องสมุดเท่านั้น เราจะไม่เปิดเผยข้อมูลของท่านต่อบุคคลที่สาม</p>

          <h2 className="text-xl font-bold text-slate-800 mb-4">3. ความปลอดภัยของข้อมูล</h2>
          <p className="mb-4">เราใช้มาตรการรักษาความปลอดภัยทางเทคนิคที่ได้มาตรฐาน เพื่อป้องกันการเข้าถึงข้อมูลของท่านโดยไม่ได้รับอนุญาต</p>

          <p className="text-sm mt-8 text-slate-400">แก้ไขล่าสุด: {new Date().toLocaleDateString('th-TH')}</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
