"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PhosphorIcon } from "./phosphor-icon";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

/**
 * Header หลัก (สีเขียวแบรนด์ sticky)
 * แสดงปุ่มตามสถานะล็อกอิน:
 * - ยังไม่ล็อกอิน: ปุ่ม "เข้าสู่ระบบ"
 * - ล็อกอินแล้ว: ปุ่ม "แดชบอร์ด" และ "ออกจากระบบ"
 * - ปุ่มประกาศ (เปิด popup modal)
 */
const AUTH_PATHS = ["/login", "/register"];

type Announcement = {
  id: string;
  title: string;
  body: string;
  type: string;
  action_label: string | null;
  action_url: string | null;
  image_url: string | null;
  is_pinned: boolean;
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = AUTH_PATHS.includes(pathname);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // State สำหรับ popup ประกาศ
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentAnnouncement, setCurrentAnnouncement] = useState(0);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // ดึง user ปัจจุบัน
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // ฟังเหตุการณ์การเปลี่ยนสถานะล็อกอิน
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ดึงประกาศจาก DB
  const fetchAnnouncements = useCallback(async () => {
    setLoadingAnnouncements(true);
    try {
      const supabase = createClient();
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("announcements")
        .select(
          "id, title, body, type, action_label, action_url, image_url, is_pinned",
        )
        .eq("is_active", true)
        .eq("target_audience", "all")
        .eq("show_on_homepage", true)
        .or(`end_at.is.null,end_at.gt.${nowIso}`)
        .or(`start_at.is.null,start_at.lte.${nowIso}`)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);

      if (!error && data) {
        setAnnouncements(data as Announcement[]);
      }
    } catch {
      // ignore
    }
    setLoadingAnnouncements(false);
  }, []);

  // เปิด popup ประกาศ
  const handleOpenAnnouncements = () => {
    setShowAnnouncements(true);
    setCurrentAnnouncement(0);
    fetchAnnouncements();
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/login");
    router.refresh();
  };

  const typeConfig: Record<string, { icon: string; color: string; bg: string }> = {
    notice: { icon: "info", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-500/10" },
    news: { icon: "newspaper", color: "text-meb-green", bg: "bg-meb-light/50 dark:bg-meb-green/10" },
    alert: { icon: "warning", color: "text-price-red", bg: "bg-red-50 dark:bg-red-500/10" },
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-meb-green text-white h-16 shadow-md">
        <div className="max-w-[1200px] mx-auto h-full px-4 flex items-center justify-between gap-4">
          {/* โลโก้ */}
          <Link
            href="/"
            className="flex items-center gap-2 text-white hover:text-white/90 shrink-0 focus:outline-none focus:ring-2 focus:ring-white rounded"
          >
            <PhosphorIcon name="buildings" weight="fill" className="text-3xl" />
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight leading-none mt-1">
                วิทยาลัยเทคนิคอำนาจเจริญ
              </span>
              <span className="text-[10px] tracking-wider uppercase">E-Library</span>
            </div>
          </Link>

          {/* ปุ่มตามสถานะ Auth */}
          {!loading && (
            <div className="flex items-center gap-3 ml-auto">
              {/* ปุ่มประกาศ */}
              <button
                onClick={handleOpenAnnouncements}
                className="inline-flex items-center justify-center gap-1.5 text-white/90 hover:text-white hover:bg-white/10 px-3 py-2 rounded-md text-sm transition"
                title="ประกาศ"
              >
                <PhosphorIcon name="bell-ringing" weight="fill" className="text-base" />
                <span className="hidden sm:inline">ประกาศ</span>
              </button>
              {user ? (
                <>
                  <Link
                    href="/member"
                    className="inline-flex items-center justify-center gap-2 bg-white text-meb-green font-bold px-4 py-2 rounded-md text-sm hover:bg-meb-light transition shadow-sm"
                  >
                    <PhosphorIcon name="user" weight="bold" />
                    แดชบอร์ด
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="inline-flex items-center justify-center gap-1 bg-meb-dark/40 hover:bg-meb-dark/70 text-white font-medium px-3 py-2 rounded-md text-sm transition"
                    title="ออกจากระบบ"
                  >
                    <PhosphorIcon name="sign-out" weight="bold" />
                    <span className="hidden sm:inline">ออกจากระบบ</span>
                  </button>
                </>
              ) : (
                !isAuthPage && (
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-2 bg-white text-meb-green font-bold px-4 py-2 rounded-md text-sm hover:bg-meb-light transition shadow-sm"
                  >
                    เข้าสู่ระบบ
                  </Link>
                )
              )}
            </div>
          )}
        </div>
      </header>

      {/* Popup ประกาศ */}
      {showAnnouncements && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]"
            onClick={() => setShowAnnouncements(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <div
              className="pointer-events-auto w-full max-w-lg max-h-[85vh] bg-white dark:bg-card-bg rounded-2xl shadow-2xl border border-gray-100 dark:border-border-base overflow-hidden animate-[scaleIn_200ms_ease-out] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 bg-meb-light/50 dark:bg-meb-green/10">
                <div className="flex items-center gap-2 text-meb-green">
                  <PhosphorIcon name="bell-ringing" weight="fill" className="text-lg" />
                  <span className="text-sm font-bold">ประกาศ</span>
                </div>
                <button
                  onClick={() => setShowAnnouncements(false)}
                  className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition p-1"
                  aria-label="ปิด"
                >
                  <PhosphorIcon name="x" weight="bold" className="text-lg" />
                </button>
              </div>

              {/* เนื้อหา */}
              {loadingAnnouncements ? (
                <div className="flex items-center justify-center py-12">
                  <PhosphorIcon name="circle-notch" className="text-xl animate-spin text-meb-green" />
                  <span className="text-sm text-slate-400 ml-2">กำลังโหลด...</span>
                </div>
              ) : announcements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-5">
                  <PhosphorIcon
                    name="bell-slash"
                    weight="fill"
                    className="text-4xl text-slate-300 dark:text-slate-600 mb-3"
                  />
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    ไม่มีประกาศในขณะนี้
                  </p>
                </div>
              ) : (
                <>
                  {/* มีประกาศ */}
                  <div className="flex-1 overflow-y-auto p-5">
                    {(() => {
                      const item = announcements[Math.min(currentAnnouncement, announcements.length - 1)];
                      const cfg = typeConfig[item.type] ?? typeConfig.notice;
                      return (
                        <>
                          {/* ป้ายประเภท */}
                          <div className={`inline-flex items-center gap-1.5 ${cfg.bg} px-2.5 py-1 rounded-full mb-3`}>
                            <PhosphorIcon name={cfg.icon} weight="fill" className={`text-sm ${cfg.color}`} />
                            <span className={`text-xs font-bold ${cfg.color}`}>
                              {item.type === "alert" ? "แจ้งเตือน" : item.type === "news" ? "ข่าวสาร" : "ประกาศ"}
                            </span>
                            {item.is_pinned && (
                              <PhosphorIcon name="push-pin" weight="fill" className="text-xs text-amber-500" />
                            )}
                          </div>

                          {/* รูปภาพ */}
                          {item.image_url && (
                            <div className="mb-4 rounded-xl overflow-hidden border border-gray-200 dark:border-border-base">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.image_url}
                                alt={item.title}
                                className="w-full max-h-64 object-cover"
                              />
                            </div>
                          )}

                          {/* ชื่อ + เนื้อหา */}
                          <h3 className="font-bold text-lg text-forest dark:text-slate-100 mb-2">
                            {item.title}
                          </h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                            {item.body}
                          </p>

                          {/* action button */}
                          {item.action_url && item.action_label && (
                            <a
                              href={item.action_url}
                              onClick={() => setShowAnnouncements(false)}
                              className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-white bg-meb-green hover:bg-meb-hover px-5 py-2.5 rounded-lg transition-colors"
                            >
                              {item.action_label}
                              <PhosphorIcon name="arrow-right" weight="bold" className="text-sm" />
                            </a>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Footer — ปุ่มเลื่อน + จุด */}
                  {announcements.length > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-border-base">
                      <button
                        onClick={() => setCurrentAnnouncement((c) => (c - 1 + announcements.length) % announcements.length)}
                        className="p-1.5 text-slate-400 hover:text-meb-green transition rounded-md hover:bg-meb-light/30"
                        aria-label="ก่อนหน้า"
                      >
                        <PhosphorIcon name="caret-left" weight="bold" className="text-lg" />
                      </button>
                      <div className="flex items-center gap-1.5">
                        {announcements.map((a, i) => (
                          <button
                            key={a.id}
                            onClick={() => setCurrentAnnouncement(i)}
                            className={`h-2 rounded-full transition-all ${
                              i === currentAnnouncement
                                ? "w-6 bg-meb-green"
                                : "w-2 bg-slate-300 dark:bg-white/20 hover:bg-slate-400"
                            }`}
                            aria-label={`ประกาศที่ ${i + 1}`}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => setCurrentAnnouncement((c) => (c + 1) % announcements.length)}
                        className="p-1.5 text-slate-400 hover:text-meb-green transition rounded-md hover:bg-meb-light/30"
                        aria-label="ถัดไป"
                      >
                        <PhosphorIcon name="caret-right" weight="bold" className="text-lg" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <style>{`
            @keyframes scaleIn {
              from { transform: scale(0.9); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </>
      )}
    </>
  );
}