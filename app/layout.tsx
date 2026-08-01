import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "./components/theme-provider";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ANT E-Library — ห้องสมุดดิจิทัล",
  description:
    " ANT E-Library ระบบห้องสมุดดิจิทัล สืบค้น ยืม-คืน และอ่านอีบุ๊กได้ทุกที่ทุกเวลา",
};

/**
 * Script ป้องกัน FOUC (flash of wrong theme)
 * รันก่อน hydration เพื่อตั้ง class .dark ทันทีตาม localStorage/prefers-color-scheme
 */
const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('ant-theme');
    var theme = stored === 'dark' ? 'dark' : 'light';
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${notoSansThai.variable} h-full antialiased overflow-x-hidden`}
      suppressHydrationWarning
    >
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-page-bg text-slate-800 dark:text-slate-200 font-sans overflow-x-hidden transition-colors duration-300">
        <ThemeProvider>{children}</ThemeProvider>
        {/* Phosphor Icons — โหลดที่ body ท้ายหน้า เพื่อไม่บล็อก render */}
        <Script
          src="https://unpkg.com/@phosphor-icons/web"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}