import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

const inter = localFont({
  src: [
    { path: "./fonts/inter-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

const cormorant = localFont({
  src: [
    { path: "./fonts/cormorant-garamond-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/cormorant-garamond-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/cormorant-garamond-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/cormorant-garamond-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AIBABA — Complete Life Reading",
    template: "%s · AIBABA",
  },
  description:
    "A premium, transparent Complete Life Reading combining palm observation, deterministic numerology and Vedic astrology — with clear limits and no invented detail.",
  applicationName: "AIBABA",
  robots: { index: true, follow: true },
  openGraph: {
    title: "AIBABA — Complete Life Reading",
    description:
      "Palmistry, numerology and Vedic astrology, clearly separated and carefully labelled. Traditional reflection, not prediction.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#10152B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[#10152b] focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
