"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Building2,
  Calendar,
  Pencil,
  Trash2,
  FileText,
  FolderKanban,
  CheckCircle2,
  Sparkles,
  Layers,
  Receipt,
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
  BillingType,
  EngagementServiceWithService,
  EngagementStatus,
  EngagementWithDetails,
  ProjectSummaryRecord,
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

const ENGAGEMENT_STATUSES: EngagementStatus[] = [
  "Discovery",
  "Proposal Sent",
  "Negotiation",
  "Won / Active",
  "On Hold",
  "Completed",
  "Lost",
];

const BILLING_TYPES: BillingType[] = ["One-Time", "Monthly Retainer"];

export interface CompanyOption {
  id: string;
  name: string;
  client_category: string;
  status: string;
}

export interface CatalogServiceOption {
  id: string;
  name: string;
  pricing_model: string;
  default_price: number;
  default_deliverables: string | null;
  service_categories: { name: string } | null;
}

interface ScopeLineDraft {
  tempId: string;
  service_id: string;
  agreed_price: string;
  billing_type: BillingType;
  custom_scope: string;
}

function getEngagementBadgeClass(status: string) {
  switch (status) {
    case "Discovery":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "Proposal Sent":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "Negotiation":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "Won / Active":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "On Hold":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "Completed":
      return "bg-teal-50 text-teal-800 border-teal-200";
    case "Lost":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

interface EngagementsWorkspaceProps {
  initialEngagements: EngagementWithDetails[];
  companies: CompanyOption[];
  catalogServices: CatalogServiceOption[];
  initialProjects: ProjectSummaryRecord[];
  currentUserId: string;
  defaultCompanyId?: string;
}

export function EngagementsWorkspace({
  initialEngagements,
  companies,
  catalogServices,
  initialProjects,
  currentUserId,
  defaultCompanyId,
}: EngagementsWorkspaceProps) {
  const router = useRouter();
  const [engagements, setEngagements] =
    useState<EngagementWithDetails[]>(initialEngagements);
  const [projects, setProjects] =
    useState<ProjectSummaryRecord[]>(initialProjects);

  // Filters & Shared Multi-Currency
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [companyFilter, setCompanyFilter] = useState<string>(
    defaultCompanyId || "All"
  );
  const [currency, setCurrency] = useWorkspaceCurrency("AED");

  // Create / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEngagement, setEditingEngagement] =
    useState<EngagementWithDetails | null>(null);
  const [companyId, setCompanyId] = useState<string>(
    defaultCompanyId || companies[0]?.id || ""
  );
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<EngagementStatus>("Proposal Sent");
  const [requirementsSummary, setRequirementsSummary] = useState("");
  const [startDate, setStartDate] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [proposalUrl, setProposalUrl] = useState("");
  const [contractUrl, setContractUrl] = useState("");
  const [manualTotalOverride, setManualTotalOverride] = useState<string>("");
  const [lineItems, setLineItems] = useState<ScopeLineDraft[]>([]);
  const [selectedServiceToAdd, setSelectedServiceToAdd] = useState<string>(
    catalogServices[0]?.id ?? ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  const projectByEngagementId = useMemo(() => {
    const map = new Map<string, ProjectSummaryRecord>();
    for (const p of projects) {
      if (p.engagement_id) {
        map.set(p.engagement_id, p);
      }
    }
    return map;
  }, [projects]);

  const metrics = useMemo(() => {
    const total = engagements.length;
    const wonActive = engagements.filter(
      (e) => e.status === "Won / Active"
    ).length;
    const pipelineValue = engagements
      .filter((e) =>
        ["Discovery", "Proposal Sent", "Negotiation"].includes(e.status)
      )
      .reduce((sum, e) => sum + Number(e.total_value || 0), 0);
    const activeRetainerValue = engagements
      .filter((e) => e.status === "Won / Active")
      .reduce((sum, e) => {
        const lineRetainers = e.engagement_services
          .filter((es) => es.billing_type === "Monthly Retainer")
          .reduce((s, es) => s + Number(es.agreed_price || 0), 0);
        return sum + lineRetainers;
      }, 0);

    return { total, wonActive, pipelineValue, activeRetainerValue };
  }, [engagements]);

  const filteredEngagements = useMemo(() => {
    return engagements.filter((eng) => {
      if (statusFilter !== "All" && eng.status !== statusFilter) return false;
      if (companyFilter !== "All" && eng.company_id !== companyFilter) {
        return false;
      }

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const serviceNames = eng.engagement_services
        .map((es) => es.services?.name ?? "")
        .join(" ");

      const haystack = [
        eng.title,
        eng.companies?.name,
        eng.requirements_summary,
        serviceNames,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [engagements, statusFilter, companyFilter, searchQuery]);

  function handleExportEngagementsCsv() {
    if (filteredEngagements.length === 0) {
      toast.error("No engagements available in the current view to export.");
      return;
    }

    downloadCsvFile(
      "yfounder-engagements",
      [
        "Engagement Title",
        "Client Company",
        "Client Segment",
        "Deal Stage",
        "Display Currency",
        "Total Value",
        "Scoped Services",
        "Start Date",
        "Renewal / Target Date",
        "Proposal URL",
        "Contract URL",
        "Requirements Summary",
        "Created Date",
      ],
      filteredEngagements.map((eng) => [
        eng.title,
        eng.companies?.name,
        eng.companies?.client_category,
        eng.status,
        currency,
        Number(eng.total_value || 0),
        eng.engagement_services
          .map(
            (es) =>
              `${es.services?.name ?? "Custom"} (${es.billing_type}: ${es.agreed_price})`
          )
          .join("; "),
        eng.start_date,
        eng.renewal_date,
        eng.proposal_file_url,
        eng.contract_file_url,
        eng.requirements_summary,
        eng.created_at.slice(0, 10),
      ])
    );
    toast.success(`Exported ${filteredEngagements.length} engagements to CSV`);
  }

  const calculatedLineItemsTotal = useMemo(() => {
    return lineItems.reduce((sum, item) => {
      const val = Number(item.agreed_price);
      return sum + (Number.isNaN(val) ? 0 : val);
    }, 0);
  }, [lineItems]);

  const effectiveTotalValue =
    lineItems.length > 0
      ? calculatedLineItemsTotal
      : Number(manualTotalOverride || 0);

  function openCreateModal() {
    if (companies.length === 0) {
      toast.error(
        "Create or convert a Client Company first before adding an engagement."
      );
      return;
    }

    setEditingEngagement(null);
    setCompanyId(
      companyFilter !== "All" ? companyFilter : companies[0]?.id ?? ""
    );
    setTitle("");
    setStatus("Proposal Sent");
    setRequirementsSummary("");
    setStartDate("");
    setRenewalDate("");
    setProposalUrl("");
    setContractUrl("");
    setManualTotalOverride("0");
    setLineItems([]);
    setSelectedServiceToAdd(catalogServices[0]?.id ?? "");
    setModalOpen(true);
  }

  function openEditModal(eng: EngagementWithDetails) {
    setEditingEngagement(eng);
    setCompanyId(eng.company_id);
    setTitle(eng.title);
    setStatus(eng.status as EngagementStatus);
    setRequirementsSummary(eng.requirements_summary ?? "");
    setStartDate(eng.start_date ?? "");
    setRenewalDate(eng.renewal_date ?? "");
    setProposalUrl(eng.proposal_file_url ?? "");
    setContractUrl(eng.contract_file_url ?? "");
    setManualTotalOverride(String(eng.total_value ?? 0));

    const existingDrafts: ScopeLineDraft[] = eng.engagement_services.map(
      (es) => ({
        tempId: es.id,
        service_id: es.service_id,
        agreed_price: String(es.agreed_price ?? 0),
        billing_type:
          es.billing_type === "Monthly Retainer"
            ? "Monthly Retainer"
            : "One-Time",
        custom_scope: es.custom_scope ?? "",
      })
    );
    setLineItems(existingDrafts);
    setSelectedServiceToAdd(catalogServices[0]?.id ?? "");
    setModalOpen(true);
  }

  function handleAddServiceLine() {
    if (!selectedServiceToAdd) {
      toast.error("Select a service package from the dropdown first.");
      return;
    }

    const catalogMatch = catalogServices.find(
      (s) => s.id === selectedServiceToAdd
    );
    if (!catalogMatch) return;

    const defaultBilling: BillingType =
      catalogMatch.pricing_model === "Monthly Retainer"
        ? "Monthly Retainer"
        : "One-Time";

    const newLine: ScopeLineDraft = {
      tempId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      service_id: catalogMatch.id,
      agreed_price: String(catalogMatch.default_price ?? 0),
      billing_type: defaultBilling,
      custom_scope: catalogMatch.default_deliverables ?? "",
    };

    setLineItems((prev) => [...prev, newLine]);
  }

  function updateLineItem(
    tempId: string,
    patch: Partial<Omit<ScopeLineDraft, "tempId">>
  ) {
    setLineItems((prev) =>
      prev.map((item) => (item.tempId === tempId ? { ...item, ...patch } : item))
    );
  }

  function removeLineItem(tempId: string) {
    setLineItems((prev) => prev.filter((item) => item.tempId !== tempId));
  }

  async function handleSaveEngagement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!companyId) {
      toast.error("Please select a client company.");
      return;
    }
    if (!title.trim()) {
      toast.error("Engagement title is required.");
      return;
    }

    for (const item of lineItems) {
      const priceNum = Number(item.agreed_price);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        toast.error("All service prices must be 0 or greater.");
        return;
      }
    }

    const finalTotal = Number(effectiveTotalValue);
    if (Number.isNaN(finalTotal) || finalTotal < 0) {
      toast.error("Total deal value must be 0 or greater.");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();

    const engagementPayload = {
      company_id: companyId,
      title: title.trim(),
      requirements_summary: requirementsSummary.trim() || null,
      status,
      total_value: finalTotal,
      start_date: startDate || null,
      renewal_date: renewalDate || null,
      proposal_file_url: proposalUrl.trim() || null,
      contract_file_url: contractUrl.trim() || null,
      owner_id: currentUserId || null,
    };

    try {
      let savedEngagementId = editingEngagement?.id ?? "";
      let savedHeaderRow: EngagementWithDetails | null = null;

      if (editingEngagement) {
        const { data, error } = await supabase
          .from("engagements")
          .update(engagementPayload)
          .eq("id", editingEngagement.id)
          .select("*, companies(id, name, client_category)")
          .single();

        if (error || !data) {
          throw new Error(error?.message || "Could not update engagement.");
        }

        savedEngagementId = data.id;
        savedHeaderRow = {
          ...(data as EngagementWithDetails),
          engagement_services: [],
        };

        const { error: delError } = await supabase
          .from("engagement_services")
          .delete()
          .eq("engagement_id", savedEngagementId);

        if (delError) {
          throw new Error(delError.message);
        }
      } else {
        const { data, error } = await supabase
          .from("engagements")
          .insert(engagementPayload)
          .select("*, companies(id, name, client_category)")
          .single();

        if (error || !data) {
          throw new Error(error?.message || "Could not create engagement.");
        }

        savedEngagementId = data.id;
        savedHeaderRow = {
          ...(data as EngagementWithDetails),
          engagement_services: [],
        };
      }

      let savedServices: EngagementServiceWithService[] = [];
      if (lineItems.length > 0) {
        const serviceRowsToInsert = lineItems.map((item) => ({
          engagement_id: savedEngagementId,
          service_id: item.service_id,
          custom_scope: item.custom_scope.trim() || null,
          agreed_price: Number(item.agreed_price) || 0,
          billing_type: item.billing_type,
        }));

        const { data: insertedLines, error: linesError } = await supabase
          .from("engagement_services")
          .insert(serviceRowsToInsert)
          .select("*, services(id, name, pricing_model)");

        if (linesError) {
          throw new Error(linesError.message);
        }

        savedServices = (insertedLines as EngagementServiceWithService[]) ?? [];
      }

      if (status === "Won / Active") {
        await supabase
          .from("companies")
          .update({ status: "Active Client" })
          .eq("id", companyId)
          .eq("status", "Prospect");
      }

      const fullRecord: EngagementWithDetails = {
        ...savedHeaderRow,
        engagement_services: savedServices,
      };

      if (editingEngagement) {
        setEngagements((prev) =>
          prev.map((item) =>
            item.id === editingEngagement.id ? fullRecord : item
          )
        );
        toast.success("Engagement & scope updated");
      } else {
        setEngagements((prev) => [fullRecord, ...prev]);
        toast.success("Engagement created");
      }

      setModalOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save engagement."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteEngagement(eng: EngagementWithDetails) {
    const confirmed = window.confirm(
      `Delete engagement "${eng.title}" and its scoped service lines?`
    );
    if (!confirmed) return;

    const supabase = createClient();

    await supabase
      .from("projects")
      .update({ engagement_id: null })
      .eq("engagement_id", eng.id);

    await supabase
      .from("engagement_services")
      .delete()
      .eq("engagement_id", eng.id);

    const { error } = await supabase
      .from("engagements")
      .delete()
      .eq("id", eng.id);

    if (error) {
      toast.error(`Could not delete engagement: ${error.message}`);
      return;
    }

    setEngagements((prev) => prev.filter((item) => item.id !== eng.id));
    setProjects((prev) =>
      prev.map((p) =>
        p.engagement_id === eng.id ? { ...p, engagement_id: null } : p
      )
    );
    toast.success("Engagement deleted");
    router.refresh();
  }

  async function handleQuickStatusChange(
    eng: EngagementWithDetails,
    nextStatus: string
  ) {
    if (nextStatus === eng.status) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("engagements")
      .update({ status: nextStatus })
      .eq("id", eng.id);

    if (error) {
      toast.error(`Stage update failed: ${error.message}`);
      return;
    }

    if (nextStatus === "Won / Active") {
      await supabase
        .from("companies")
        .update({ status: "Active Client" })
        .eq("id", eng.company_id)
        .eq("status", "Prospect");
    }

    setEngagements((prev) =>
      prev.map((item) =>
        item.id === eng.id ? { ...item, status: nextStatus } : item
      )
    );
    toast.success(`Engagement moved to ${nextStatus}`);
    router.refresh();
  }

  async function handleLaunchProject(eng: EngagementWithDetails) {
    const existing = projectByEngagementId.get(eng.id);
    if (existing) {
      router.push("/projects");
      return;
    }

    setLaunchingId(eng.id);
    const supabase = createClient();

    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("projects")
        .insert({
          company_id: eng.company_id,
          engagement_id: eng.id,
          title: eng.title,
          status: "Not Started",
          start_date: eng.start_date || todayIso,
          due_date: eng.renewal_date || null,
          owner_id: currentUserId || null,
        })
        .select("id, engagement_id, title, status")
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Could not create project.");
      }

      setProjects((prev) => [data as ProjectSummaryRecord, ...prev]);
      toast.success(`Project "${eng.title}" launched!`);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to launch project."
      );
    } finally {
      setLaunchingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#084154]">
            Engagements & Scope Builder
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Package modular services into client proposals, track deal stages, and kick off delivery projects.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportEngagementsCsv}
            className="h-10 rounded-xl border-slate-200 bg-white px-3.5 text-xs font-semibold text-[#084154]"
          >
            <Download className="mr-1.5 h-4 w-4 text-[#4b8f9a]" />
            Export CSV
          </Button>

          <Button
            type="button"
            onClick={openCreateModal}
            className="brand-gradient h-10 rounded-xl px-4 text-xs font-semibold text-white shadow-sm hover:opacity-95"
          >
            <Plus className="mr-1.5 h-4 w-4 text-[#ffbf00]" />
            New Engagement / Proposal
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Engagements
          </p>
          <p className="mt-2 text-2xl font-bold text-[#084154]">
            {metrics.total}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Won / Active Deals
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {metrics.wonActive}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Open Proposal Pipeline
          </p>
          <p className="mt-2 text-2xl font-bold text-[#4b8f9a]">
            {formatCurrencyAmount(metrics.pipelineValue, currency)}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Active Monthly Retainers
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {formatCurrencyAmount(metrics.activeRetainerValue, currency)}
          </p>
        </div>
      </div>

      {/* Filters & Currency Bar */}
      <div className="glass-card space-y-4 rounded-2xl p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search engagement title, client, or service..."
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
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <CurrencySelect value={currency} onChange={setCurrency} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200/70 pt-3">
          {["All", ...ENGAGEMENT_STATUSES].map((st) => (
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

      {/* Engagements List */}
      {filteredEngagements.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center">
          <div className="brand-gradient-subtle flex h-12 w-12 items-center justify-center rounded-2xl text-[#084154]">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-bold text-[#084154]">
            {engagements.length === 0
              ? "No client engagements or proposals yet"
              : "No engagements match your current filters"}
          </h3>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            {engagements.length === 0
              ? "Create your first consulting proposal by selecting a client company and attaching services from your modular catalog."
              : "Try clearing the search bar or switching the stage/client filter above."}
          </p>
          {engagements.length === 0 && (
            <Button
              type="button"
              onClick={openCreateModal}
              className="brand-gradient mt-5 rounded-xl font-semibold text-white"
            >
              + Create First Proposal / Engagement
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEngagements.map((eng) => {
            const linkedProject = projectByEngagementId.get(eng.id);

            return (
              <div
                key={eng.id}
                className="glass-card rounded-2xl p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-lg font-bold text-[#084154]">
                        {eng.title}
                      </h2>

                      <select
                        aria-label={`Stage for ${eng.title}`}
                        value={eng.status}
                        onChange={(e) =>
                          handleQuickStatusChange(eng, e.target.value)
                        }
                        className={`rounded-full border px-3 py-0.5 text-xs font-semibold focus:outline-none ${getEngagementBadgeClass(
                          eng.status
                        )}`}
                      >
                        {ENGAGEMENT_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>

                      <span className="rounded-lg bg-[#084154]/8 px-2.5 py-0.5 text-xs font-extrabold text-[#084154]">
                        {formatCurrencyAmount(eng.total_value, currency)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      {eng.companies && (
                        <Link
                          href={`/companies/${eng.companies.id}`}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#4b8f9a] hover:text-[#084154]"
                        >
                          <Building2 className="h-3.5 w-3.5" />
                          {eng.companies.name} ({eng.companies.client_category})
                        </Link>
                      )}

                      {eng.start_date && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          Start: {eng.start_date}
                        </span>
                      )}

                      {eng.renewal_date && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-amber-500" />
                          Renewal / Target: {eng.renewal_date}
                        </span>
                      )}

                      {eng.proposal_file_url && (
                        <a
                          href={eng.proposal_file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-[#084154] underline-offset-2 hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5 text-[#4b8f9a]" />
                          Proposal Doc
                        </a>
                      )}

                      {eng.contract_file_url && (
                        <a
                          href={eng.contract_file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-[#084154] underline-offset-2 hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5 text-emerald-600" />
                          Signed Contract
                        </a>
                      )}
                    </div>

                    {eng.requirements_summary && (
                      <p className="max-w-3xl text-xs leading-relaxed text-slate-600">
                        {eng.requirements_summary}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <Link
                      href={`/invoices?companyId=${eng.company_id}&engagementId=${eng.id}&new=1`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#084154] hover:border-[#084154]"
                    >
                      <Receipt className="h-3.5 w-3.5 text-[#4b8f9a]" />
                      Invoice
                    </Link>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(eng)}
                      className="h-8 rounded-lg px-3 text-xs font-semibold text-[#084154]"
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit Scope
                    </Button>

                    {linkedProject ? (
                      <Link
                        href="/projects"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Project Launched
                      </Link>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={launchingId === eng.id}
                        onClick={() => handleLaunchProject(eng)}
                        className="h-8 rounded-lg bg-[#ffbf00] px-3 text-xs font-semibold text-[#084154] hover:bg-[#ffbf00]/90"
                      >
                        <FolderKanban className="mr-1.5 h-3.5 w-3.5" />
                        {launchingId === eng.id
                          ? "Launching..."
                          : "Launch Project"}
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${eng.title}`}
                      onClick={() => handleDeleteEngagement(eng)}
                      className="h-8 w-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Attached Services Breakdown */}
                {eng.engagement_services.length > 0 && (
                  <div className="mt-4 border-t border-slate-200/70 pt-3.5">
                    <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <Layers className="h-3.5 w-3.5 text-[#4b8f9a]" />
                      Scoped Service Modules ({eng.engagement_services.length})
                    </p>
                    <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                      {eng.engagement_services.map((line) => (
                        <div
                          key={line.id}
                          className="rounded-xl border border-slate-200/80 bg-white/80 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-[#084154]">
                              {line.services?.name ?? "Custom Service"}
                            </p>
                            <span className="shrink-0 rounded bg-[#4b8f9a]/12 px-2 py-0.5 text-[10px] font-semibold text-[#084154]">
                              {line.billing_type}
                            </span>
                          </div>
                          <p className="mt-1 text-xs font-extrabold text-[#4b8f9a]">
                            {formatCurrencyAmount(line.agreed_price, currency)}
                            {line.billing_type === "Monthly Retainer"
                              ? " / mo"
                              : ""}
                          </p>
                          {line.custom_scope && (
                            <p className="mt-1.5 line-clamp-2 whitespace-pre-line text-[11px] text-slate-500">
                              {line.custom_scope}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Engagement & Scope Builder Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[92vh] sm:max-w-3xl overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#084154]">
              {editingEngagement
                ? "Edit Engagement & Service Scope"
                : "New Client Engagement & Scope Builder"}
            </DialogTitle>
            <DialogDescription>
              Select a client organization, build a modular scope from your service catalog, and set commercial terms.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEngagement} className="space-y-5 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="eng-company">Client Company *</Label>
                <select
                  id="eng-company"
                  required
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.client_category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="eng-status">Deal Stage *</Label>
                <select
                  id="eng-status"
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as EngagementStatus)
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
                >
                  {ENGAGEMENT_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="eng-title">Engagement / Proposal Title *</Label>
              <Input
                id="eng-title"
                required
                placeholder="e.g., Q4 Growth Retainer & UAE Entity Structuring"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="eng-start">Start Date</Label>
                <Input
                  id="eng-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="eng-renewal">Renewal / End Date</Label>
                <Input
                  id="eng-renewal"
                  type="date"
                  value={renewalDate}
                  onChange={(e) => setRenewalDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="eng-req">Client Objectives & Requirements</Label>
              <Textarea
                id="eng-req"
                rows={2}
                placeholder="Executive summary of client goals, KPIs, and advisory timeline..."
                value={requirementsSummary}
                onChange={(e) => setRequirementsSummary(e.target.value)}
              />
            </div>

            {/* Modular Scope Builder Box */}
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#084154]">
                    Modular Scope & Service Line Items
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Attach services from your catalog and customize deliverables or negotiated pricing.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <CurrencySelect value={currency} onChange={setCurrency} />
                  <div className="rounded-xl bg-[#084154] px-3 py-1.5 text-xs font-bold text-white">
                    Total: {formatCurrencyAmount(effectiveTotalValue, currency)}
                  </div>
                </div>
              </div>

              {catalogServices.length > 0 ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    aria-label="Choose catalog service"
                    value={selectedServiceToAdd}
                    onChange={(e) => setSelectedServiceToAdd(e.target.value)}
                    className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800"
                  >
                    {catalogServices.map((srv) => (
                      <option key={srv.id} value={srv.id}>
                        {srv.name} ({srv.pricing_model} ·{" "}
                        {formatCurrencyAmount(srv.default_price, currency)})
                      </option>
                    ))}
                  </select>

                  <Button
                    type="button"
                    onClick={handleAddServiceLine}
                    className="h-9 rounded-lg bg-[#4b8f9a] px-3.5 text-xs font-semibold text-white hover:bg-[#084154]"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add to Scope
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-amber-700">
                  Your Service Catalog has no active services yet. You can still enter a total deal value below or add packages in Service Catalog first.
                </p>
              )}

              {lineItems.length === 0 ? (
                <div className="space-y-2 pt-1">
                  <Label htmlFor="eng-manual-total">
                    Deal Value ({currency}) *
                  </Label>
                  <Input
                    id="eng-manual-total"
                    type="number"
                    min="0"
                    step="any"
                    value={manualTotalOverride}
                    onChange={(e) => setManualTotalOverride(e.target.value)}
                    className="bg-white"
                  />
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {lineItems.map((item, index) => {
                    const srvMeta = catalogServices.find(
                      (s) => s.id === item.service_id
                    );

                    return (
                      <div
                        key={item.tempId}
                        className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#084154]">
                            {index + 1}. {srvMeta?.name ?? "Selected Service"}
                          </span>

                          <button
                            type="button"
                            onClick={() => removeLineItem(item.tempId)}
                            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Billing Structure</Label>
                            <select
                              value={item.billing_type}
                              onChange={(e) =>
                                updateLineItem(item.tempId, {
                                  billing_type: e.target.value as BillingType,
                                })
                              }
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800"
                            >
                              {BILLING_TYPES.map((bt) => (
                                <option key={bt} value={bt}>
                                  {bt}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">
                              Agreed Price ({currency})
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={item.agreed_price}
                              onChange={(e) =>
                                updateLineItem(item.tempId, {
                                  agreed_price: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">
                            Custom Deliverables & Scope Notes
                          </Label>
                          <Textarea
                            rows={2}
                            value={item.custom_scope}
                            onChange={(e) =>
                              updateLineItem(item.tempId, {
                                custom_scope: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Optional Proposal & Contract Links */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="eng-prop-url">Proposal Document URL</Label>
                <Input
                  id="eng-prop-url"
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={proposalUrl}
                  onChange={(e) => setProposalUrl(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="eng-cont-url">Signed Contract URL</Label>
                <Input
                  id="eng-cont-url"
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={contractUrl}
                  onChange={(e) => setContractUrl(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="brand-gradient font-semibold text-white"
              >
                {isSaving
                  ? "Saving..."
                  : editingEngagement
                    ? "Save Engagement"
                    : "Create Engagement"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}