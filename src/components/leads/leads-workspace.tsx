"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  UserPlus,
  Search,
  Building2,
  Mail,
  Phone,
  Calendar,
  ArrowUpRight,
  CheckCircle2,
  Pencil,
  Trash2,
  Sparkles,
  Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { downloadCsvFile } from "@/lib/csv";
import type { ClientCategory, LeadRecord, LeadStatus } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const LEAD_STATUSES: LeadStatus[] = [
  "New",
  "Contacted",
  "Qualified",
  "Converted",
  "Unqualified",
];

const CLIENT_CATEGORIES: ClientCategory[] = ["Startup", "SMB", "Enterprise"];

const LEAD_SOURCES = [
  "LinkedIn",
  "Referral",
  "Website Inbound",
  "Cold Outreach",
  "Networking / Event",
  "Partner Intro",
  "Other",
];

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "New":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "Contacted":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "Qualified":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "Converted":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Unqualified":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function normalizeCompanyName(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

interface LeadsWorkspaceProps {
  initialLeads: LeadRecord[];
  currentUserId: string;
}

export function LeadsWorkspace({
  initialLeads,
  currentUserId,
}: LeadsWorkspaceProps) {
  const router = useRouter();
  const [leads, setLeads] = useState<LeadRecord[]>(initialLeads);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  // Create Lead Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [clientCategory, setClientCategory] = useState<ClientCategory>("Startup");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("LinkedIn");
  const [nextFollowupDate, setNextFollowupDate] = useState("");
  const [notes, setNotes] = useState("");

  // Edit Lead Modal State
  const [editingLead, setEditingLead] = useState<LeadRecord | null>(null);
  const [editContactName, setEditContactName] = useState("");
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editCategory, setEditCategory] = useState<string>("Startup");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editStatus, setEditStatus] = useState<string>("New");
  const [editFollowup, setEditFollowup] = useState("");
  const [editLostReason, setEditLostReason] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Convert Lead State
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const total = leads.length;
    const open = leads.filter(
      (l) => l.status !== "Converted" && l.status !== "Unqualified"
    ).length;
    const qualified = leads.filter((l) => l.status === "Qualified").length;
    const converted = leads.filter(
      (l) => l.status === "Converted" || Boolean(l.converted_company_id)
    ).length;
    return { total, open, qualified, converted };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesStatus =
        statusFilter === "All" || lead.status === statusFilter;
      const matchesCategory =
        categoryFilter === "All" || lead.client_category === categoryFilter;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesStatus && matchesCategory;

      const haystack = [
        lead.contact_name,
        lead.company_name,
        lead.email,
        lead.phone,
        lead.source,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && matchesCategory && haystack.includes(q);
    });
  }, [leads, searchQuery, statusFilter, categoryFilter]);

  function handleExportLeadsCsv() {
    if (filteredLeads.length === 0) {
      toast.error("No leads available in the current view to export.");
      return;
    }

    downloadCsvFile(
      "yfounder-leads",
      [
        "Contact Name",
        "Company Name",
        "Client Segment",
        "Stage",
        "Email",
        "Phone",
        "Source",
        "Next Follow-Up",
        "Unqualified Reason",
        "Notes",
        "Created Date",
      ],
      filteredLeads.map((lead) => [
        lead.contact_name,
        lead.company_name,
        lead.client_category,
        lead.status,
        lead.email,
        lead.phone,
        lead.source,
        lead.next_followup_date,
        lead.lost_reason,
        lead.notes,
        lead.created_at.slice(0, 10),
      ])
    );
    toast.success(`Exported ${filteredLeads.length} leads to CSV`);
  }

  function resetCreateForm() {
    setContactName("");
    setCompanyName("");
    setClientCategory("Startup");
    setEmail("");
    setPhone("");
    setSource("LinkedIn");
    setNextFollowupDate("");
    setNotes("");
  }

  async function handleCreateLead(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!contactName.trim()) {
      toast.error("Contact name is required.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    const payload = {
      contact_name: contactName.trim(),
      company_name: companyName.trim() || null,
      client_category: clientCategory,
      email: email.trim() || null,
      phone: phone.trim() || null,
      source: source || null,
      status: "New",
      next_followup_date: nextFollowupDate || null,
      notes: notes.trim() || null,
      owner_id: currentUserId || null,
    };

    const { data, error } = await supabase
      .from("leads")
      .insert(payload)
      .select()
      .single();

    setIsSubmitting(false);

    if (error) {
      toast.error(`Could not create lead: ${error.message}`);
      return;
    }

    setLeads((prev) => [data as LeadRecord, ...prev]);
    toast.success("Lead added to pipeline");
    resetCreateForm();
    setCreateOpen(false);
    router.refresh();
  }

  function openEditModal(lead: LeadRecord) {
    setEditingLead(lead);
    setEditContactName(lead.contact_name);
    setEditCompanyName(lead.company_name ?? "");
    setEditCategory(lead.client_category);
    setEditEmail(lead.email ?? "");
    setEditPhone(lead.phone ?? "");
    setEditSource(lead.source ?? "LinkedIn");
    setEditStatus(lead.status);
    setEditFollowup(lead.next_followup_date ?? "");
    setEditLostReason(lead.lost_reason ?? "");
    setEditNotes(lead.notes ?? "");
  }

  async function handleUpdateLead(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingLead) return;
    if (!editContactName.trim()) {
      toast.error("Contact name is required.");
      return;
    }

    setIsUpdating(true);
    const supabase = createClient();

    const updates = {
      contact_name: editContactName.trim(),
      company_name: editCompanyName.trim() || null,
      client_category: editCategory,
      email: editEmail.trim() || null,
      phone: editPhone.trim() || null,
      source: editSource || null,
      status: editStatus,
      next_followup_date: editFollowup || null,
      lost_reason:
        editStatus === "Unqualified" ? editLostReason.trim() || null : null,
      notes: editNotes.trim() || null,
    };

    const { data, error } = await supabase
      .from("leads")
      .update(updates)
      .eq("id", editingLead.id)
      .select()
      .single();

    setIsUpdating(false);

    if (error) {
      toast.error(`Update failed: ${error.message}`);
      return;
    }

    setLeads((prev) =>
      prev.map((item) =>
        item.id === editingLead.id ? (data as LeadRecord) : item
      )
    );
    toast.success("Lead updated");
    setEditingLead(null);
    router.refresh();
  }

  async function handleDeleteLead(lead: LeadRecord) {
    const confirmed = window.confirm(
      `Delete lead "${lead.contact_name}" from your pipeline?`
    );
    if (!confirmed) return;

    const supabase = createClient();
    await supabase
      .from("activities")
      .update({ lead_id: null })
      .eq("lead_id", lead.id);

    const { error } = await supabase.from("leads").delete().eq("id", lead.id);

    if (error) {
      toast.error(`Could not delete lead: ${error.message}`);
      return;
    }

    setLeads((prev) => prev.filter((item) => item.id !== lead.id));
    toast.success("Lead deleted");
    router.refresh();
  }

  async function handleQuickStatusChange(lead: LeadRecord, newStatus: string) {
    if (newStatus === lead.status) return;

    if (newStatus === "Converted") {
      await handleConvertLead(lead);
      return;
    }

    let lostReason: string | null = lead.lost_reason;
    if (newStatus === "Unqualified") {
      const reason = window.prompt(
        "Optional: Enter reason why this lead is unqualified (e.g., Budget, Out of Scope, Timing):",
        lead.lost_reason ?? ""
      );
      if (reason === null) return;
      lostReason = reason.trim() || null;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("leads")
      .update({
        status: newStatus,
        lost_reason: newStatus === "Unqualified" ? lostReason : null,
      })
      .eq("id", lead.id)
      .select()
      .single();

    if (error) {
      toast.error(`Stage update failed: ${error.message}`);
      return;
    }

    setLeads((prev) =>
      prev.map((item) => (item.id === lead.id ? (data as LeadRecord) : item))
    );
    toast.success(`Stage updated to ${newStatus}`);
    router.refresh();
  }

  async function handleConvertLead(lead: LeadRecord) {
    if (lead.converted_company_id) {
      router.push(`/companies/${lead.converted_company_id}`);
      return;
    }

    setConvertingId(lead.id);
    const supabase = createClient();

    try {
      const resolvedCompanyName =
        lead.company_name?.trim() || `${lead.contact_name.trim()} Venture`;
      const normalized = normalizeCompanyName(resolvedCompanyName);

      const { data: existingCompany, error: lookupError } = await supabase
        .from("companies")
        .select("id, name")
        .eq("normalized_name", normalized)
        .maybeSingle();

      if (lookupError) {
        throw new Error(lookupError.message);
      }

      let targetCompanyId = existingCompany?.id ?? null;

      if (!targetCompanyId) {
        const { data: createdCompany, error: companyError } = await supabase
          .from("companies")
          .insert({
            name: resolvedCompanyName,
            normalized_name: normalized,
            client_category: lead.client_category || "Startup",
            status: "Active Client",
            notes: lead.notes || null,
          })
          .select("id")
          .single();

        if (companyError || !createdCompany) {
          throw new Error(
            companyError?.message || "Failed to create client company."
          );
        }

        targetCompanyId = createdCompany.id;
      }

      const { error: contactError } = await supabase.from("contacts").insert({
        company_id: targetCompanyId,
        full_name: lead.contact_name.trim(),
        job_title: "Founder / Primary Contact",
        email: lead.email || null,
        phone: lead.phone || null,
        is_primary: !existingCompany,
      });

      if (contactError) {
        throw new Error(contactError.message);
      }

      const { data: updatedLead, error: leadError } = await supabase
        .from("leads")
        .update({
          status: "Converted",
          converted_company_id: targetCompanyId,
          lost_reason: null,
        })
        .eq("id", lead.id)
        .select()
        .single();

      if (leadError) {
        throw new Error(leadError.message);
      }

      setLeads((prev) =>
        prev.map((item) =>
          item.id === lead.id ? (updatedLead as LeadRecord) : item
        )
      );

      toast.success(
        existingCompany
          ? `Linked contact to existing client "${existingCompany.name}"`
          : `Converted "${resolvedCompanyName}" into an Active Client!`
      );
      router.refresh();
      router.push(`/companies/${targetCompanyId}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Conversion failed. Please try again."
      );
    } finally {
      setConvertingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#084154]">
            Leads Pipeline
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track inbound and outbound prospects, schedule follow-ups, and convert qualified leads into clients.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportLeadsCsv}
            className="h-10 rounded-xl border-slate-200 bg-white px-3.5 text-xs font-semibold text-[#084154]"
          >
            <Download className="mr-1.5 h-4 w-4 text-[#4b8f9a]" />
            Export CSV
          </Button>

          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="brand-gradient h-10 rounded-xl px-4 text-xs font-semibold text-white shadow-sm hover:opacity-95"
          >
            <UserPlus className="mr-1.5 h-4 w-4 text-[#ffbf00]" />
            New Lead
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Leads
          </p>
          <p className="mt-2 text-2xl font-bold text-[#084154]">{metrics.total}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Active Pipeline
          </p>
          <p className="mt-2 text-2xl font-bold text-[#4b8f9a]">{metrics.open}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Qualified
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {metrics.qualified}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Converted Clients
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {metrics.converted}
          </p>
        </div>
      </div>

      <div className="glass-card space-y-4 rounded-2xl p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by contact, company, email, or source..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 bg-white pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Segment:
            </span>
            {["All", ...CLIENT_CATEGORIES].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  categoryFilter === cat
                    ? "bg-[#084154] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200/70 pt-3">
          {["All", ...LEAD_STATUSES].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                statusFilter === status
                  ? "bg-[#4b8f9a] text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-[#4b8f9a]"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {filteredLeads.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center">
          <div className="brand-gradient-subtle flex h-12 w-12 items-center justify-center rounded-2xl text-[#084154]">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-bold text-[#084154]">
            {leads.length === 0 ? "No leads in your pipeline yet" : "No matching leads"}
          </h3>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            {leads.length === 0
              ? "Add your first startup, SMB, or enterprise prospect to track discovery calls and convert them into client accounts."
              : "Try clearing your search text or switching the stage/segment filters above."}
          </p>
          {leads.length === 0 && (
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="brand-gradient mt-5 rounded-xl font-semibold text-white"
            >
              + Add Your First Lead
            </Button>
          )}
        </div>
      ) : (
        <div className="glass-card overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200/80 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">Lead & Company</th>
                  <th className="px-4 py-3.5">Segment & Source</th>
                  <th className="px-4 py-3.5">Stage</th>
                  <th className="px-4 py-3.5">Follow-Up</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {filteredLeads.map((lead) => {
                  const isConverted =
                    lead.status === "Converted" || Boolean(lead.converted_company_id);

                  return (
                    <tr
                      key={lead.id}
                      className="transition-colors hover:bg-white/80"
                    >
                      <td className="px-4 py-4">
                        <p className="font-semibold text-[#084154]">
                          {lead.contact_name}
                        </p>
                        {lead.company_name && (
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                            <Building2 className="h-3.5 w-3.5 text-[#4b8f9a]" />
                            {lead.company_name}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          {lead.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </span>
                          )}
                          {lead.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {lead.phone}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-flex rounded-md bg-[#084154]/8 px-2.5 py-0.5 text-xs font-semibold text-[#084154]">
                          {lead.client_category}
                        </span>
                        {lead.source && (
                          <p className="mt-1 text-xs text-slate-500">
                            Via {lead.source}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <select
                          aria-label={`Stage for ${lead.contact_name}`}
                          value={isConverted ? "Converted" : lead.status}
                          disabled={convertingId === lead.id || isConverted}
                          onChange={(e) =>
                            handleQuickStatusChange(lead, e.target.value)
                          }
                          className={`rounded-full border px-3 py-1 text-xs font-semibold focus:outline-none disabled:cursor-not-allowed disabled:opacity-80 ${getStatusBadgeClass(
                            isConverted ? "Converted" : lead.status
                          )}`}
                        >
                          {LEAD_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        {lead.status === "Unqualified" && lead.lost_reason && (
                          <p className="mt-1 max-w-[180px] truncate text-[11px] text-rose-600">
                            Reason: {lead.lost_reason}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4 text-xs text-slate-600">
                        {lead.next_followup_date ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-medium">
                            <Calendar className="h-3.5 w-3.5 text-[#4b8f9a]" />
                            {lead.next_followup_date}
                          </span>
                        ) : (
                          <span className="text-slate-400">Not scheduled</span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(lead)}
                            className="h-8 rounded-lg px-2.5 text-xs"
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            Edit
                          </Button>

                          {isConverted && lead.converted_company_id ? (
                            <Link
                              href={`/companies/${lead.converted_company_id}`}
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              View Client
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              disabled={convertingId === lead.id}
                              onClick={() => handleConvertLead(lead)}
                              className="h-8 rounded-lg bg-[#ffbf00] px-3 text-xs font-semibold text-[#084154] hover:bg-[#ffbf00]/90"
                            >
                              {convertingId === lead.id
                                ? "Converting..."
                                : "Convert to Client"}
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${lead.contact_name}`}
                            onClick={() => handleDeleteLead(lead)}
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

      {/* Create Lead Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#084154]">Add New Lead</DialogTitle>
            <DialogDescription>
              Capture a prospective founder or organization into your consulting pipeline.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateLead} className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lead-contact">Contact Name *</Label>
                <Input
                  id="lead-contact"
                  required
                  placeholder="e.g., Arjun Menon"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lead-company">Company / Venture Name</Label>
                <Input
                  id="lead-company"
                  placeholder="e.g., NovaPay Technologies"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lead-category">Client Segment *</Label>
                <select
                  id="lead-category"
                  value={clientCategory}
                  onChange={(e) =>
                    setClientCategory(e.target.value as ClientCategory)
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#4b8f9a] focus:outline-none"
                >
                  {CLIENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lead-source">Lead Source</Label>
                <select
                  id="lead-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#4b8f9a] focus:outline-none"
                >
                  {LEAD_SOURCES.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lead-email">Email</Label>
                <Input
                  id="lead-email"
                  type="email"
                  placeholder="arjun@novapay.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lead-phone">Phone / WhatsApp</Label>
                <PhoneInput
                  id="lead-phone"
                  value={phone}
                  onChange={setPhone}
                  placeholder="50 123 4567"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lead-followup">Next Follow-Up Date</Label>
              <Input
                id="lead-followup"
                type="date"
                value={nextFollowupDate}
                onChange={(e) => setNextFollowupDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lead-notes">Discovery Notes</Label>
              <Textarea
                id="lead-notes"
                rows={3}
                placeholder="Key pain points, incorporation goals, or advisory scope..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="brand-gradient font-semibold text-white"
              >
                {isSubmitting ? "Saving..." : "Save Lead"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Lead Modal */}
      <Dialog
        open={Boolean(editingLead)}
        onOpenChange={(open) => !open && setEditingLead(null)}
      >
        <DialogContent className="sm:max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#084154]">Edit Lead</DialogTitle>
            <DialogDescription>
              Update prospect contact details, pipeline stage, or follow-up schedule.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateLead} className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-lead-contact">Contact Name *</Label>
                <Input
                  id="edit-lead-contact"
                  required
                  value={editContactName}
                  onChange={(e) => setEditContactName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-lead-company">Company Name</Label>
                <Input
                  id="edit-lead-company"
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-lead-category">Segment</Label>
                <select
                  id="edit-lead-category"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
                >
                  {CLIENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-lead-status">Stage</Label>
                <select
                  id="edit-lead-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
                >
                  {LEAD_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-lead-followup">Follow-Up</Label>
                <Input
                  id="edit-lead-followup"
                  type="date"
                  value={editFollowup}
                  onChange={(e) => setEditFollowup(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-lead-email">Email</Label>
                <Input
                  id="edit-lead-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-lead-phone">Phone / WhatsApp</Label>
                <PhoneInput
                  id="edit-lead-phone"
                  value={editPhone}
                  onChange={setEditPhone}
                />
              </div>
            </div>

            {editStatus === "Unqualified" && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-lost-reason">Unqualified Reason</Label>
                <Input
                  id="edit-lost-reason"
                  placeholder="Why was this lead marked unqualified?"
                  value={editLostReason}
                  onChange={(e) => setEditLostReason(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="edit-lead-notes">Notes</Label>
              <Textarea
                id="edit-lead-notes"
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingLead(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isUpdating}
                className="brand-gradient font-semibold text-white"
              >
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}