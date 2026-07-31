import { Header } from "@/app/components/header";
import { Footer } from "@/app/components/footer";

export default function FAQPage() {
  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col max-w-[1200px] mx-auto px-4 py-12 w-full">
        <h1 className="text-3xl font-bold text-forest mb-6">คำถามที่พบบ่อย (FAQ)</h1>
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-lg mb-2">ใครสามารถใช้งานระบบได้บ้าง?</h3>
            <p className="text-slate-600">นักศึกษา คณาจารย์ และบุคลากรของวิทยาลัยเทคนิคอำนาจเจริญทุกคน ที่มีรหัสนักศึกษา/บุคลากร</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-lg mb-2">ลืมรหัสผ่านต้องทำอย่างไร?</h3>
            <p className="text-slate-600">สามารถกดที่ "ลืมรหัสผ่าน" ในหน้าเข้าสู่ระบบ หรือติดต่อเจ้าหน้าที่ห้องสมุดเพื่อทำการรีเซ็ต</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-lg mb-2">อ่านหนังสือแบบออฟไลน์ได้หรือไม่?</h3>
            <p className="text-slate-600">ปัจจุบันระบบยังต้องใช้การเชื่อมต่ออินเทอร์เน็ตในการเปิดอ่านอีบุ๊ก</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
