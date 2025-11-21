import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { MainNav } from "@/components/navigation/MainNav";
import { UserMenu } from "@/components/navigation/UserMenu";
import { CommentSidebarProvider } from "@/components/comments/CommentSidebarContext";
import { CommentSidebarWrapper } from "@/components/comments/CommentSidebarWrapper";
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
        <CommentSidebarProvider>
          <header className="border-b">
            <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
              <Link href="/" className="font-semibold text-lg">Opportunity Tracker</Link>
              <div className="flex items-center gap-6">
                <MainNav />
                <UserMenu />
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-6">{children}</main>
          <CommentSidebarWrapper />
          <Toaster position="top-right" richColors />
        </CommentSidebarProvider>
      </body>
    </html>
  );
}
