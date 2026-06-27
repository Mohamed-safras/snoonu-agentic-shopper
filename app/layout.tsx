import type { Metadata, Viewport } from "next";
import {
  Newsreader,
  Hanken_Grotesk,
  JetBrains_Mono,
  Noto_Sans_Arabic,
  Noto_Sans_Sinhala,
  Noto_Sans_Tamil,
} from "next/font/google";
import "./globals.css";
import { Bootstrap } from "@/app/bootstrap";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});
const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-noto-arabic",
  display: "swap",
});
const notoSinhala = Noto_Sans_Sinhala({
  subsets: ["sinhala"],
  variable: "--font-noto-sinhala",
  display: "swap",
});
const notoTamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  variable: "--font-noto-tamil",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hala · Snoonu AI Shopping Concierge",
  description:
    "Hala — Snoonu's warm AI shopping concierge. Discover gifts, get live delivery quotes, and check out, all in one conversation.",
  icons: { icon: "/hala-logo.svg" },
};

export const viewport: Viewport = {
  themeColor: "#D90217",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

const fontVars = [
  newsreader.variable,
  hanken.variable,
  jetbrains.variable,
  notoArabic.variable,
  notoSinhala.variable,
  notoTamil.variable,
].join(" ");

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fontVars} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <Bootstrap />
        {children}
      </body>
    </html>
  );
}
