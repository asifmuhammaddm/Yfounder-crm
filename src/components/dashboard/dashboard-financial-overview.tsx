"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Receipt, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  formatCurrencyAmount,
  useWorkspaceCurrency,
} from "@/lib/currency";
import { CurrencySelect } from "@/components/ui/currency-select";
import type { InvoiceRecord } from "@/types/crm";

interface DashboardFinancialOverviewProps {
  initialInvoices: InvoiceRecord[];
}

export function DashboardFinancialOverview({
  initialInvoices,
}: DashboardFinancialOverviewProps) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(initialInvoices);
  const [currency, setCurrency] = useWorkspaceCurrency("AED");

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function fetchLatestInvoices() {
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });

      if (isMounted && data) {
        setInvoices(data as InvoiceRecord[]);
      }
    }

    fetchLatestInvoices();
    return () => {
      isMounted = false;
    };
  }, []);

  const summary = useMemo(() => {
    const active = invoices.filter((inv) => inv.status !== "Void");
    const billed = active.reduce(
      (sum, inv) => sum + Number(inv.total_amount || 0),
      0
    );
    const collected = active.reduce(
      (sum, inv) => sum + Number(inv.amount_paid || 0),
      0
    );
    const outstanding = active
      .filter((inv) => inv.status !== "Paid" && inv.status !== "Draft")
      .reduce(
        (sum, inv) =>
          sum +
          Math.max(
            0,
            Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)
          ),
        0
      );
    const overdueCount = active.filter((inv) => inv.status === "Overdue").length;

    return { billed, collected, outstanding, overdueCount };
  }, [invoices]);

  return (
    <div className="glass-card rounded-2xl p-6 space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="brand-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white">
            <Receipt className="h-5 w-5 text-[#ffbf00]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#084154]">
              Financial Overview & Receivables
            </h2>
            <p className="text-xs text-slate-500">
              Live consulting revenue, collected payments, and open receivables.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <CurrencySelect value={currency} onChange={setCurrency} />
          <Link
            href="/invoices"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#084154] px-3.5 text-xs font-semibold text-white hover:bg-[#4b8f9a]"
          >
            Open Invoices
            <ArrowRight className="h-3.5 w-3.5 text-[#ffbf00]" />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Total Billed
          </p>
          <p className="mt-1.5 text-xl font-extrabold text-[#084154]">
            {formatCurrencyAmount(summary.billed, currency)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Cash Collected
          </p>
          <p className="mt-1.5 text-xl font-extrabold text-emerald-600">
            {formatCurrencyAmount(summary.collected, currency)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Outstanding Receivables
          </p>
          <p className="mt-1.5 text-xl font-extrabold text-amber-600">
            {formatCurrencyAmount(summary.outstanding, currency)}
          </p>
          {summary.overdueCount > 0 && (
            <p className="mt-1 text-[11px] font-semibold text-rose-600">
              {summary.overdueCount} overdue{" "}
              {summary.overdueCount === 1 ? "invoice" : "invoices"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}