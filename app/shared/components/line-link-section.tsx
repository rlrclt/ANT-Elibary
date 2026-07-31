"use client";

import { useState, useTransition, useEffect } from "react";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import {
  getLineLinkStatusAction,
  unlinkLineAccountAction,
} from "@/app/line/actions";

/**
 * LineLinkSection — ส่วนเชื่อมต่อ LINE สำหรับแท็บการแจ้งเตือน
 *
 * ใช้ร่วมกันได้ทั้ง /staff/settings และ /member/profile
 * สถานะการเชื่อมต่อ LINE เก็บใน users.line_user_id
 * สลับ role ไปมาก็ยังคงสถานะการเชื่อมต่อไว้ (เพราะเป็น user id เดียวกัน)
 */

// LINE Bot info
const LINE_BOT_ID = "@415cpljd";
const LINE_BOT_QR_URL =
  "https://fhdgnerfevvfofdnafcj.supabase.co/storage/v1/object/public/media/415cpljd.png";
const LINE_ADD_FRIEND_URL = `https://line.me/R/ti/p/${LINE_BOT_ID}`;

export function LineLinkSection() {
  const [linked, setLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const res = await getLineLinkStatusAction();
      setLinked(res.linked);
      setLoading(false);
    });
  }, []);

  function handleUnlink() {
    if (!confirm("ต้องการยกเลิกเชื่อมต่อ LINE ใช่หรือไม่?")) return;
    setError(null);
    startTransition(async () => {
      const res = await unlinkLineAccountAction();
      if (res.error) {
        setError(res.error);
        return;
      }
      setLinked(false);
    });
  }

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  const liffReady = liffId && liffId !== "1234567890-AbCdEfGh";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-400">
        <PhosphorIcon name="circle-notch" className="text-xl animate-spin mr-2" />
        <span className="text-sm">กำลังตรวจสอบ...</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-5 transition-colors shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#06C755]/10 flex items-center justify-center text-[#06C755] text-2xl shrink-0">
          <PhosphorIcon name="line-logo" weight="fill" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-forest dark:text-slate-100">
            การแจ้งเตือนผ่าน LINE
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            เชื่อมต่อบัญชี LINE เพื่อรับการแจ้งเตือนการยืม-คืนหนังสือ
            การเข้าใช้ห้องสมุด และประกาศจากระบบ ผ่านแอป LINE ของคุณ
          </p>

          {error && (
            <p className="text-xs text-price-red mt-2">{error}</p>
          )}

          <div className="mt-4">
            {linked ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-meb-green bg-meb-light px-3 py-1.5 rounded-full">
                  <PhosphorIcon name="check-circle" weight="fill" className="text-sm" />
                  เชื่อมต่อแล้ว
                </span>
                <button
                  onClick={handleUnlink}
                  disabled={pending}
                  className="text-xs font-medium text-slate-500 hover:text-price-red dark:text-slate-400 transition disabled:opacity-60"
                >
                  ยกเลิกเชื่อมต่อ
                </button>
              </div>
            ) : liffReady ? (
              <div className="space-y-4">
                {/* ขั้นตอนที่ 1: เพิ่มเพื่อน bot */}
                <div className="flex items-center gap-4 p-4 bg-[#06C755]/5 border border-[#06C755]/20 rounded-lg">
                  {/* QR Code */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={LINE_BOT_QR_URL}
                    alt="LINE Bot QR Code"
                    className="w-24 h-24 rounded-lg shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-forest dark:text-slate-100 flex items-center gap-1.5">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#06C755] text-white text-[10px] font-bold">1</span>
                      เพิ่มเพื่อน bot ก่อนเชื่อมต่อ
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                      สแกน QR Code หรือกดปุ่มด้านล่างเพื่อเพิ่มเพื่อน bot
                    </p>
                    <a
                      href={LINE_ADD_FRIEND_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-white bg-[#06C755] hover:bg-[#05b24d] px-3 py-1.5 rounded-md transition"
                    >
                      <PhosphorIcon name="line-logo" weight="fill" className="text-sm" />
                      เพิ่มเพื่อน bot
                    </a>
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      Bot ID: {LINE_BOT_ID}
                    </p>
                  </div>
                </div>

                {/* ขั้นตอนที่ 2: เชื่อมต่อบัญชี */}
                <div className="flex items-center gap-4 p-4 bg-meb-light/30 border border-meb-green/20 rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-meb-green/10 flex items-center justify-center text-meb-green shrink-0">
                    <PhosphorIcon name="link" weight="bold" className="text-lg" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-forest dark:text-slate-100 flex items-center gap-1.5">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-meb-green text-white text-[10px] font-bold">2</span>
                      เชื่อมต่อบัญชี
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                      หลังเพิ่มเพื่อนแล้ว กดปุ่มเพื่อเชื่อมต่อบัญชี LINE ของคุณ
                    </p>
                    <a
                      href={`https://liff.line.me/${liffId}`}
                      className="inline-flex items-center gap-2 mt-2 bg-[#06C755] hover:bg-[#05b24d] text-white font-bold px-4 py-2 rounded-md text-sm transition"
                    >
                      <PhosphorIcon name="line-logo" weight="fill" />
                      เชื่อมต่อ LINE
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  ระบบยังไม่ได้เปิดใช้งาน LINE integration
                  (ติดต่อเจ้าหน้าที่)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}