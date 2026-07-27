import { Header } from "@/app/components/header";
import { Footer } from "@/app/components/footer";

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col max-w-[1200px] mx-auto px-4 py-12 w-full">
        <h1 className="text-3xl font-bold text-forest mb-6">ข้อตกลงและเงื่อนไขการใช้บริการ</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8 prose max-w-none text-slate-600">
          <h2 className="text-xl font-bold text-slate-800 mb-4">1. การยอมรับข้อตกลง</h2>
          <p className="mb-4">
            การเข้าใช้บริการระบบห้องสมุด ANT-Elibrary ถือว่าท่านได้อ่านและยอมรับข้อตกลงและเงื่อนไขการใช้บริการนี้อย่างครบถ้วน หากท่านไม่ยอมรับเงื่อนไขข้อใดข้อหนึ่ง กรุณางดใช้บริการ
          </p>
          
          <h2 className="text-xl font-bold text-slate-800 mb-4">2. กฎการยืม-คืนหนังสือ</h2>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>ผู้ใช้สามารถยืมหนังสือได้ตามจำนวนที่กำหนดตามสิทธิ์ (Role) ของท่าน</li>
            <li>ระยะเวลาการยืมขึ้นอยู่กับประเภทของหนังสือและโควต้าของผู้ใช้</li>
            <li>หากผู้ใช้ส่งคืนหนังสือล่าช้ากว่ากำหนด ระบบจะมีการปรับตามอัตราที่ห้องสมุดตั้งไว้</li>
          </ul>

          <h2 className="text-xl font-bold text-slate-800 mb-4">3. ความรับผิดชอบต่อทรัพย์สิน</h2>
          <p className="mb-4">
            ผู้ยืมจะต้องดูแลรักษาหนังสือที่ยืมไปให้อยู่ในสภาพสมบูรณ์ กรณีที่หนังสือเกิดความเสียหายหรือสูญหาย ผู้ยืมจะต้องรับผิดชอบชดใช้ค่าเสียหายตามราคาของหนังสือหรืออัตราที่ห้องสมุดประเมิน
          </p>

          <h2 className="text-xl font-bold text-slate-800 mb-4">4. การระงับการให้บริการ</h2>
          <p className="mb-4">
            ห้องสมุดขอสงวนสิทธิ์ในการระงับบัญชีผู้ใช้ชั่วคราวหรือถาวร หากพบว่ามีการกระทำผิดกฎระเบียบอย่างร้ายแรง เช่น การค้างชำระค่าปรับเป็นเวลานาน หรือจงใจทำลายหนังสือ
          </p>

          <p className="text-sm mt-8 text-slate-400">แก้ไขล่าสุด: {new Date().toLocaleDateString('th-TH')}</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
