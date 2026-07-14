import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "واءم | WAAEM — منصة الامتثال للأنظمة السعودية",
  description: "واءم — قيّم أي وثيقة حوكمة مقابل الأنظمة السعودية الرسمية عبر الذكاء الاصطناعي (RAG وLlama)، واحصل على تقرير امتثال عربي يبيّن الفجوات والتوصيات.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${plexArabic.variable} ${geist.variable} ${geistMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
