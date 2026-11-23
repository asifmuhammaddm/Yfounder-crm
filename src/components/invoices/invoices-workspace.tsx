"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Building2,
  Briefcase,
  Calendar,
  Pencil,
  Trash2,
  CreditCard,
  CheckCircle2,
  Sparkles,
  Receipt,
  Clock,
  AlertCircle,
  Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { downloadCsvFile } from "@/lib/csv";
import {
  formatCurrencyAmount,
  useWorkspaceCurrency,
} from "@/lib/currency";
import { CurrencySelect } from "@/components/ui/currency-select";
import type {
  InvoiceStatus,
  InvoiceWithDetails,
  PaymentRecord,
} from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const INVOICE_STATUSES: InvoiceStatus[] = [
  "Draft",
  "Sent",
  "Partially Paid",
  "Paid",
  "Overdue",
  "Void",
];

const PAYMENT_METHODS = [
  "Bank Transfer / Wire",
  "Card / Stripe",
  "UPI / Instant Transfer",
  "Cheque",
  "Cash",
  "Other",
];

export interface InvoiceCompanyOption {
  id: string;
  name: string;
  client_category: string;
}

export interface InvoiceEngagementOption {
  id: string;
  company_id: string;
  title: string;
  total_value: number;
  status: string;
}

function getInvoiceBadgeClass(status: string) {
  switch (status) {
    case "Draft":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "Sent":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "Partially Paid":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "Paid":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Overdue":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "Void":
      return "bg-zinc-100 text-zinc-500 border-zinc-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getDueDatePlusDays(days: number) {
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function generateNextInvoiceNumber(existing: InvoiceWithDetails[]) {
  const year = new Date().getFullYear();
  const nextSeq = existing.length + 1;
  return `YF-${year}-${String(nextSeq).padStart(3, "0")}`;
}

function findLatestEngagementForCompany(
  companyId: string,
  list: InvoiceEngagementOption[]
): InvoiceEngagementOption | undefined {
  if (!companyId) return undefined;
  return list.find((e) => e.company_id === companyId);
}

interface InvoicesWorkspaceProps {
  initialInvoices: InvoiceWithDetails[];
  companies: InvoiceCompanyOption[];
  engagements: InvoiceEngagementOption[];
  defaultCompanyId?: string;
  defaultEngagementId?: string;
  autoOpenCreate?: boolean;
}

export function InvoicesWorkspace({
  initialInvoices,
  companies,
  engagements,
  defaultCompanyId,
  defaultEngagementId,
  autoOpenCreate = false,
}: InvoicesWorkspaceProps) {
  const router = useRouter();
  const didAutoOpenRef = useRef(false);
  const [invoices, setInvoices] =
    useState<InvoiceWithDetails[]>(initialInvoices);
  const [companyOptions, setCompanyOptions] =
    useState<InvoiceCompanyOption[]>(companies);
  const [engagementOptions, setEngagementOptions] =
    useState<InvoiceEngagementOption[]>(engagements);

  // Filters & Shared Currency
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [companyFilter, setCompanyFilter] = useState<string>(
    defaultCompanyId || "All"
  );
  const [currency, setCurrency] = useWorkspaceCurrency("AED");

  // Create / Edit Invoice Modal State
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] =
    useState<InvoiceWithDetails | null>(null);
  const [invNumber, setInvNumber] = useState("");
  const [invCompanyId, setInvCompanyId] = useState<string>(
    defaultCompanyId || companies[0]?.id || ""
  );
  const [invEngagementId, setInvEngagementId] = useState<string>(
    defaultEngagementId || ""
  );
  const [invIssueDate, setInvIssueDate] = useState(getTodayIso());
  const [invDueDate, setInvDueDate] = useState(getDueDatePlusDays(14));
  const [invTotalAmount, setInvTotalAmount] = useState("");
  const [invStatus, setInvStatus] = useState<InvoiceStatus>("Sent");
  const [invNotes, setInvNotes] = useState("");
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [isPreparingModal, setIsPreparingModal] = useState(false);

  // Payment Ledger Modal State
  const [ledgerInvoiceId, setLedgerInvoiceId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(getTodayIso());
  const [payMethod, setPayMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [payReference, setPayReference] = useState("");
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // Sync latest invoices, companies, and engagements on mount
  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function syncLatestBillingData() {
      const [
        { data: latestInvoices },
        { data: latestCompanies },
        { data: latestEngagements },
      ] = await Promise.all([
        supabase
          .from("invoices")
          .select(
            "*, companies(id, name, client_category), engagements(id, title), payments(*)"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("companies")
          .select("id, name, client_category")
          .order("name", { ascending: true }),
        supabase
          .from("engagements")
          .select("id, company_id, title, total_value, status")
          .order("created_at", { ascending: false }),
      ]);

      if (!isMounted) return;
      if (latestInvoices) setInvoices(latestInvoices as InvoiceWithDetails[]);
      if (latestCompanies) {
        setCompanyOptions(latestCompanies as InvoiceCompanyOption[]);
      }
      if (latestEngagements) {
        setEngagementOptions(latestEngagements as InvoiceEngagementOption[]);
      }
    }

    syncLatestBillingData();
    return () => {
      isMounted = false;
    };
  }, []);

  const openCreateInvoiceModal = useCallback(
    async (overrideCompanyId?: string, overrideEngagementId?: string) => {
      setIsPreparingModal(true);
      const supabase = createClient();

      const [{ data: freshCompanies }, { data: freshEngagements }] =
        await Promise.all([
          supabase
            .from("companies")
            .select("id, name, client_category")
            .order("name", { ascending: true }),
          supabase
            .from("engagements")
            .select("id, company_id, title, total_value, status")
            .order("created_at", { ascending: false }),
        ]);

      setIsPreparingModal(false);

      const resolvedCompanies =
        (freshCompanies as InvoiceCompanyOption[]) ?? companyOptions;
      const resolvedEngagements =
        (freshEngagements as InvoiceEngagementOption[]) ?? engagementOptions;

      setCompanyOptions(resolvedCompanies);
      setEngagementOptions(resolvedEngagements);

      if (resolvedCompanies.length === 0) {
        toast.error(
          "Create or convert a Client Company first before issuing an invoice."
        );
        return;
      }

      const targetEngId = overrideEngagementId ?? defaultEngagementId;
      const explicitEng = targetEngId
        ? resolvedEngagements.find((e) => e.id === targetEngId)
        : undefined;

      const initialComp =
        explicitEng?.company_id ||
        overrideCompanyId ||
        (companyFilter !== "All"
          ? companyFilter
          : resolvedCompanies[0]?.id ?? "");

      const autoEngagement =
        explicitEng ??
        findLatestEngagementForCompany(initialComp, resolvedEngagements);

      setEditingInvoice(null);
      setInvNumber(generateNextInvoiceNumber(invoices));
      setInvCompanyId(initialComp);
      setInvEngagementId(autoEngagement?.id ?? "");
      setInvIssueDate(getTodayIso());
      setInvDueDate(getDueDatePlusDays(14));
      setInvTotalAmount(
        autoEngagement && Number(autoEngagement.total_value) > 0
          ? String(autoEngagement.total_value)
          : ""
      );
      setInvStatus("Sent");
      setInvNotes("");
      setInvoiceModalOpen(true);
    },
    [
      companyFilter,
      companyOptions,
      defaultEngagementId,
      engagementOptions,
      invoices,
    ]
  );

  useEffect(() => {
    if (autoOpenCreate && !didAutoOpenRef.current) {
      didAutoOpenRef.current = true;
      void openCreateInvoiceModal(defaultCompanyId, defaultEngagementId);
    }
  }, [
    autoOpenCreate,
    defaultCompanyId,
    defaultEngagementId,
    openCreateInvoiceModal,
  ]);

  const ledgerInvoice = useMemo(
    () => invoices.find((inv) => inv.id === ledgerInvoiceId) ?? null,
    [invoices, ledgerInvoiceId]
  );

  const metrics = useMemo(() => {
    const validInvoices = invoices.filter((inv) => inv.status !== "Void");
    const totalBilled = validInvoices.reduce(
      (sum, inv) => sum + Number(inv.total_amount || 0),
      0
    );
    const totalCollected = validInvoices.reduce(
      (sum, inv) => sum + Number(inv.amount_paid || 0),
      0
    );
    const outstanding = validInvoices
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
    const overdueAmount = validInvoices
      .filter((inv) => inv.status === "Overdue")
      .reduce(
        (sum, inv) =>
          sum +
          Math.max(
            0,
            Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)
          ),
        0
      );

    return { totalBilled, totalCollected, outstanding, overdueAmount };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== "All" && inv.status !== statusFilter) return false;
      if (companyFilter !== "All" && inv.company_id !== companyFilter) {
        return false;
      }

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const haystack = [
        inv.invoice_number,
        inv.companies?.name,
        inv.engagements?.title,
        inv.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [invoices, statusFilter, companyFilter, searchQuery]);

  function handleExportInvoicesCsv() {
    if (filteredInvoices.length === 0) {
      toast.error("No invoices available in the current view to export.");
      return;
    }

    downloadCsvFile(
      "yfounder-invoices",
      [
        "Invoice Number",
        "Client Company",
        "Linked Engagement",
        "Status",
        "Display Currency",
        "Total Billed",
        "Amount Paid",
        "Balance Due",
        "Issue Date",
        "Due Date",
        "Recorded Payments",
        "Notes",
      ],
      filteredInvoices.map((inv) => {
        const total = Number(inv.total_amount || 0);
        const paid = Number(inv.amount_paid || 0);
        const balance = Math.max(0, total - paid);

        return [
          inv.invoice_number,
          inv.companies?.name,
          inv.engagements?.title ?? "Standalone",
          inv.status,
          currency,
          total,
          paid,
          balance,
          inv.issue_date,
          inv.due_date,
          inv.payments?.length ?? 0,
          inv.notes,
        ];
      })
    );
    toast.success(`Exported ${filteredInvoices.length} invoices to CSV`);
  }

  const engagementsForSelectedCompany = useMemo(() => {
    return engagementOptions.filter((e) => e.company_id === invCompanyId);
  }, [engagementOptions, invCompanyId]);

  function openEditInvoiceModal(inv: InvoiceWithDetails) {
    setEditingInvoice(inv);
    setInvNumber(inv.invoice_number);
    setInvCompanyId(inv.company_id);
    setInvEngagementId(inv.engagement_id ?? "");
    setInvIssueDate(inv.issue_date);
    setInvDueDate(inv.due_date);
    setInvTotalAmount(String(inv.total_amount));
    setInvStatus(inv.status as InvoiceStatus);
    setInvNotes(inv.notes ?? "");
    setInvoiceModalOpen(true);
  }

  function openPaymentLedger(inv: InvoiceWithDetails) {
    const remaining = Math.max(
      0,
      Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)
    );
    setLedgerInvoiceId(inv.id);
    setPayAmount(remaining > 0 ? String(remaining) : "");
    setPayDate(getTodayIso());
    setPayMethod(PAYMENT_METHODS[0]);
    setPayReference("");
  }

  async function handleSaveInvoice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!invNumber.trim()) {
      toast.error("Invoice number is required.");
      return;
    }
    if (!invCompanyId) {
      toast.error("Client company is required.");
      return;
    }

    const totalNum = Number(invTotalAmount);
    if (Number.isNaN(totalNum) || totalNum <= 0) {
      toast.error("Invoice total amount must be greater than 0.");
      return;
    }

    if (!invIssueDate || !invDueDate) {
      toast.error("Issue date and due date are required.");
      return;
    }

    setIsSavingInvoice(true);
    const supabase = createClient();

    try {
      if (editingInvoice) {
        const currentPaid = Number(editingInvoice.amount_paid || 0);
        let resolvedStatus: string = invStatus;

        if (
          invStatus !== "Void" &&
          invStatus !== "Draft" &&
          currentPaid >= totalNum
        ) {
          resolvedStatus = "Paid";
        } else if (
          invStatus !== "Void" &&
          invStatus !== "Draft" &&
          currentPaid > 0 &&
          currentPaid < totalNum
        ) {
          resolvedStatus = "Partially Paid";
        }

        const { data, error } = await supabase
          .from("invoices")
          .update({
            invoice_number: invNumber.trim(),
            company_id: invCompanyId,
            engagement_id: invEngagementId || null,
            issue_date: invIssueDate,
            due_date: invDueDate,
            total_amount: totalNum,
            status: resolvedStatus,
            notes: invNotes.trim() || null,
          })
          .eq("id", editingInvoice.id)
          .select(
            "*, companies(id, name, client_category), engagements(id, title), payments(*)"
          )
          .single();

        if (error || !data) {
          throw new Error(error?.message || "Could not update invoice.");
        }

        setInvoices((prev) =>
          prev.map((item) =>
            item.id === editingInvoice.id ? (data as InvoiceWithDetails) : item
          )
        );
        toast.success("Invoice updated");
      } else {
        const initialPaid = invStatus === "Paid" ? totalNum : 0;

        const { data, error } = await supabase
          .from("invoices")
          .insert({
            invoice_number: invNumber.trim(),
            company_id: invCompanyId,
            engagement_id: invEngagementId || null,
            issue_date: invIssueDate,
            due_date: invDueDate,
            total_amount: totalNum,
            amount_paid: initialPaid,
            status: invStatus,
            notes: invNotes.trim() || null,
          })
          .select(
            "*, companies(id, name, client_category), engagements(id, title), payments(*)"
          )
          .single();

        if (error || !data) {
          throw new Error(error?.message || "Could not create invoice.");
        }

        if (invStatus === "Paid") {
          const { data: payRow } = await supabase
            .from("payments")
            .insert({
              invoice_id: data.id,
              amount: totalNum,
              payment_date: invIssueDate,
              method: "Bank Transfer / Wire",
              reference_note: "Marked Paid on Invoice Creation",
            })
            .select()
            .single();

          if (payRow) {
            (data as InvoiceWithDetails).payments = [payRow as PaymentRecord];
          }
        }

        setInvoices((prev) => [data as InvoiceWithDetails, ...prev]);
        toast.success(`Invoice ${invNumber.trim()} created`);
      }

      setInvoiceModalOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save invoice."
      );
    } finally {
      setIsSavingInvoice(false);
    }
  }

  async function handleQuickStatusChange(
    inv: InvoiceWithDetails,
    nextStatus: string
  ) {
    if (nextStatus === inv.status) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("invoices")
      .update({ status: nextStatus })
      .eq("id", inv.id);

    if (error) {
      toast.error(`Status update failed: ${error.message}`);
      return;
    }

    setInvoices((prev) =>
      prev.map((item) =>
        item.id === inv.id ? { ...item, status: nextStatus } : item
      )
    );
    toast.success(`Invoice marked ${nextStatus}`);
    router.refresh();
  }

  async function handleDeleteInvoice(inv: InvoiceWithDetails) {
    const confirmed = window.confirm(
      `Delete invoice ${inv.invoice_number} and its recorded payment entries?`
    );
    if (!confirmed) return;

    const supabase = createClient();
    await supabase.from("payments").delete().eq("invoice_id", inv.id);

    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", inv.id);

    if (error) {
      toast.error(`Could not delete invoice: ${error.message}`);
      return;
    }

    setInvoices((prev) => prev.filter((item) => item.id !== inv.id));
    if (ledgerInvoiceId === inv.id) setLedgerInvoiceId(null);
    toast.success(`Invoice ${inv.invoice_number} deleted`);
    router.refresh();
  }

  async function handleRecordPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ledgerInvoice) return;

    const amountNum = Number(payAmount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      toast.error("Payment amount must be greater than 0.");
      return;
    }

    setIsSavingPayment(true);
    const supabase = createClient();

    try {
      const { data: createdPayment, error: payError } = await supabase
        .from("payments")
        .insert({
          invoice_id: ledgerInvoice.id,
          amount: amountNum,
          payment_date: payDate || getTodayIso(),
          method: payMethod || null,
          reference_note: payReference.trim() || null,
        })
        .select()
        .single();

      if (payError || !createdPayment) {
        throw new Error(payError?.message || "Could not record payment.");
      }

      const updatedPayments = [
        createdPayment as PaymentRecord,
        ...(ledgerInvoice.payments ?? []),
      ];
      const newAmountPaid = updatedPayments.reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0
      );
      const totalInvoice = Number(ledgerInvoice.total_amount || 0);

      let nextStatus: string = ledgerInvoice.status;
      if (ledgerInvoice.status !== "Void") {
        if (newAmountPaid >= totalInvoice) {
          nextStatus = "Paid";
        } else if (newAmountPaid > 0) {
          nextStatus = "Partially Paid";
        }
      }

      const { error: invError } = await supabase
        .from("invoices")
        .update({
          amount_paid: newAmountPaid,
          status: nextStatus,
        })
        .eq("id", ledgerInvoice.id);

      if (invError) {
        throw new Error(invError.message);
      }

      setInvoices((prev) =>
        prev.map((item) =>
          item.id === ledgerInvoice.id
            ? {
                ...item,
                amount_paid: newAmountPaid,
                status: nextStatus,
                payments: updatedPayments,
              }
            : item
        )
      );

      const nextRemaining = Math.max(0, totalInvoice - newAmountPaid);
      setPayAmount(nextRemaining > 0 ? String(nextRemaining) : "");
      setPayReference("");
      toast.success("Payment recorded & balance updated");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to record payment."
      );
    } finally {
      setIsSavingPayment(false);
    }
  }

  async function handleDeletePayment(paymentId: string) {
    if (!ledgerInvoice) return;

    const supabase = createClient();
    const { error: delError } = await supabase
      .from("payments")
      .delete()
      .eq("id", paymentId);

    if (delError) {
      toast.error(delError.message);
      return;
    }

    const updatedPayments = (ledgerInvoice.payments ?? []).filter(
      (p) => p.id !== paymentId
    );
    const newAmountPaid = Math.max(
      0,
      updatedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    );
    const totalInvoice = Number(ledgerInvoice.total_amount || 0);

    let nextStatus: string = ledgerInvoice.status;
    if (ledgerInvoice.status !== "Void" && ledgerInvoice.status !== "Draft") {
      if (newAmountPaid >= totalInvoice) {
        nextStatus = "Paid";
      } else if (newAmountPaid > 0) {
        nextStatus = "Partially Paid";
      } else {
        nextStatus = "Sent";
      }
    }

    await supabase
      .from("invoices")
      .update({
        amount_paid: newAmountPaid,
        status: nextStatus,
      })
      .eq("id", ledgerInvoice.id);

    setInvoices((prev) =>
      prev.map((item) =>
        item.id === ledgerInvoice.id
          ? {
              ...item,
              amount_paid: newAmountPaid,
              status: nextStatus,
              payments: updatedPayments,
            }
          : item
      )
    );
    toast.success("Payment removed & balance recalculated");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#084154]">
            Invoices, Payments & Receivables
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Issue client invoices, log partial or full payments, and track consulting cash flow across currencies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportInvoicesCsv}
            className="h-10 rounded-xl border-slate-200 bg-white px-3.5 text-xs font-semibold text-[#084154]"
          >
            <Download className="mr-1.5 h-4 w-4 text-[#4b8f9a]" />
            Export CSV
          </Button>

          <Button
            type="button"
            disabled={isPreparingModal}
            onClick={() => void openCreateInvoiceModal()}
            className="brand-gradient h-10 rounded-xl px-4 text-xs font-semibold text-white shadow-sm hover:opacity-95"
          >
            <Plus className="mr-1.5 h-4 w-4 text-[#ffbf00]" />
            {isPreparingModal ? "Loading..." : "Create Invoice"}
          </Button>
        </div>
      </div>

      {/* Financial KPI Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Billed
            </p>
            <Receipt className="h-4 w-4 text-[#084154]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#084154]">
            {formatCurrencyAmount(metrics.totalBilled, currency)}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Cash Collected
            </p>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {formatCurrencyAmount(metrics.totalCollected, currency)}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Outstanding Balance
            </p>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {formatCurrencyAmount(metrics.outstanding, currency)}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Overdue Receivables
            </p>
            <AlertCircle className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-600">
            {formatCurrencyAmount(metrics.overdueAmount, currency)}
          </p>
        </div>
      </div>

      {/* Filters & Currency Bar */}
      <div className="glass-card space-y-4 rounded-2xl p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search invoice #, client company, or engagement..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 bg-white pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by client"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#084154]"
            >
              <option value="All">All Client Companies</option>
              {companyOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <CurrencySelect value={currency} onChange={setCurrency} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200/70 pt-3">
          {["All", ...INVOICE_STATUSES].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                statusFilter === st
                  ? "bg-[#4b8f9a] text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-[#4b8f9a]"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table or Empty State */}
      {filteredInvoices.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center">
          <div className="brand-gradient-subtle flex h-12 w-12 items-center justify-center rounded-2xl text-[#084154]">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-bold text-[#084154]">
            {invoices.length === 0
              ? "No client invoices issued yet"
              : "No invoices match your current filters"}
          </h3>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            {invoices.length === 0
              ? "Create your first client invoice linked to a company or won engagement, then record payments as funds arrive."
              : "Try clearing the search bar or switching the status/client filter above."}
          </p>
          {invoices.length === 0 && (
            <Button
              type="button"
              onClick={() => void openCreateInvoiceModal()}
              className="brand-gradient mt-5 rounded-xl font-semibold text-white"
            >
              + Create First Invoice
            </Button>
          )}
        </div>
      ) : (
        <div className="glass-card overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200/80 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">Invoice & Client</th>
                  <th className="px-4 py-3.5">Dates</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Billed / Paid / Due</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {filteredInvoices.map((inv) => {
                  const total = Number(inv.total_amount || 0);
                  const paid = Number(inv.amount_paid || 0);
                  const balance = Math.max(0, total - paid);

                  return (
                    <tr
                      key={inv.id}
                      className="transition-colors hover:bg-white/80"
                    >
                      <td className="px-4 py-4">
                        <p className="font-bold text-[#084154]">
                          {inv.invoice_number}
                        </p>
                        {inv.companies && (
                          <Link
                            href={`/companies/${inv.companies.id}`}
                            className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#4b8f9a] hover:text-[#084154]"
                          >
                            <Building2 className="h-3.5 w-3.5" />
                            {inv.companies.name}
                          </Link>
                        )}
                        {inv.engagements && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                            <Briefcase className="h-3 w-3 text-slate-400" />
                            {inv.engagements.title}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4 text-xs text-slate-600">
                        <p className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          Issued: {inv.issue_date}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 font-medium text-amber-700">
                          <Calendar className="h-3.5 w-3.5" />
                          Due: {inv.due_date}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <select
                          aria-label={`Status for ${inv.invoice_number}`}
                          value={inv.status}
                          onChange={(e) =>
                            handleQuickStatusChange(inv, e.target.value)
                          }
                          className={`rounded-full border px-3 py-1 text-xs font-semibold focus:outline-none ${getInvoiceBadgeClass(
                            inv.status
                          )}`}
                        >
                          {INVOICE_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-4 text-xs">
                        <p className="font-extrabold text-[#084154]">
                          Total: {formatCurrencyAmount(total, currency)}
                        </p>
                        <p className="mt-0.5 text-emerald-700">
                          Paid: {formatCurrencyAmount(paid, currency)}
                        </p>
                        <p
                          className={`mt-0.5 font-semibold ${
                            balance > 0 ? "text-amber-700" : "text-slate-400"
                          }`}
                        >
                          Due: {formatCurrencyAmount(balance, currency)}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => openPaymentLedger(inv)}
                            className="h-8 rounded-lg bg-[#ffbf00] px-3 text-xs font-semibold text-[#084154] hover:bg-[#ffbf00]/90"
                          >
                            <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                            Payments ({inv.payments?.length ?? 0})
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditInvoiceModal(inv)}
                            className="h-8 rounded-lg px-2.5 text-xs"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${inv.invoice_number}`}
                            onClick={() => handleDeleteInvoice(inv)}
                            className="h-8 w-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Invoice Modal */}
      <Dialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen}>
        <DialogContent className="sm:max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#084154]">
              {editingInvoice
                ? `Edit Invoice ${editingInvoice.invoice_number}`
                : "Create Client Invoice"}
            </DialogTitle>
            <DialogDescription>
              Issue an invoice against a client company or active consulting engagement.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveInvoice} className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="inv-num">Invoice Number *</Label>
                <Input
                  id="inv-num"
                  required
                  placeholder="YF-2026-001"
                  value={invNumber}
                  onChange={(e) => setInvNumber(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inv-status">Invoice Status *</Label>
                <select
                  id="inv-status"
                  value={invStatus}
                  onChange={(e) => setInvStatus(e.target.value as InvoiceStatus)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
                >
                  {INVOICE_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="inv-comp">Client Company *</Label>
                <select
                  id="inv-comp"
                  required
                  value={invCompanyId}
                  onChange={(e) => {
                    const nextCompId = e.target.value;
                    setInvCompanyId(nextCompId);
                    const latestEng = findLatestEngagementForCompany(
                      nextCompId,
                      engagementOptions
                    );
                    setInvEngagementId(latestEng?.id ?? "");
                    if (!editingInvoice) {
                      setInvTotalAmount(
                        latestEng && Number(latestEng.total_value) > 0
                          ? String(latestEng.total_value)
                          : ""
                      );
                    }
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
                >
                  {companyOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.client_category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inv-eng">
                  Linked Engagement ({engagementsForSelectedCompany.length}{" "}
                  found)
                </Label>
                <select
                  id="inv-eng"
                  value={invEngagementId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setInvEngagementId(nextId);
                    const match = engagementOptions.find(
                      (item) => item.id === nextId
                    );
                    if (
                      match &&
                      Number(match.total_value) > 0 &&
                      !editingInvoice
                    ) {
                      setInvTotalAmount(String(match.total_value));
                    }
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
                >
                  <option value="">General / Standalone Invoice</option>
                  {engagementsForSelectedCompany.map((eng) => (
                    <option key={eng.id} value={eng.id}>
                      {eng.title} (
                      {formatCurrencyAmount(eng.total_value, currency)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-amount">
                  Total Amount ({currency}) *
                </Label>
                <Input
                  id="inv-amount"
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  placeholder="5000"
                  value={invTotalAmount}
                  onChange={(e) => setInvTotalAmount(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inv-issue">Issue Date *</Label>
                <Input
                  id="inv-issue"
                  type="date"
                  required
                  value={invIssueDate}
                  onChange={(e) => setInvIssueDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inv-due">Due Date *</Label>
                <Input
                  id="inv-due"
                  type="date"
                  required
                  value={invDueDate}
                  onChange={(e) => setInvDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-notes">Payment Instructions / Notes</Label>
              <Textarea
                id="inv-notes"
                rows={3}
                placeholder="Bank IBAN details, milestone description, or tax note..."
                value={invNotes}
                onChange={(e) => setInvNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInvoiceModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingInvoice}
                className="brand-gradient font-semibold text-white"
              >
                {isSavingInvoice
                  ? "Saving..."
                  : editingInvoice
                    ? "Save Invoice"
                    : "Issue Invoice"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Ledger & Record Payment Modal */}
      <Dialog
        open={Boolean(ledgerInvoice)}
        onOpenChange={(open) => !open && setLedgerInvoiceId(null)}
      >
        <DialogContent className="max-h-[92vh] sm:max-w-2xl overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#084154]">
              Payment Ledger · {ledgerInvoice?.invoice_number}
            </DialogTitle>
            <DialogDescription>
              {ledgerInvoice?.companies?.name} · Record received installments or wire transfers and auto-reconcile balance.
            </DialogDescription>
          </DialogHeader>

          {ledgerInvoice && (
            <div className="space-y-5 pt-2">
              <div className="grid grid-cols-3 gap-3 rounded-2xl bg-[#084154]/[0.04] p-4 text-center">
                <div>
                  <p className="text-[11px] font-semibold uppercase text-slate-400">
                    Invoice Total
                  </p>
                  <p className="mt-1 text-base font-extrabold text-[#084154]">
                    {formatCurrencyAmount(ledgerInvoice.total_amount, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase text-slate-400">
                    Collected
                  </p>
                  <p className="mt-1 text-base font-extrabold text-emerald-600">
                    {formatCurrencyAmount(ledgerInvoice.amount_paid, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase text-slate-400">
                    Balance Due
                  </p>
                  <p className="mt-1 text-base font-extrabold text-amber-600">
                    {formatCurrencyAmount(
                      Math.max(
                        0,
                        Number(ledgerInvoice.total_amount || 0) -
                          Number(ledgerInvoice.amount_paid || 0)
                      ),
                      currency
                    )}
                  </p>
                </div>
              </div>

              <form
                onSubmit={handleRecordPayment}
                className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-[#084154]">
                  Record New Payment
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor="pay-amt" className="text-xs">
                      Amount ({currency}) *
                    </Label>
                    <Input
                      id="pay-amt"
                      type="number"
                      min="0.01"
                      step="any"
                      required
                      placeholder="2500"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="pay-date" className="text-xs">
                      Payment Date *
                    </Label>
                    <Input
                      id="pay-date"
                      type="date"
                      required
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      className="bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="pay-method" className="text-xs">
                      Method
                    </Label>
                    <select
                      id="pay-method"
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="Transaction reference / UTR / SWIFT note (optional)"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    className="bg-white text-xs"
                  />
                  <Button
                    type="submit"
                    disabled={isSavingPayment}
                    className="brand-gradient h-9 shrink-0 px-4 text-xs font-semibold text-white"
                  >
                    {isSavingPayment ? "Recording..." : "+ Record Payment"}
                  </Button>
                </div>
              </form>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Recorded Payments ({ledgerInvoice.payments?.length ?? 0})
                </p>

                {!ledgerInvoice.payments ||
                ledgerInvoice.payments.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                    No payments recorded for this invoice yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {ledgerInvoice.payments.map((pay) => (
                      <div
                        key={pay.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs"
                      >
                        <div>
                          <p className="font-bold text-emerald-700">
                            {formatCurrencyAmount(pay.amount, currency)}
                            <span className="ml-2 font-medium text-slate-500">
                              via {pay.method || "Payment"}
                            </span>
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Date: {pay.payment_date}
                            {pay.reference_note
                              ? ` · Ref: ${pay.reference_note}`
                              : ""}
                          </p>
                        </div>

                        <button
                          type="button"
                          aria-label="Delete payment"
                          onClick={() => handleDeletePayment(pay.id)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}