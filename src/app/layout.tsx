import type { Metadata } from "next";
import { Suspense } from "react";
import { PlaytestFeedbackButton } from "@/components/PlaytestFeedbackButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "AniMatch",
  description: "两两对决，排出你的番剧榜单。",
  icons: {
    icon: "/brand/animatch-logo-icon.png",
    apple: "/brand/animatch-logo-icon.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <Suspense fallback={null}>
          <PlaytestFeedbackButton />
        </Suspense>
      </body>
    </html>
  );
}
