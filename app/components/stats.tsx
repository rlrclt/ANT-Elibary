import { PhosphorIcon } from "./phosphor-icon";
import { ScrollReveal } from "./scroll-reveal";

type StatsProps = {
  booksCount: number;
  usersCount: number;
  categoriesCount: number;
};

export function Stats({ booksCount, usersCount, categoriesCount }: StatsProps) {
  // Use a sensible default max value if data is 0 to avoid division by zero
  const maxValue = Math.max(booksCount, usersCount, categoriesCount, 1);
  
  // Calculate width percentage with a minimum of 15% so it's always visible
  const getWidth = (val: number) => `${Math.max(15, (val / maxValue) * 100)}%`;

  const graphData = [
    { 
      label: "รายการหนังสือทั้งหมด", 
      value: booksCount, 
      icon: "books", 
      color: "bg-meb-green" 
    },
    { 
      label: "สมาชิกใช้งาน", 
      value: usersCount, 
      icon: "users", 
      color: "bg-terracotta" 
    },
    { 
      label: "หมวดหมู่วิชา", 
      value: categoriesCount, 
      icon: "grid-four", 
      color: "bg-forest" 
    },
  ];

  return (
    <section className="bg-white border-y border-gray-100 py-12 sm:py-16 overflow-hidden">
      <div className="max-w-[1000px] mx-auto px-4">
        
        {/* Section Header */}
        <ScrollReveal className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-forest mb-3">
            ห้องสมุดที่เติบโตไปพร้อมกับคุณ
          </h2>
          <p className="text-slate-500 text-sm sm:text-base max-w-2xl mx-auto">
            รวบรวมความรู้และทรัพยากรที่หลากหลาย เพื่อมอบประสบการณ์การเรียนรู้ที่ดีที่สุด
          </p>
        </ScrollReveal>

        <div className="flex flex-col lg:flex-row gap-10 items-center">
          
          {/* Graph Section */}
          <div className="flex-1 w-full space-y-6">
            {graphData.map((item, index) => (
              <ScrollReveal key={item.label} delay={index * 150} className="w-full">
                <div className="flex items-end justify-between mb-2">
                  <div className="flex items-center gap-2 text-forest font-semibold">
                    <PhosphorIcon name={item.icon} className="text-lg opacity-70" />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-lg sm:text-xl font-bold text-slate-800">
                    {item.value.toLocaleString()}
                  </span>
                </div>
                
                {/* Bar */}
                <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner">
                  <div 
                    className={`h-full rounded-full ${item.color} transition-all duration-1000 ease-out`}
                    style={{ width: getWidth(item.value) }}
                  ></div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* 24/7 Feature Badge (Standalone) */}
          <ScrollReveal delay={400} className="lg:w-1/3 w-full">
            <div className="relative group p-6 sm:p-8 rounded-2xl bg-cream border border-[#e8dfd3] shadow-sm hover:shadow-md transition-shadow flex flex-col items-center justify-center text-center h-full">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <PhosphorIcon name="clock-countdown" weight="fill" className="text-6xl text-terracotta" />
              </div>
              
              <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center text-terracotta text-2xl mb-4 relative z-10">
                <PhosphorIcon name="clock" weight="fill" />
              </div>
              
              <h3 className="text-xl sm:text-2xl font-bold text-forest mb-2 relative z-10">
                24/7 เข้าถึงได้ตลอด
              </h3>
              
              <p className="text-slate-600 text-sm relative z-10">
                ไม่ว่าจะอยู่ที่ไหน หรือเวลาใด คุณก็สามารถเข้าถึงคลังความรู้ของเราได้ตลอด 24 ชั่วโมง โดยไม่มีวันหยุดพัก
              </p>
            </div>
          </ScrollReveal>

        </div>
      </div>
    </section>
  );
}