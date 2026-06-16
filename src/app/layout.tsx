import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AniMatch",
  description: "Anime pairwise ranking and personal tier lists.",
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
      <body>{children}</body>
    </html>
  );
}
