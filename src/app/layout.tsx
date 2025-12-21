import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { CommentSidebarProvider } from "@/components/comments/CommentSidebarContext";
import { CommentSidebarWrapper } from "@/components/comments/CommentSidebarWrapper";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { AppSidebar, MobileMenuTrigger } from "@/components/layout/AppSidebar";
import { SidebarContent } from "@/components/layout/SidebarContent";
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
  title: "Briefcase",
  description: "AI-powered deal intelligence for strategic enterprise sales",
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
          <SidebarProvider>
            <div className="sidebar-layout">
              <AppSidebar />
              <SidebarContent>
                {/* Mobile header */}
                <header className="md:hidden sticky top-0 z-30 flex items-center h-14 px-4 border-b bg-background">
                  <MobileMenuTrigger />
                  <Link href="/" className="ml-3 font-semibold text-lg">
                    Briefcase
                  </Link>
                </header>
                <main className="p-6">{children}</main>
              </SidebarContent>
            </div>
            <CommentSidebarWrapper />
            <Toaster position="top-right" richColors />
          </SidebarProvider>
        </CommentSidebarProvider>
      </body>
    </html>
  );
}
