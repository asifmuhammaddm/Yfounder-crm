"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Search,
  Globe,
  MapPin,
  Users,
  Mail,
  Phone,
  ArrowUpRight,
  Sparkles,
  Download,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { downloadCsvFile } from "@/lib/csv";
import type {
  ClientCategory,
  CompanyStatus,
  CompanyWithContacts,
  ContactRecord,
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
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Prospect":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "Paused":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

interface CompaniesWorkspaceProps {
  initialCompanies: CompanyWithContacts[];
}

export function CompaniesWorkspace({
  initialCompanies,
}: CompaniesWorkspaceProps) {
  const router = useRouter();
  const [companies, setCompanies] =
    useState<CompanyWithContacts[]>(initialCompanies);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  // Create Company Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientCategory, setClientCategory] =
    useState<ClientCategory>("Startup");
  const [status, setStatus] = useState<CompanyStatus>("Active Client");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [notes, setNotes] = useState("");
  const [primaryContactName, setPrimaryContactName] = useState("");
  const [primaryContactTitle, setPrimaryContactTitle] = useState("");
  const [primaryContactEmail, setPrimaryContactEmail] = useState("");
  const [primaryContactPhone, setPrimaryContactPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const metrics = useMemo(() => {
    return {
      total: companies.length,
      active: companies.filter((c) => c.status === "Active Client").length,
      startups: companies.filter((c) => c.client_category === "Startup").length,
      smbEnterprise: companies.filter(
        (c) =>
          c.client_category === "SMB" || c.client_category === "Enterprise"
      ).length,
    };
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      if (
        categoryFilter !== "All" &&
        company.client_category !== categoryFilter
      ) {
        return false;
      }
      if (statusFilter !== "All" && company.status !== statusFilter) {
        return false;
      }

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const contactHaystack = (company.contacts ?? [])
        .map((c) => `${c.full_name} ${c.email ?? ""} ${c.phone ?? ""}`)
        .join(" ");

      const haystack = [
        company.name,
        company.industry,
        company.city,
        company.country,
        contactHaystack,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [companies, categoryFilter, statusFilter, searchQuery]);

  function handleExportCompaniesCsv() {
    if (filteredCompanies.length === 0) {
      toast.error(
        "No client companies available in the current view to export."
      );
      return;
    }

    downloadCsvFile(
      "yfounder-clients",
      [
        "Company Name",
        "Client Segment",
        "Status",
        "Industry",
        "Primary Contact",
        "Primary Email",
        "Primary Phone",
        "Total Stakeholders",
        "City",
        "Country",
        "Website",
        "Notes",
        "Created Date",
      ],
      filteredCompanies.map((company) => {
        const primary =
          company.contacts?.find((c) => c.is_primary) ??
          company.contacts?.[0] ??
          null;

        return [
          company.name,
          company.client_category,
          company.status,
          company.industry,
          primary?.full_name,
          primary?.email,
          primary?.phone,
          company.contacts?.length ?? 0,
          company.city,
          company.country,
          company.website,
          company.notes,
          company.created_at.slice(0, 10),
        ];
      })
    );
    toast.success(`Exported ${filteredCompanies.length} client companies to CSV`);
  }

  function resetCreateForm() {
    setName("");
    setClientCategory("Startup");
    setStatus("Active Client");
    setIndustry("");
    setWebsite("");
    setCity("");
    setCountry("");
    setNotes("");
    setPrimaryContactName("");
    setPrimaryContactTitle("");
    setPrimaryContactEmail("");
    setPrimaryContactPhone("");
  }

  async function handleCreateCompany(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Company name is required.");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();

    try {
      const normalized = normalizeCompanyName(name);
      const { data: existing } = await supabase
        .from("companies")
        .select("id, name")
        .eq("normalized_name", normalized)
        .maybeSingle();

      if (existing) {
        toast.error(`A client named "${existing.name}" already exists.`);
        setIsSaving(false);
        return;
      }

      const { data: createdCompany, error: compError } = await supabase
        .from("companies")
        .insert({
          name: name.trim(),
          normalized_name: normalized,
          client_category: clientCategory,
          status,
          industry: industry.trim() || null,
          website: website.trim() || null,
          city: city.trim() || null,
          country: country.trim() || null,
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (compError || !createdCompany) {
        throw new Error(compError?.message || "Could not create client.");
      }

      let createdContacts: ContactRecord[] = [];
      if (primaryContactName.trim()) {
        const { data: contactRow, error: contactError } = await supabase
          .from("contacts")
          .insert({
            company_id: createdCompany.id,
            full_name: primaryContactName.trim(),
            job_title: primaryContactTitle.trim() || null,
            email: primaryContactEmail.trim() || null,
            phone: primaryContactPhone.trim() || null,
            is_primary: true,
          })
          .select()
          .single();

        if (!contactError && contactRow) {
          createdContacts = [contactRow as ContactRecord];
        }
      }

      const fullCompany: CompanyWithContacts = {
        ...(createdCompany as CompanyWithContacts),
        contacts: createdContacts,
      };

      setCompanies((prev) => [fullCompany, ...prev]);
      toast.success(`Client "${createdCompany.name}" created`);
      resetCreateForm();
      setCreateOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create company."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteCompany(company: CompanyWithContacts) {
    const confirmed = window.confirm(
      `Permanently delete "${company.name}" and its contacts, projects, engagements, and invoices?`
    );
    if (!confirmed) return;

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

      setCompanies((prev) => prev.filter((item) => item.id !== company.id));
      toast.success(`Deleted "${company.name}"`);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete client company."
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#084154]">
            Clients & Companies
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage client organizations, stakeholder directories, and 360-degree consulting accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCompaniesCsv}
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
            <Plus className="mr-1.5 h-4 w-4 text-[#ffbf00]" />
            New Client Company
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Organizations
          </p>
          <p className="mt-2 text-2xl font-bold text-[#084154]">
            {metrics.total}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Active Clients
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {metrics.active}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Startups
          </p>
          <p className="mt-2 text-2xl font-bold text-[#4b8f9a]">
            {metrics.startups}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            SMB & Enterprise
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {metrics.smbEnterprise}
          </p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="glass-card space-y-4 rounded-2xl p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search company, industry, location, or contact..."
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
          {["All", ...COMPANY_STATUSES].map((st) => (
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

      {/* Companies Grid or Empty State */}
      {filteredCompanies.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center">
          <div className="brand-gradient-subtle flex h-12 w-12 items-center justify-center rounded-2xl text-[#084154]">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-bold text-[#084154]">
            {companies.length === 0
              ? "No client companies added yet"
              : "No clients match your current filters"}
          </h3>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            {companies.length === 0
              ? "Convert a qualified prospect from Leads or add a new client organization directly."
              : "Try clearing the search text or switching the segment/status filters above."}
          </p>
          {companies.length === 0 && (
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="brand-gradient mt-5 rounded-xl font-semibold text-white"
            >
              + Add Your First Client Company
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCompanies.map((company) => {
            const primaryContact =
              company.contacts?.find((c) => c.is_primary) ??
              company.contacts?.[0] ??
              null;

            return (
              <div
                key={company.id}
                className="glass-card flex flex-col justify-between rounded-2xl p-5 transition-all hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-md bg-[#084154]/10 px-2.5 py-0.5 text-xs font-semibold text-[#084154]">
                      {company.client_category}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getCompanyStatusBadgeClass(
                        company.status
                      )}`}
                    >
                      {company.status}
                    </span>
                  </div>

                  <Link
                    href={`/companies/${company.id}`}
                    className="mt-3 block text-lg font-bold text-[#084154] hover:text-[#4b8f9a]"
                  >
                    {company.name}
                  </Link>

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    {company.industry && (
                      <span className="font-medium text-[#4b8f9a]">
                        {company.industry}
                      </span>
                    )}
                    {(company.city || company.country) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        {[company.city, company.country]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    )}
                    {company.website && (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Globe className="h-3.5 w-3.5 text-slate-400" />
                        {company.website}
                      </span>
                    )}
                  </div>

                  {primaryContact && (
                    <div className="mt-4 rounded-xl bg-[#084154]/[0.04] p-3 text-xs">
                      <p className="font-bold text-[#084154]">
                        {primaryContact.full_name}
                        {primaryContact.job_title
                          ? ` · ${primaryContact.job_title}`
                          : ""}
                      </p>
                      <div className="mt-1.5 space-y-1 text-slate-600">
                        {primaryContact.email && (
                          <p className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3 text-slate-400" />
                            {primaryContact.email}
                          </p>
                        )}
                        {primaryContact.phone && (
                          <p className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-slate-400" />
                            {primaryContact.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-3.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <Users className="h-3.5 w-3.5 text-[#4b8f9a]" />
                    {company.contacts?.length ?? 0}{" "}
                    {(company.contacts?.length ?? 0) === 1
                      ? "Stakeholder"
                      : "Stakeholders"}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/companies/${company.id}`}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#084154] px-3 text-xs font-semibold text-white hover:bg-[#4b8f9a]"
                    >
                      Open 360°
                      <ArrowUpRight className="h-3.5 w-3.5 text-[#ffbf00]" />
                    </Link>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${company.name}`}
                      onClick={() => handleDeleteCompany(company)}
                      className="h-8 w-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Client Company Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92vh] sm:max-w-2xl overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#084154]">
              Add Client Company
            </DialogTitle>
            <DialogDescription>
              Create an organization profile and attach its primary point of contact.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCompany} className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="comp-name">Company Name *</Label>
                <Input
                  id="comp-name"
                  required
                  placeholder="e.g., Horizon Ventures DMCC"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="comp-cat">Client Segment *</Label>
                <select
                  id="comp-cat"
                  value={clientCategory}
                  onChange={(e) =>
                    setClientCategory(e.target.value as ClientCategory)
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
                >
                  {CLIENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="comp-status">Account Status</Label>
                <select
                  id="comp-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CompanyStatus)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
                >
                  {COMPANY_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="comp-industry">Industry</Label>
                <Input
                  id="comp-industry"
                  placeholder="e.g., FinTech, E-Commerce, Healthcare"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="comp-city">City</Label>
                <Input
                  id="comp-city"
                  placeholder="Dubai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="comp-country">Country</Label>
                <Input
                  id="comp-country"
                  placeholder="UAE"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="comp-web">Website</Label>
                <Input
                  id="comp-web"
                  placeholder="https://..."
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#084154]">
                Primary Stakeholder (Optional)
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="comp-p-name" className="text-xs">
                    Full Name
                  </Label>
                  <Input
                    id="comp-p-name"
                    placeholder="Founder or Decision Maker"
                    value={primaryContactName}
                    onChange={(e) => setPrimaryContactName(e.target.value)}
                    className="bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="comp-p-title" className="text-xs">
                    Role / Job Title
                  </Label>
                  <Input
                    id="comp-p-title"
                    placeholder="CEO / Managing Director"
                    value={primaryContactTitle}
                    onChange={(e) => setPrimaryContactTitle(e.target.value)}
                    className="bg-white"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="comp-p-email" className="text-xs">
                    Email
                  </Label>
                  <Input
                    id="comp-p-email"
                    type="email"
                    placeholder="founder@company.com"
                    value={primaryContactEmail}
                    onChange={(e) => setPrimaryContactEmail(e.target.value)}
                    className="bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="comp-p-phone" className="text-xs">
                    Phone / WhatsApp
                  </Label>
                  <PhoneInput
                    id="comp-p-phone"
                    value={primaryContactPhone}
                    onChange={setPrimaryContactPhone}
                    placeholder="50 123 4567"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="comp-notes">Account Notes</Label>
              <Textarea
                id="comp-notes"
                rows={2}
                placeholder="Strategic notes, advisory focus, or onboarding context..."
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
                disabled={isSaving}
                className="brand-gradient font-semibold text-white"
              >
                <Building2 className="mr-1.5 h-4 w-4 text-[#ffbf00]" />
                {isSaving ? "Saving..." : "Create Client"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}