import type { Metadata, Viewport } from "next";
import { Geist_Mono, Geist } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

// Cabinet Grotesk untuk display/heading (dipasangkan dengan Geist untuk UI/body).
const cabinet = localFont({
  variable: "--font-cabinet",
  display: "swap",
  src: [
    { path: "../../public/fonts/cabinet-grotesk-500.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/cabinet-grotesk-700.woff2", weight: "700", style: "normal" },
    { path: "../../public/fonts/cabinet-grotesk-800.woff2", weight: "800", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "Maubisa Lulus · Bimbingan Skripsi",
  description: "Teman bimbingan skripsimu, dari judul sampai sidang.",
  robots: { index: false, follow: false },
};

// Web Interface Guidelines: theme-color untuk UI browser + color-scheme light.
export const viewport: Viewport = {
  themeColor: "#0a48b7",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={cn(geist.variable, cabinet.variable, mono.variable, "font-sans")}>
      <body className="min-h-[100dvh] bg-background font-sans text-foreground antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus:outline-2 focus:outline-offset-2 focus:outline-brand-600"
        >
          Lewati ke konten utama
        </a>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
