import Link from "next/link";
import {
  UserPlus,
  Building2,
  Briefcase,
  FolderKanban,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DashboardTasksWidget } from "@/components/dashboard/dashboard-tasks-widget";
import { DashboardFinancialOverview } from "@/components/dashboard/dashboard-financial-overview";
import type { InvoiceRecord, TaskWithDetails } from "@/types/crm";

export default async function DashboardHomePage() {
  const supabase = await createClient();

  const [
    { count: activeLeadsCount },
    { count: activeClientsCount },
    { count: openEngagementsCount },
    { count: activeProjectsCount },
    { data: openTasks },
    { data: invoices },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .not("status", "in", '("Converted","Unqualified")'),
    supabase
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("status", "Active Client"),
    supabase
      .from("engagements")
      .select("*", { count: "exact", head: true })
      .in("status", ["Discovery", "Proposal Sent", "Negotiation", "Won / Active"]),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .not("status", "in", '("Completed","Cancelled")'),
    supabase
      .from("tasks")
      .select("*, companies(id, name), projects(id, title)")
      .neq("status", "Done")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  const summaryCards = [
    {
      label: "Active Leads",
      value: String(activeLeadsCount ?? 0),
      helper: "Open pipeline prospects",
      icon: UserPlus,
      href: "/leads",
    },
    {
      label: "Active Clients",
      value: String(activeClientsCount ?? 0),
      helper: "Startups · SMB · Enterprise",
      icon: Building2,
      href: "/companies",
    },
    {
      label: "Open Engagements",
      value: String(openEngagementsCount ?? 0),
      helper: "Proposals & active retainers",
      icon: Briefcase,
      href: "/engagements",
    },
    {
      label: "Active Projects",
      value: String(activeProjectsCount ?? 0),
      helper: "Delivery & milestones",
      icon: FolderKanban,
      href: "/projects",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="brand-gradient relative overflow-hidden rounded-2xl p-6 text-white shadow-md sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-[#ffbf00]">
              <Sparkles className="h-3.5 w-3.5" />
              Workspace Authenticated
            </span>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome to YFounder CRM
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/85">
              Your 360-degree consulting operations hub is active. Track client
              delivery projects, milestones, proposals, and receivables.
            </p>
          </div>

          <Link
            href="/invoices"
            className="inline-flex items-center justify-center rounded-xl bg-[#ffbf00] px-5 py-2.5 text-sm font-semibold text-[#084154] shadow-sm transition-opacity hover:bg-[#ffbf00]/90"
          >
            Invoices & Billing →
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="glass-card block rounded-2xl p-5 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {card.label}
                </span>
                <div className="brand-gradient-subtle flex h-9 w-9 items-center justify-center rounded-xl text-[#084154]">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-bold text-[#084154]">
                {card.value}
              </p>
              <p className="mt-1 text-xs text-slate-400">{card.helper}</p>
            </Link>
          );
        })}
      </div>

      <DashboardFinancialOverview
        initialInvoices={(invoices as InvoiceRecord[]) ?? []}
      />

      <DashboardTasksWidget
        initialTasks={(openTasks as TaskWithDetails[]) ?? []}
      />
    </div>
  );
}