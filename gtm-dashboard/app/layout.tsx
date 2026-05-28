import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ScoreChangeBannerWrapper } from "@/components/ui/ScoreChangeBannerWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Anthropic GTM Intelligence Command Center",
  description:
    "Visualise LangGraph pipeline output for enterprise GTM intelligence. Identify the highest-priority Anthropic opportunities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0f172a] text-[#f1f5f9]">
        {/* Score change banner — shown when watched account scores change significantly */}
        <ScoreChangeBannerWrapper />
        {children}
      </body>
    </html>
  );
}
