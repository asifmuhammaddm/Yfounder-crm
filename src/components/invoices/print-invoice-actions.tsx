"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintInvoiceActions() {
  return (
    <div className="no-print mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#084154] hover:text-[#4b8f9a]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Invoices
      </Link>

      <Button
        type="button"
        onClick={() => window.print()}
        className="brand-gradient h-9 rounded-xl px-4 text-xs font-semibold text-white"
      >
        <Printer className="mr-1.5 h-4 w-4 text-[#ffbf00]" />
        Print / Save A4 PDF
      </Button>
    </div>
  );
}