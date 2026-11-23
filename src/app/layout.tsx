import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "YFounder CRM | 360° Business Consulting Operations",
  description: "Internal client, engagement, project, and billing CRM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="min-h-screen bg-[#f8f9fa] font-sans text-slate-900 antialiased">
        {children}
        <Toaster position="top-right" richColors/>
      </body>
    </html>
  );
}