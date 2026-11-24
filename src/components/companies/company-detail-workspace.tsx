"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Globe,
  MapPin,
  Pencil,
  UserPlus,
  Star,
  Mail,
  Phone,
  Trash2,
  Briefcase,
  FolderKanban,
  Receipt,
  ArrowUpRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  CURRENCY_OPTIONS,
  formatCurrencyAmount,
  normalizeCurrency,
  type CurrencyCode,
} from "@/lib/currency";
import type {
  ClientCategory,
  CompanyRecord,
  CompanyStatus,
  ContactRecord,
  EngagementRecord,
  InvoiceRecord,
  ProjectRecord,
} from "@/types/crm";
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

const CLIENT_CATEGORIES: ClientCategory[] = ["Startup", "SMB", "Enterprise"];
const COMPANY_STATUSES: CompanyStatus[] = [
  "Active Client",
  "Prospect",
  "Paused",
  "Past Client",
];

function normalizeCompanyName(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function getCompanyStatusBadgeClass(status: string) {
  switch (status) {
    case "Active Client":
      return "bg-emerald-50 text-emerald-700";
    case "Prospect":
      return "bg-sky-50 text-sky-700";
    case "Paused":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function formatGroupedInvoiceSummary(
  invoices: InvoiceRecord[],
  fallbackCurrency: CurrencyCode,
  selector: (inv: InvoiceRecord) => number
): string {
  const valid = invoices.filter((i) => i.status !== "Void");
  if (valid.length === 0) {
    return formatCurrencyAmount(0, fallbackCurrency);
  }

  const totalsByCurrency = new Map<CurrencyCode, number>();
  for (const inv of valid) {
    const curr = normalizeCurrency(inv.currency);
    totalsByCurrency.set(
      curr,
      (totalsByCurrency.get(curr) ?? 0) + selector(inv)
    );
  }

  return Array.from(totalsByCurrency.entries())
    .map(([curr, amt]) => formatCurrencyAmount(amt, curr))
    .join(" + ");
}

interface CompanyDetailWorkspaceProps {
  initialCompany: CompanyRecord;
  initialContacts: ContactRecord[];
  sourceLeadName: string | null;
  initialEngagements?: EngagementRecord[];
  initialProjects?: ProjectRecord[];
  initialInvoices?: InvoiceRecord[];
}

export function CompanyDetailWorkspace({
  initialCompany,
  initialContacts,
  sourceLeadName,
  initialEngagements = [],
  initialProjects = [],
  initialInvoices = [],
}: CompanyDetailWorkspaceProps) {
  const router = useRouter();
  const [company, setCompany] = useState<CompanyRecord>(initialCompany);
  const [contacts, setContacts] = useState<ContactRecord[]>(initialContacts);
  const [isDeletingCompany, setIsDeletingCompany] = useState(false);

  const clientDefaultCurrency = normalizeCurrency(company.default_currency);

  // Edit Company Modal
  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  const [compName, setCompName] = useState(company.name);
  const [compCategory, setCompCategory] = useState(company.client_category);
  const [compStatus, setCompStatus] = useState(company.status);
  const [compDefaultCurrency, setCompDefaultCurrency] = useState<CurrencyCode>(
    clientDefaultCurrency
  );
  const [compIndustry, setCompIndustry] = useState(company.industry ?? "");
  const [compWebsite, setCompWebsite] = useState(company.website ?? "");
  const [compCity, setCompCity] = useState(company.city ?? "");
  const [compCountry, setCompCountry] = useState(company.country ?? "");
  const [compNotes, setCompNotes] = useState(company.notes ?? "");
  const [isSavingCompany, setIsSavingCompany] = useState(false);

  // Add/Edit Contact Modal
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactRecord | null>(
    null
  );
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);

  async function handleUpdateCompany(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!compName.trim()) {
      toast.error("Company name is required.");
      return;
    }

    setIsSavingCompany(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("companies")
      .update({
        name: compName.trim(),
        normalized_name: normalizeCompanyName(compName),
        client_category: compCategory,
        status: compStatus,
        default_currency: compDefaultCurrency,
        industry: compIndustry.trim() || null,
        website: compWebsite.trim() || null,
        city: compCity.trim() || null,
        country: compCountry.trim() || null,
        notes: compNotes.trim() || null,
      })
      .eq("id", company.id)
      .select()
      .single();

    setIsSavingCompany(false);

    if (error) {
      toast.error(`Could not update company: ${error.message}`);
      return;
    }

    setCompany(data as CompanyRecord);
    toast.success("Client profile updated");
    setEditCompanyOpen(false);
    router.refresh();
  }

  async function handleDeleteCompany() {
    const confirmed = window.confirm(
      `Permanently delete "${company.name}" and its contacts, projects, engagements, and invoices?`
    );
    if (!confirmed) return;

    setIsDeletingCompany(true);
    const supabase = createClient();

    try {
      await supabase
        .from("leads")
        .update({ converted_company_id: null, status: "Qualified" })
        .eq("converted_company_id", company.id);

      const { data: compInvoices } = await supabase
        .from("invoices")
        .select("id")
        .eq("company_id", company.id);

      if (compInvoices && compInvoices.length > 0) {
        const invIds = compInvoices.map((i) => i.id);
        await supabase.from("payments").delete().in("invoice_id", invIds);
        await supabase.from("invoices").delete().eq("company_id", company.id);
      }

      await supabase.from("tasks").delete().eq("company_id", company.id);
      await supabase.from("activities").delete().eq("company_id", company.id);
      await supabase.from("projects").delete().eq("company_id", company.id);

      const { data: compEngs } = await supabase
        .from("engagements")
        .select("id")
        .eq("company_id", company.id);

      if (compEngs && compEngs.length > 0) {
        const engIds = compEngs.map((e) => e.id);
        await supabase
          .from("engagement_services")
          .delete()
          .in("engagement_id", engIds);
        await supabase.from("engagements").delete().eq("company_id", company.id);
      }

      await supabase.from("contacts").delete().eq("company_id", company.id);

      const { error } = await supabase
        .from("companies")
        .delete()
        .eq("id", company.id);

      if (error) throw new Error(error.message);

      toast.success(`Deleted "${company.name}"`);
      router.push("/companies");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete client company."
      );
      setIsDeletingCompany(false);
    }
  }

  function openAddContactModal() {
    setEditingContact(null);
    setFullName("");
    setJobTitle("");
    setContactEmail("");
    setContactPhone("");
    setIsPrimary(contacts.length === 0);
    setContactModalOpen(true);
  }

  function openEditContactModal(contact: ContactRecord) {
    setEditingContact(contact);
    setFullName(contact.full_name);
    setJobTitle(contact.job_title ?? "");
    setContactEmail(contact.email ?? "");
    setContactPhone(contact.phone ?? "");
    setIsPrimary(contact.is_primary);
    setContactModalOpen(true);
  }

  async function handleSaveContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Stakeholder full name is required.");
      return;
    }

    setIsSavingContact(true);
    const supabase = createClient();

    try {
      if (isPrimary) {
        await supabase
          .from("contacts")
          .update({ is_primary: false })
          .eq("company_id", company.id);
      }

      if (editingContact) {
        const { data, error } = await supabase
          .from("contacts")
          .update({
            full_name: fullName.trim(),
            job_title: jobTitle.trim() || null,
            email: contactEmail.trim() || null,
            phone: contactPhone.trim() || null,
            is_primary: isPrimary,
          })
          .eq("id", editingContact.id)
          .select()
          .single();

        if (error) throw new Error(error.message);

        setContacts((prev) =>
          prev
            .map((c) => {
              if (c.id === editingContact.id) return data as ContactRecord;
              return isPrimary ? { ...c, is_primary: false } : c;
            })
            .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
        );
        toast.success("Stakeholder updated");
      } else {
        const { data, error } = await supabase
          .from("contacts")
          .insert({
            company_id: company.id,
            full_name: fullName.trim(),
            job_title: jobTitle.trim() || null,
            email: contactEmail.trim() || null,
            phone: contactPhone.trim() || null,
            is_primary: isPrimary,
          })
          .select()
          .single();

        if (error) throw new Error(error.message);

        setContacts((prev) => {
          const updatedPrev = isPrimary
            ? prev.map((c) => ({ ...c, is_primary: false }))
            : prev;
          return [data as ContactRecord, ...updatedPrev].sort(
            (a, b) => Number(b.is_primary) - Number(a.is_primary)
          );
        });
        toast.success("Stakeholder added");
      }

      setContactModalOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save contact."
      );
    } finally {
      setIsSavingContact(false);
    }
  }

  async function handleSetPrimary(contact: ContactRecord) {
    if (contact.is_primary) return;

    const supabase = createClient();

    const { error: resetError } = await supabase
      .from("contacts")
      .update({ is_primary: false })
      .eq("company_id", company.id);

    if (resetError) {
      toast.error(resetError.message);
      return;
    }

    const { error } = await supabase
      .from("contacts")
      .update({ is_primary: true })
      .eq("id", contact.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setContacts((prev) =>
      prev
        .map((c) => ({ ...c, is_primary: c.id === contact.id }))
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    );
    toast.success(`${contact.full_name} is now the Primary Contact`);
    router.refresh();
  }

  async function handleDeleteContact(contact: ContactRecord) {
    const confirmed = window.confirm(
      `Remove ${contact.full_name} from ${company.name}?`
    );
    if (!confirmed) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", contact.id);

    if (error) {
      toast.error(`Could not remove contact: ${error.message}`);
      return;
    }

    setContacts((prev) => prev.filter((c) => c.id !== contact.id));
    toast.success("Contact removed");
    router.refresh();
  }

  const billedSummary = formatGroupedInvoiceSummary(
    initialInvoices,
    clientDefaultCurrency,
    (i) => Number(i.total_amount || 0)
  );
  const paidSummary = formatGroupedInvoiceSummary(
    initialInvoices,
    clientDefaultCurrency,
    (i) => Number(i.amount_paid || 0)
  );
  const dueSummary = formatGroupedInvoiceSummary(
    initialInvoices,
    clientDefaultCurrency,
    (i) => Math.max(0, Number(i.total_amount || 0) - Number(i.amount_paid || 0))
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/companies"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#084154]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Clients & Companies
        </Link>
      </div>

      {/* Company Hero Card */}
      <div className="glass-card rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
            <div className="brand-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm">
              <Building2 className="h-6 w-6 text-[#ffbf00]" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-xl sm:text-2xl font-bold text-[#084154]">
                  {company.name}
                </h1>
                <span className="rounded-md bg-[#084154]/10 px-2.5 py-0.5 text-xs font-semibold text-[#084154]">
                  {company.client_category}
                </span>
                <span className="rounded-md bg-[#4b8f9a]/15 px-2.5 py-0.5 text-xs font-bold text-[#084154]">
                  Billing: {clientDefaultCurrency}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getCompanyStatusBadgeClass(
                    company.status
                  )}`}
                >
                  {company.status}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-500">
                {company.industry && (
                  <span className="font-medium text-[#4b8f9a]">
                    {company.industry}
                  </span>
                )}
                {(company.city || company.country) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {[company.city, company.country].filter(Boolean).join(", ")}
                  </span>
                )}
                {company.website && (
                  <a
                    href={
                      company.website.startsWith("http")
                        ? company.website
                        : `https://${company.website}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 break-all text-[#084154] underline-offset-2 hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    {company.website}
                  </a>
                )}
                {sourceLeadName && (
                  <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    Converted from Lead: {sourceLeadName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditCompanyOpen(true)}
              className="rounded-xl border-slate-200 bg-white text-xs font-semibold text-[#084154]"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit Profile
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isDeletingCompany}
              onClick={handleDeleteCompany}
              className="rounded-xl border-rose-200 bg-white text-xs font-semibold text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {isDeletingCompany ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>

        {company.notes && (
          <div className="mt-5 rounded-xl border border-slate-200/70 bg-white/70 p-4 text-sm text-slate-600">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Strategic Account Notes
            </p>
            <p className="mt-1 whitespace-pre-line">{company.notes}</p>
          </div>
        )}
      </div>

      {/* Multi-Contact Stakeholder Directory */}
      <div className="glass-card rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-[#084154]">
              Stakeholders & Key Contacts ({contacts.length})
            </h2>
            <p className="text-xs text-slate-500">
              Track founders, executives, finance, and operations contacts for this client.
            </p>
          </div>

          <Button
            type="button"
            onClick={openAddContactModal}
            className="brand-gradient h-9 rounded-xl px-4 text-xs font-semibold text-white"
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5 text-[#ffbf00]" />
            Add Stakeholder
          </Button>
        </div>

        {contacts.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white/50 p-8 text-center">
            <p className="text-sm font-semibold text-[#084154]">
              No contacts attached to {company.name} yet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Add your primary founder or point-of-contact to keep phone and email records organized.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className={`min-w-0 rounded-2xl border p-4 transition-all ${
                  contact.is_primary
                    ? "border-[#4b8f9a] bg-[#084154]/[0.03]"
                    : "border-slate-200/80 bg-white/80"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-[#084154]">
                        {contact.full_name}
                      </h3>
                      {contact.is_primary && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#ffbf00]/25 px-2.5 py-0.5 text-[11px] font-bold text-[#084154]">
                          <Star className="h-3 w-3 fill-[#ffbf00] text-[#084154]" />
                          Primary
                        </span>
                      )}
                    </div>
                    {contact.job_title && (
                      <p className="mt-0.5 text-xs font-medium text-[#4b8f9a]">
                        {contact.job_title}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!contact.is_primary && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetPrimary(contact)}
                        className="h-7 px-2 text-[11px] text-slate-500 hover:text-[#084154]"
                      >
                        Set Primary
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Edit contact"
                      onClick={() => openEditContactModal(contact)}
                      className="h-7 w-7 text-slate-500 hover:text-[#084154]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Delete contact"
                      onClick={() => handleDeleteContact(contact)}
                      className="h-7 w-7 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                  {contact.email && (
                    <p className="flex min-w-0 items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <a
                        href={`mailto:${contact.email}`}
                        className="truncate hover:text-[#084154] hover:underline"
                      >
                        {contact.email}
                      </a>
                    </p>
                  )}
                  {contact.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span>{contact.phone}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Client Engagements & Proposals Strip */}
      <div className="glass-card rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <Briefcase className="h-5 w-5 shrink-0 text-[#4b8f9a]" />
            <div>
              <h2 className="text-lg font-bold text-[#084154]">
                Engagements & Proposals ({initialEngagements.length})
              </h2>
              <p className="text-xs text-slate-500">
                Scoped consulting agreements and active retainers for {company.name}.
              </p>
            </div>
          </div>

          <Link
            href={`/engagements?companyId=${company.id}`}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#084154] px-3.5 text-xs font-semibold text-white hover:bg-[#4b8f9a]"
          >
            Manage in Engagements
            <ArrowUpRight className="h-3.5 w-3.5 text-[#ffbf00]" />
          </Link>
        </div>

        {initialEngagements.length === 0 ? (
          <p className="mt-4 text-xs text-slate-500">
            No proposals or engagements created for {company.name} yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {initialEngagements.map((eng) => {
              const engCurr = normalizeCurrency(eng.currency);
              return (
                <div
                  key={eng.id}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#084154]">
                      {eng.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Stage: <span className="font-semibold">{eng.status}</span> ·
                      Value:{" "}
                      <span className="font-semibold text-[#084154]">
                        {formatCurrencyAmount(eng.total_value, engCurr)}
                      </span>
                    </p>
                  </div>
                  <Link
                    href={`/engagements?companyId=${company.id}`}
                    className="shrink-0 text-xs font-semibold text-[#4b8f9a] hover:text-[#084154]"
                  >
                    Open →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Delivery Projects Strip */}
      <div className="glass-card rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <FolderKanban className="h-5 w-5 shrink-0 text-[#4b8f9a]" />
            <div>
              <h2 className="text-lg font-bold text-[#084154]">
                Delivery Projects ({initialProjects.length})
              </h2>
              <p className="text-xs text-slate-500">
                Active execution workspaces, milestones, and client deliverables.
              </p>
            </div>
          </div>

          <Link
            href="/projects"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-[#084154] hover:border-[#084154]"
          >
            Open Projects
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {initialProjects.length === 0 ? (
          <p className="mt-4 text-xs text-slate-500">
            No delivery projects launched for {company.name} yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {initialProjects.map((proj) => (
              <div
                key={proj.id}
                className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#084154]">
                    {proj.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Status: <span className="font-semibold">{proj.status}</span>
                    {proj.due_date ? ` · Due ${proj.due_date}` : ""}
                  </p>
                </div>
                <Link
                  href="/projects"
                  className="shrink-0 text-xs font-semibold text-[#4b8f9a] hover:text-[#084154]"
                >
                  Open →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invoices & Receivables Strip */}
      <div className="glass-card rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5 min-w-0">
            <Receipt className="h-5 w-5 shrink-0 text-[#4b8f9a]" />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[#084154]">
                Invoices & Receivables ({initialInvoices.length})
              </h2>
              <p className="break-words text-xs text-slate-500">
                Billed: {billedSummary} · Collected: {paidSummary} · Due:{" "}
                {dueSummary}
              </p>
            </div>
          </div>

          <Link
            href={`/invoices?companyId=${company.id}`}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#084154] px-3.5 text-xs font-semibold text-white hover:bg-[#4b8f9a]"
          >
            Manage Invoices
            <ArrowUpRight className="h-3.5 w-3.5 text-[#ffbf00]" />
          </Link>
        </div>

        {initialInvoices.length === 0 ? (
          <p className="mt-4 text-xs text-slate-500">
            No invoices issued to {company.name} yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {initialInvoices.map((inv) => {
              const invCurr = normalizeCurrency(inv.currency);
              return (
                <div
                  key={inv.id}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#084154]">
                      {inv.invoice_number}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Status: <span className="font-semibold">{inv.status}</span>{" "}
                      · Total:{" "}
                      <span className="font-semibold text-[#084154]">
                        {formatCurrencyAmount(inv.total_amount, invCurr)}
                      </span>
                    </p>
                  </div>
                  <Link
                    href={`/invoices?companyId=${company.id}`}
                    className="shrink-0 text-xs font-semibold text-[#4b8f9a] hover:text-[#084154]"
                  >
                    Open →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Company Modal (Mobile Safari Safe) */}
      <Dialog open={editCompanyOpen} onOpenChange={setEditCompanyOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[86dvh] sm:max-w-2xl overflow-y-auto bg-white p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-[#084154]">
              Edit Client Profile
            </DialogTitle>
            <DialogDescription>
              Update organization details, default billing currency, or account status.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateCompany} className="space-y-4 pt-2">
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-comp-name">Company Name *</Label>
                <Input
                  id="edit-comp-name"
                  required
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-comp-cat">Client Segment</Label>
                <select
                  id="edit-comp-cat"
                  value={compCategory}
                  onChange={(e) => setCompCategory(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
                >
                  {CLIENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-comp-status">Status</Label>
                <select
                  id="edit-comp-status"
                  value={compStatus}
                  onChange={(e) => setCompStatus(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
                >
                  {COMPANY_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-comp-currency">
                  Default Billing Currency *
                </Label>
                <select
                  id="edit-comp-currency"
                  value={compDefaultCurrency}
                  onChange={(e) =>
                    setCompDefaultCurrency(e.target.value as CurrencyCode)
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-[#084154]"
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-comp-industry">Industry</Label>
                <Input
                  id="edit-comp-industry"
                  value={compIndustry}
                  onChange={(e) => setCompIndustry(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-comp-city">City</Label>
                <Input
                  id="edit-comp-city"
                  value={compCity}
                  onChange={(e) => setCompCity(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-comp-country">Country</Label>
                <Input
                  id="edit-comp-country"
                  value={compCountry}
                  onChange={(e) => setCompCountry(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-comp-web">Website</Label>
                <Input
                  id="edit-comp-web"
                  value={compWebsite}
                  onChange={(e) => setCompWebsite(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-comp-notes">Account Notes</Label>
              <Textarea
                id="edit-comp-notes"
                rows={3}
                value={compNotes}
                onChange={(e) => setCompNotes(e.target.value)}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditCompanyOpen(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingCompany}
                className="brand-gradient w-full sm:w-auto font-semibold text-white"
              >
                {isSavingCompany ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Contact Modal (Mobile Safari Safe) */}
      <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[86dvh] sm:max-w-2xl overflow-y-auto bg-white p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-[#084154]">
              {editingContact ? "Edit Stakeholder" : "Add Stakeholder Contact"}
            </DialogTitle>
            <DialogDescription>
              Associate a decision-maker or team member with {company.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveContact} className="space-y-4 pt-2">
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="stk-name">Full Name *</Label>
                <Input
                  id="stk-name"
                  required
                  placeholder="e.g., Rahul Nair"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stk-title">Job Title / Role</Label>
                <Input
                  id="stk-title"
                  placeholder="e.g., Chief Financial Officer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="stk-email">Email</Label>
                <Input
                  id="stk-email"
                  type="email"
                  placeholder="rahul@company.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stk-phone">Phone / WhatsApp</Label>
                <PhoneInput
                  id="stk-phone"
                  value={contactPhone}
                  onChange={setContactPhone}
                  placeholder="50 987 6543"
                />
              </div>
            </div>

            <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-[#084154] cursor-pointer">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="h-4 w-4 accent-[#084154]"
              />
              Set as Primary Point of Contact
            </label>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setContactModalOpen(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingContact}
                className="brand-gradient w-full sm:w-auto font-semibold text-white"
              >
                {isSavingContact
                  ? "Saving..."
                  : editingContact
                    ? "Save Contact"
                    : "Add Contact"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}