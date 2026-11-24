"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  LayoutDashboard,
  UserPlus,
  Building2,
  Briefcase,
  FolderKanban,
  CheckSquare,
  Receipt,
  Layers,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const primaryNav = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: UserPlus },
  { label: "Clients & Companies", href: "/companies", icon: Building2 },
  { label: "Engagements", href: "/engagements", icon: Briefcase },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Tasks & Follow-Ups", href: "/tasks", icon: CheckSquare },
  { label: "Invoices & Billing", href: "/invoices", icon: Receipt },
];

const catalogNav = [
  { label: "Service Catalog", href: "/services", icon: Layers },
  { label: "Billing & FX Settings", href: "/settings", icon: Settings },
];

interface CrmSidebarProps {
  userEmail: string;
}

export function CrmSidebar({ userEmail }: CrmSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActiveRoute(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  }

  const navContent = (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="space-y-6">
        <div className="px-2 pt-1">
          <BrandLogo />
        </div>

        <nav className="space-y-1" aria-label="Primary Navigation">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Operations
          </p>
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const active = isActiveRoute(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "brand-gradient text-white shadow-sm"
                    : "text-slate-600 hover:bg-[#084154]/5 hover:text-[#084154]"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    active ? "text-[#ffbf00]" : "text-slate-400"
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <nav
          className="space-y-1 border-t border-slate-200/70 pt-4"
          aria-label="Catalog Navigation"
        >
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Configuration
          </p>
          {catalogNav.map((item) => {
            const Icon = item.icon;
            const active = isActiveRoute(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "brand-gradient text-white shadow-sm"
                    : "text-slate-600 hover:bg-[#084154]/5 hover:text-[#084154]"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    active ? "text-[#ffbf00]" : "text-slate-400"
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 border-t border-slate-200/70 pt-4">
        <div className="rounded-xl bg-[#084154]/5 px-3 py-2.5">
          <p className="text-[11px] font-medium text-slate-400">Signed in as</p>
          <p
            className="truncate text-xs font-semibold text-[#084154]"
            title={userEmail}
          >
            {userEmail}
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-2.5 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <header className="glass-card sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 px-4 py-3 lg:hidden">
        <BrandLogo />
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            aria-label="Open menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#084154] shadow-xs transition-colors hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent className="w-72 bg-[#f8f9fa] p-0" side="left">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            {navContent}
          </SheetContent>
        </Sheet>
      </header>

      <aside className="glass-card hidden w-64 shrink-0 border-r border-slate-200/80 lg:block">
        <div className="sticky top-0 h-screen overflow-y-auto">{navContent}</div>
      </aside>
    </>
  );
}