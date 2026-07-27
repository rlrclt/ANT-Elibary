import { Header } from "@/app/components/header";
import { Footer } from "@/app/components/footer";

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col max-w-[1200px] mx-auto px-4 py-12 w-full">
        <h1 className="text-3xl font-bold text-forest mb-6">ติดต่อเรา</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-xl font-bold mb-4">ข้อมูลการติดต่อ</h2>
              <ul className="space-y-4 text-slate-600">
                <li>
                  <strong className="block text-slate-800">ที่อยู่:</strong>
                  วิทยาลัยเทคนิคอำนาจเจริญ<br/>
                  เลขที่ 1 หมู่ 1 ตำบล... อำเภอเมือง จังหวัดอำนาจเจริญ
                </li>
                <li>
                  <strong className="block text-slate-800">โทรศัพท์:</strong>
                  045-XXX-XXX
                </li>
                <li>
                  <strong className="block text-slate-800">อีเมล:</strong>
                  library@amnattc.ac.th
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-xl font-bold mb-4">เวลาทำการ</h2>
              <ul className="space-y-2 text-slate-600">
                <li>จันทร์ - ศุกร์ : 08:30 - 16:30 น.</li>
                <li>เสาร์ - อาทิตย์ และวันหยุดนักขัตฤกษ์ : ปิดทำการ</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
