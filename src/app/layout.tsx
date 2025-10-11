import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Opportunity Tracker",
  description: "Track deals, next steps, and forecasts in a Kanban view",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="border-b">
          <div className="mx-auto max-w-7xl px-6 h-12 flex items-center justify-between">
            <Link href="/" className="font-medium">Opportunity Tracker</Link>
            <nav className="text-sm">
              <Link href="/opportunities" className="hover:underline">Opportunities</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6">{children}</main>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
