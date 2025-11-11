"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Target, Building2, Presentation, Bell, Users } from "lucide-react";

const navItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Opportunities",
    href: "/opportunities",
    icon: Target,
  },
  {
    title: "Prospects",
    href: "/prospects",
    icon: Building2,
  },
  {
    title: "Whiteboarding",
    href: "/whiteboarding",
    icon: Presentation,
  },
  {
    title: "Deal Updates",
    href: "/deal-updates",
    icon: Bell,
  },
];

const adminNavItems = [
  {
    title: "Users",
    href: "/users",
    icon: Users,
    requiredRoles: ["ADMIN", "MANAGER"],
  },
];

export function MainNav() {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserRole() {
      try {
        const res = await fetch("/api/v1/me");
        if (res.ok) {
          const data = await res.json();
          setUserRole(data.user?.role || null);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserRole();
  }, []);

  // Combine nav items with admin items based on user role
  const visibleNavItems = [
    ...navItems,
    ...(!loading && userRole ? adminNavItems.filter((item) => item.requiredRoles.includes(userRole)) : []),
  ];

  return (
    <nav className="flex items-center gap-1">
      {visibleNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
