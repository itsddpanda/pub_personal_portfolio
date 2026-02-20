import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MFA — Mutual Fund Analyzer",
  description: "Privacy-first, offline-capable portfolio analytics for Indian mutual fund investors.",
};

import { ToastProvider } from "@/components/ui/Toast";
import Navbar from "@/components/Navbar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ToastProvider>
          <div className="min-h-screen bg-gray-50">
            <Navbar />
            {children}
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
