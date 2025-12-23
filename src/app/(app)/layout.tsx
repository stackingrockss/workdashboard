import Link from "next/link";
import { CommentSidebarProvider } from "@/components/comments/CommentSidebarContext";
import { CommentSidebarWrapper } from "@/components/comments/CommentSidebarWrapper";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { AppSidebar, MobileMenuTrigger } from "@/components/layout/AppSidebar";
import { SidebarContent } from "@/components/layout/SidebarContent";
import { CommandPalette } from "@/components/layout/CommandPalette";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <CommentSidebarProvider>
      <SidebarProvider>
        <div className="sidebar-layout">
          <AppSidebar />
          <SidebarContent>
            {/* Mobile header */}
            <header className="md:hidden sticky top-0 z-30 flex items-center h-14 px-4 border-b bg-background">
              <MobileMenuTrigger />
              <Link href="/dashboard" className="ml-3 font-semibold text-lg">
                Briefcase
              </Link>
            </header>
            <main className="p-6">{children}</main>
          </SidebarContent>
        </div>
        <CommentSidebarWrapper />
        <CommandPalette />
      </SidebarProvider>
    </CommentSidebarProvider>
  );
}
