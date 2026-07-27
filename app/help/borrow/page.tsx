import { Header } from "@/app/components/header";
import { Footer } from "@/app/components/footer";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import { ScrollReveal } from "@/app/components/scroll-reveal";

export default function BorrowPage() {
  const borrowSteps = [
    { icon: "magnifying-glass", title: "ค้นหาหนังสือ", desc: "เลือกหาหนังสือที่คุณสนใจผ่านช่องค้นหา หรือเลือกจากหมวดหมู่", color: "bg-blue-100 text-blue-600" },
    { icon: "hand-tap", title: "กดปุ่มยืม", desc: "เข้าไปที่หน้ารายละเอียดหนังสือ แล้วกดปุ่ม 'ยืมหนังสือ'", color: "bg-orange-100 text-orange-600" },
    { icon: "books", title: "เพิ่มลงคลังของคุณ", desc: "หนังสือจะเข้ามาอยู่ใน 'คลังของฉัน' และเปิดอ่านได้ทันที", color: "bg-meb-light text-meb-green" },
    { icon: "clock-countdown", title: "อ่านภายใน 7 วัน", desc: "ระบบให้เวลายืม 7 วัน และสามารถยืมพร้อมกันได้ 5 เล่ม", color: "bg-purple-100 text-purple-600" }
  ];

  const returnSteps = [
    { icon: "check-circle", title: "คืนอัตโนมัติ", desc: "เมื่อครบกำหนด 7 วัน ระบบจะทำการคืนหนังสือให้โดยอัตโนมัติ", color: "bg-meb-light text-meb-green" },
    { icon: "arrow-counter-clockwise", title: "คืนก่อนกำหนด", desc: "สามารถไปที่หน้า 'คลังของฉัน' และกดปุ่ม 'คืนหนังสือ' ได้ทุกเมื่อ", color: "bg-yellow-100 text-yellow-600" },
    { icon: "ticket", title: "รับโควต้าคืน", desc: "เมื่อคืนสำเร็จ โควต้าการยืมของคุณจะกลับคืนมาทันที เพื่อให้ยืมเล่มต่อไปได้", color: "bg-blue-100 text-blue-600" }
  ];

  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col bg-slate-50 w-full">
        {/* Hero Banner สำหรับหัวข้อ - เปลี่ยนสีจาก meb-green เป็น forest */}
        <section className="bg-forest text-white py-16 px-4 text-center overflow-hidden relative">
          {/* Decorative blur */}
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-meb-green/30 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-terracotta/30 rounded-full blur-3xl"></div>
          
          <ScrollReveal direction="up" className="relative max-w-2xl mx-auto">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 mb-6 border border-white/20">
              <PhosphorIcon name="arrows-left-right" weight="bold" className="text-3xl" />
            </div>
            <h1 className="text-4xl font-black mb-4">วิธีการยืม-คืน หนังสือ</h1>
            <p className="text-white/80 text-lg">อ่านอีบุ๊กง่ายๆ แค่ 4 ขั้นตอน จัดการคลังของคุณได้อย่างอิสระ</p>
          </ScrollReveal>
        </section>

        {/* ส่วนของการยืม */}
        <section className="max-w-[1200px] mx-auto px-4 py-16 w-full">
          <ScrollReveal direction="up" className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">ขั้นตอนการยืม</h2>
            <p className="text-slate-500">คุณสามารถยืมหนังสือได้สูงสุด 5 เล่มพร้อมกัน</p>
          </ScrollReveal>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {borrowSteps.map((step, index) => (
              <ScrollReveal key={index} direction="up" delay={index * 150} className="h-full">
                <div className="relative bg-white rounded-2xl p-6 shadow-sm border border-slate-100 card-lift flex flex-col items-center text-center h-full">
                  {/* Number Badge */}
                  <div className="absolute -top-4 -left-4 w-8 h-8 rounded-full bg-slate-800 text-white font-black flex items-center justify-center shadow-md">
                    {index + 1}
                  </div>
                  
                  {/* Icon */}
                  <div className={`w-20 h-20 rounded-full ${step.color} flex items-center justify-center mb-6 transition-transform duration-300 hover:scale-110`}>
                    <PhosphorIcon name={step.icon as any} weight="fill" className="text-4xl" />
                  </div>
                  
                  <h3 className="text-lg font-bold text-slate-800 mb-3">{step.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* ส่วนของการคืน */}
        <section className="bg-white border-t border-slate-100">
          <div className="max-w-[1200px] mx-auto px-4 py-16 w-full">
            <ScrollReveal direction="up" className="text-center mb-12">
              <h2 className="text-3xl font-bold text-terracotta mb-2">การคืนหนังสือ</h2>
              <p className="text-slate-500">สะดวกสบายด้วยระบบคืนอัตโนมัติ ไม่ต้องกลัวลืม</p>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
              {returnSteps.map((step, index) => (
                <ScrollReveal key={index} direction="up" delay={index * 150} className="h-full">
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col items-center text-center group hover:bg-meb-light/30 hover:border-meb-light transition duration-300 h-full">
                    <div className={`w-16 h-16 rounded-2xl ${step.color} flex items-center justify-center mb-5 rotate-3 group-hover:-rotate-3 group-hover:scale-110 transition duration-300`}>
                      <PhosphorIcon name={step.icon as any} weight="duotone" className="text-3xl" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">{step.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
