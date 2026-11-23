"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Layers,
  Plus,
  Search,
  FolderPlus,
  Pencil,
  CheckCircle2,
  Sparkles,
  Tag,
  Power,
  ListChecks,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  formatCurrencyAmount,
  useWorkspaceCurrency,
  type CurrencyCode,
} from "@/lib/currency";
import { CurrencySelect } from "@/components/ui/currency-select";
import type {
  PricingModel,
  ServiceCategoryRecord,
  ServiceWithCategory,
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

const PRICING_MODELS: PricingModel[] = [
  "Fixed Fee",
  "Monthly Retainer",
  "Custom Quote",
];

const STARTER_CATALOG: Array<{
  category: { name: string; description: string };
  services: Array<{
    name: string;
    description: string;
    pricing_model: PricingModel;
    default_price: number;
    default_deliverables: string;
  }>;
}> = [
  {
    category: {
      name: "Company Formation & Structuring",
      description: "Entity setup, licensing, cap-table structuring, and corporate governance.",
    },
    services: [
      {
        name: "UAE Mainland / Free Zone Company Setup",
        description: "End-to-end business registration, trade license issuance, and corporate bank intro.",
        pricing_model: "Fixed Fee",
        default_price: 8500,
        default_deliverables:
          "Trade name reservation & initial approval\nMOA / incorporation documentation\nTrade license & establishment card issuance\nCorporate bank account advisory & dossier",
      },
      {
        name: "Startup Incorporation & Founder Agreement Pack",
        description: "Entity incorporation paired with founder equity split and vesting schedules.",
        pricing_model: "Fixed Fee",
        default_price: 4500,
        default_deliverables:
          "Company incorporation filing\nFounders' agreement & vesting schedule\nInitial cap-table setup & ESOP pool blueprint",
      },
    ],
  },
  {
    category: {
      name: "Fractional CXO & Strategy",
      description: "Ongoing executive leadership, GTM playbooks, and investor readiness.",
    },
    services: [
      {
        name: "Fractional CMO / Growth Advisory Retainer",
        description: "Dedicated strategic marketing leadership, funnel architecture, and agency oversight.",
        pricing_model: "Monthly Retainer",
        default_price: 5000,
        default_deliverables:
          "Weekly founder strategy & KPI sprint\nFull-funnel GTM & positioning roadmap\nChannel budget allocation & vendor governance\nMonthly executive growth scorecard",
      },
      {
        name: "Investor Pitch Deck & Financial Model",
        description: "Institutional-grade fundraising narrative and 3-year dynamic financial projections.",
        pricing_model: "Fixed Fee",
        default_price: 6000,
        default_deliverables:
          "15-slide investor pitch deck narrative & design\n36-month P&L, cash flow, and unit economics model\nData room checklist & investor Q&A prep",
      },
    ],
  },
  {
    category: {
      name: "Digital Presence & Demand Engine",
      description: "High-converting web platforms, SEO/GEO visibility, and paid acquisition.",
    },
    services: [
      {
        name: "Corporate Website & Conversion Funnel Build",
        description: "Custom brand-aligned website engineered for B2B lead capture and speed.",
        pricing_model: "Fixed Fee",
        default_price: 4000,
        default_deliverables:
          "UX wireframe & responsive UI design\nProduction web build with lead capture CRM sync\nTechnical SEO, schema markup & analytics setup",
      },
      {
        name: "SEO, Local GBP & Paid Ads Management",
        description: "Monthly search visibility, Google Business Profile growth, and Meta/Google campaigns.",
        pricing_model: "Monthly Retainer",
        default_price: 2500,
        default_deliverables:
          "Google Business Profile & local SEO optimization\nGoogle & Meta lead-gen campaign management\nBi-weekly ad creative & landing page A/B testing\nMonthly ROI & CPL attribution report",
      },
    ],
  },
  {
    category: {
      name: "Compliance, Tax & Operations",
      description: "Accounting workflows, corporate tax registration, and SOP automation.",
    },
    services: [
      {
        name: "Corporate Tax, VAT & Bookkeeping Retainer",
        description: "Monthly accounting reconciliation, VAT filings, and compliance monitoring.",
        pricing_model: "Monthly Retainer",
        default_price: 1800,
        default_deliverables:
          "Monthly ledger reconciliation & P&L statement\nQuarterly VAT return preparation & filing\nCorporate tax compliance calendar & audit readiness",
      },
      {
        name: "Custom Enterprise Transformation Scope",
        description: "Bespoke multi-department SOPs, CRM rollout, and operational restructuring.",
        pricing_model: "Custom Quote",
        default_price: 0,
        default_deliverables:
          "Operational bottleneck & process audit\nDepartmental SOP & OKR playbook\nCustom CRM & workflow automation deployment",
      },
    ],
  },
];

function getPricingBadgeClass(model: string) {
  switch (model) {
    case "Fixed Fee":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "Monthly Retainer":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "Custom Quote":
      return "bg-purple-50 text-purple-700 border-purple-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function formatServicePrice(
  price: number,
  model: string,
  currency: CurrencyCode
) {
  if (model === "Custom Quote" && Number(price) === 0) {
    return "Custom Quote";
  }
  const base = formatCurrencyAmount(price, currency);
  return model === "Monthly Retainer" ? `${base} / mo` : base;
}

interface ServicesWorkspaceProps {
  initialCategories: ServiceCategoryRecord[];
  initialServices: ServiceWithCategory[];
}

export function ServicesWorkspace({
  initialCategories,
  initialServices,
}: ServicesWorkspaceProps) {
  const router = useRouter();
  const [categories, setCategories] =
    useState<ServiceCategoryRecord[]>(initialCategories);
  const [services, setServices] =
    useState<ServiceWithCategory[]>(initialServices);

  // Filters & Shared Multi-Currency
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("All");
  const [pricingFilter, setPricingFilter] = useState<string>("All");
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [currency, setCurrency] = useWorkspaceCurrency("AED");
  const [isSeeding, setIsSeeding] = useState(false);

  // Category Modal State
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<ServiceCategoryRecord | null>(null);
  const [catName, setCatName] = useState("");
  const [catDescription, setCatDescription] = useState("");
  const [catIsActive, setCatIsActive] = useState(true);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Service Modal State
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] =
    useState<ServiceWithCategory | null>(null);
  const [srvName, setSrvName] = useState("");
  const [srvCategoryId, setSrvCategoryId] = useState<string>("");
  const [srvPricingModel, setSrvPricingModel] =
    useState<PricingModel>("Fixed Fee");
  const [srvDefaultPrice, setSrvDefaultPrice] = useState<string>("2500");
  const [srvDescription, setSrvDescription] = useState("");
  const [srvDeliverables, setSrvDeliverables] = useState("");
  const [srvIsActive, setSrvIsActive] = useState<boolean>(true);
  const [isSavingService, setIsSavingService] = useState(false);

  const stats = useMemo(() => {
    return {
      totalServices: services.length,
      activeServices: services.filter((s) => s.is_active).length,
      categoriesCount: categories.filter((c) => c.is_active).length,
      retainersCount: services.filter(
        (s) => s.is_active && s.pricing_model === "Monthly Retainer"
      ).length,
    };
  }, [services, categories]);

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      if (!showInactive && !service.is_active) return false;

      if (selectedCategoryId === "Uncategorized") {
        if (service.category_id !== null) return false;
      } else if (selectedCategoryId !== "All") {
        if (service.category_id !== selectedCategoryId) return false;
      }

      if (
        pricingFilter !== "All" &&
        service.pricing_model !== pricingFilter
      ) {
        return false;
      }

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const haystack = [
        service.name,
        service.description,
        service.default_deliverables,
        service.service_categories?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [
    services,
    showInactive,
    selectedCategoryId,
    pricingFilter,
    searchQuery,
  ]);

  async function handleSeedStarterCatalog() {
    setIsSeeding(true);
    const supabase = createClient();

    try {
      const createdCategories: ServiceCategoryRecord[] = [];
      const createdServices: ServiceWithCategory[] = [];

      for (const block of STARTER_CATALOG) {
        const { data: catRow, error: catError } = await supabase
          .from("service_categories")
          .insert({
            name: block.category.name,
            description: block.category.description,
            is_active: true,
          })
          .select()
          .single();

        if (catError || !catRow) {
          throw new Error(catError?.message || "Failed to create category.");
        }

        createdCategories.push(catRow as ServiceCategoryRecord);

        const servicePayloads = block.services.map((srv) => ({
          category_id: catRow.id,
          name: srv.name,
          description: srv.description,
          pricing_model: srv.pricing_model,
          default_price: srv.default_price,
          default_deliverables: srv.default_deliverables,
          is_active: true,
        }));

        const { data: srvRows, error: srvError } = await supabase
          .from("services")
          .insert(servicePayloads)
          .select("*, service_categories(id, name, is_active)");

        if (srvError) {
          throw new Error(srvError.message);
        }

        if (srvRows) {
          createdServices.push(...(srvRows as ServiceWithCategory[]));
        }
      }

      setCategories((prev) => [...createdCategories, ...prev]);
      setServices((prev) => [...createdServices, ...prev]);
      toast.success(
        `Loaded ${createdCategories.length} categories & ${createdServices.length} consulting packages!`
      );
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not load starter catalog."
      );
    } finally {
      setIsSeeding(false);
    }
  }

  function openCreateCategoryModal() {
    setEditingCategory(null);
    setCatName("");
    setCatDescription("");
    setCatIsActive(true);
    setCategoryModalOpen(true);
  }

  function openEditCategoryModal(cat: ServiceCategoryRecord) {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatDescription(cat.description ?? "");
    setCatIsActive(cat.is_active);
    setCategoryModalOpen(true);
  }

  async function handleSaveCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!catName.trim()) {
      toast.error("Category name is required.");
      return;
    }

    setIsSavingCategory(true);
    const supabase = createClient();

    try {
      if (editingCategory) {
        const { data, error } = await supabase
          .from("service_categories")
          .update({
            name: catName.trim(),
            description: catDescription.trim() || null,
            is_active: catIsActive,
          })
          .eq("id", editingCategory.id)
          .select()
          .single();

        if (error) throw new Error(error.message);

        const updated = data as ServiceCategoryRecord;
        setCategories((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
        setServices((prev) =>
          prev.map((s) =>
            s.category_id === updated.id
              ? {
                  ...s,
                  service_categories: {
                    id: updated.id,
                    name: updated.name,
                    is_active: updated.is_active,
                  },
                }
              : s
          )
        );
        toast.success("Practice category updated");
      } else {
        const { data, error } = await supabase
          .from("service_categories")
          .insert({
            name: catName.trim(),
            description: catDescription.trim() || null,
            is_active: catIsActive,
          })
          .select()
          .single();

        if (error) throw new Error(error.message);

        setCategories((prev) => [...prev, data as ServiceCategoryRecord]);
        toast.success("Practice category created");
      }

      setCategoryModalOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save category."
      );
    } finally {
      setIsSavingCategory(false);
    }
  }

  function openCreateServiceModal() {
    setEditingService(null);
    setSrvName("");
    setSrvCategoryId(
      selectedCategoryId !== "All" && selectedCategoryId !== "Uncategorized"
        ? selectedCategoryId
        : categories[0]?.id ?? ""
    );
    setSrvPricingModel("Fixed Fee");
    setSrvDefaultPrice("2500");
    setSrvDescription("");
    setSrvDeliverables("");
    setSrvIsActive(true);
    setServiceModalOpen(true);
  }

  function openEditServiceModal(service: ServiceWithCategory) {
    setEditingService(service);
    setSrvName(service.name);
    setSrvCategoryId(service.category_id ?? "");
    setSrvPricingModel(service.pricing_model as PricingModel);
    setSrvDefaultPrice(String(service.default_price ?? 0));
    setSrvDescription(service.description ?? "");
    setSrvDeliverables(service.default_deliverables ?? "");
    setSrvIsActive(service.is_active);
    setServiceModalOpen(true);
  }

  async function handleSaveService(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!srvName.trim()) {
      toast.error("Service name is required.");
      return;
    }

    const numericPrice = Number(srvDefaultPrice);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      toast.error("Default price must be 0 or greater.");
      return;
    }

    setIsSavingService(true);
    const supabase = createClient();

    const payload = {
      category_id: srvCategoryId || null,
      name: srvName.trim(),
      description: srvDescription.trim() || null,
      pricing_model: srvPricingModel,
      default_price: numericPrice,
      default_deliverables: srvDeliverables.trim() || null,
      is_active: srvIsActive,
    };

    try {
      if (editingService) {
        const { data, error } = await supabase
          .from("services")
          .update(payload)
          .eq("id", editingService.id)
          .select("*, service_categories(id, name, is_active)")
          .single();

        if (error) throw new Error(error.message);

        setServices((prev) =>
          prev.map((item) =>
            item.id === editingService.id
              ? (data as ServiceWithCategory)
              : item
          )
        );
        toast.success("Service package updated");
      } else {
        const { data, error } = await supabase
          .from("services")
          .insert(payload)
          .select("*, service_categories(id, name, is_active)")
          .single();

        if (error) throw new Error(error.message);

        setServices((prev) => [data as ServiceWithCategory, ...prev]);
        toast.success("Service added to catalog");
      }

      setServiceModalOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save service."
      );
    } finally {
      setIsSavingService(false);
    }
  }

  async function handleToggleServiceActive(service: ServiceWithCategory) {
    const nextState = !service.is_active;
    const supabase = createClient();

    const { error } = await supabase
      .from("services")
      .update({ is_active: nextState })
      .eq("id", service.id);

    if (error) {
      toast.error(`Failed to update status: ${error.message}`);
      return;
    }

    setServices((prev) =>
      prev.map((item) =>
        item.id === service.id ? { ...item, is_active: nextState } : item
      )
    );
    toast.success(
      nextState ? `"${service.name}" activated` : `"${service.name}" archived`
    );
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#084154]">
            Modular Service Catalog
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Standardize YFounder’s consulting offerings, pricing models, and default deliverables for proposals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={openCreateCategoryModal}
            className="h-10 rounded-xl border-slate-200 bg-white px-3.5 text-xs font-semibold text-[#084154]"
          >
            <FolderPlus className="mr-1.5 h-4 w-4 text-[#4b8f9a]" />
            New Category
          </Button>

          <Button
            type="button"
            onClick={openCreateServiceModal}
            className="brand-gradient h-10 rounded-xl px-4 text-xs font-semibold text-white shadow-sm hover:opacity-95"
          >
            <Plus className="mr-1.5 h-4 w-4 text-[#ffbf00]" />
            Add Service Package
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Offerings
          </p>
          <p className="mt-2 text-2xl font-bold text-[#084154]">
            {stats.totalServices}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Active in Proposals
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {stats.activeServices}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Practice Categories
          </p>
          <p className="mt-2 text-2xl font-bold text-[#4b8f9a]">
            {stats.categoriesCount}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Monthly Retainers
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {stats.retainersCount}
          </p>
        </div>
      </div>

      {/* Filter & Currency Toolbar */}
      <div className="glass-card space-y-4 rounded-2xl p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search service name, scope, or deliverable..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 bg-white pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {["All", ...PRICING_MODELS].map((model) => (
              <button
                key={model}
                type="button"
                onClick={() => setPricingFilter(model)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  pricingFilter === model
                    ? "bg-[#084154] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                }`}
              >
                {model}
              </button>
            ))}

            <CurrencySelect value={currency} onChange={setCurrency} />

            <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="accent-[#084154]"
              />
              Show Archived
            </label>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200/70 pt-3">
          <button
            type="button"
            onClick={() => setSelectedCategoryId("All")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
              selectedCategoryId === "All"
                ? "bg-[#4b8f9a] text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:border-[#4b8f9a]"
            }`}
          >
            All Categories ({services.filter((s) => showInactive || s.is_active).length})
          </button>

          {categories.map((cat) => (
            <div key={cat.id} className="inline-flex items-center">
              <button
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`rounded-l-full px-3 py-1 text-xs font-medium transition-all ${
                  selectedCategoryId === cat.id
                    ? "bg-[#4b8f9a] text-white"
                    : "bg-white text-slate-600 border border-r-0 border-slate-200 hover:border-[#4b8f9a]"
                }`}
              >
                {cat.name}
              </button>
              <button
                type="button"
                title={`Edit ${cat.name}`}
                onClick={() => openEditCategoryModal(cat)}
                className={`rounded-r-full px-2 py-1 text-xs transition-all ${
                  selectedCategoryId === cat.id
                    ? "bg-[#4b8f9a]/90 text-white hover:bg-[#084154]"
                    : "bg-slate-50 text-slate-400 border border-slate-200 hover:text-[#084154]"
                }`}
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setSelectedCategoryId("Uncategorized")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
              selectedCategoryId === "Uncategorized"
                ? "bg-[#4b8f9a] text-white"
                : "bg-white text-slate-500 border border-slate-200 hover:border-[#4b8f9a]"
            }`}
          >
            Uncategorized
          </button>
        </div>
      </div>

      {/* Services Grid or Empty State */}
      {filteredServices.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center">
          <div className="brand-gradient-subtle flex h-12 w-12 items-center justify-center rounded-2xl text-[#084154]">
            <Layers className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-bold text-[#084154]">
            {services.length === 0
              ? "Your Service Catalog is ready to configure"
              : "No service packages match these filters"}
          </h3>
          <p className="mt-1 max-w-lg text-sm text-slate-500">
            {services.length === 0
              ? "Add your consulting packages manually or load YFounder’s 8 pre-built startup, strategy, marketing, and compliance services in one click."
              : "Try switching the category pill, pricing filter, or enabling Show Archived."}
          </p>

          {services.length === 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                onClick={openCreateServiceModal}
                className="brand-gradient rounded-xl font-semibold text-white"
              >
                + Create First Service
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={isSeeding}
                onClick={handleSeedStarterCatalog}
                className="rounded-xl border-[#4b8f9a] bg-white font-semibold text-[#084154] hover:bg-[#4b8f9a]/10"
              >
                <Sparkles className="mr-1.5 h-4 w-4 text-[#ffbf00]" />
                {isSeeding
                  ? "Loading Catalog..."
                  : "Load YFounder Starter Catalog (8 Services)"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredServices.map((service) => {
            const deliverablesList = service.default_deliverables
              ? service.default_deliverables
                  .split("\n")
                  .map((line) => line.replace(/^[-•*]\s*/, "").trim())
                  .filter(Boolean)
              : [];

            return (
              <div
                key={service.id}
                className={`glass-card flex flex-col justify-between rounded-2xl p-5 transition-all ${
                  service.is_active
                    ? "hover:shadow-md"
                    : "opacity-65 bg-slate-50/70"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex rounded-md border px-2.5 py-0.5 text-[11px] font-semibold ${getPricingBadgeClass(
                        service.pricing_model
                      )}`}
                    >
                      {service.pricing_model}
                    </span>

                    <div className="flex items-center gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          service.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {service.is_active ? "Active" : "Archived"}
                      </span>
                    </div>
                  </div>

                  {service.service_categories?.name && (
                    <p className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#4b8f9a]">
                      <Tag className="h-3 w-3" />
                      {service.service_categories.name}
                    </p>
                  )}

                  <h2 className="mt-1 text-lg font-bold text-[#084154]">
                    {service.name}
                  </h2>

                  <p className="mt-2 text-xl font-extrabold text-[#084154]">
                    {formatServicePrice(
                      service.default_price,
                      service.pricing_model,
                      currency
                    )}
                  </p>

                  {service.description && (
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">
                      {service.description}
                    </p>
                  )}

                  {deliverablesList.length > 0 && (
                    <div className="mt-4 rounded-xl bg-[#084154]/[0.04] p-3">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#084154]">
                        <ListChecks className="h-3.5 w-3.5 text-[#4b8f9a]" />
                        Standard Deliverables
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-slate-600">
                        {deliverablesList.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#4b8f9a]" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-3.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openEditServiceModal(service)}
                    className="h-8 rounded-lg px-3 text-xs font-semibold text-[#084154]"
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit Package
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleServiceActive(service)}
                    className="h-8 rounded-lg px-2.5 text-xs text-slate-500 hover:text-[#084154]"
                  >
                    <Power className="mr-1 h-3.5 w-3.5" />
                    {service.is_active ? "Archive" : "Activate"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Practice Category Modal */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="sm:max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#084154]">
              {editingCategory
                ? "Edit Practice Category"
                : "New Practice Category"}
            </DialogTitle>
            <DialogDescription>
              Group related consulting services under a core YFounder practice pillar.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCategory} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Category Name *</Label>
              <Input
                id="cat-name"
                required
                placeholder="e.g., Company Formation & Structuring"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">Practice Description</Label>
              <Textarea
                id="cat-desc"
                rows={3}
                placeholder="Overview of advisory offerings within this category..."
                value={catDescription}
                onChange={(e) => setCatDescription(e.target.value)}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-[#084154]">
              <input
                type="checkbox"
                checked={catIsActive}
                onChange={(e) => setCatIsActive(e.target.checked)}
                className="h-4 w-4 accent-[#084154]"
              />
              Active Category
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCategoryModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingCategory}
                className="brand-gradient font-semibold text-white"
              >
                {isSavingCategory
                  ? "Saving..."
                  : editingCategory
                    ? "Save Category"
                    : "Create Category"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Service Package Modal */}
      <Dialog open={serviceModalOpen} onOpenChange={setServiceModalOpen}>
        <DialogContent className="max-h-[90vh] sm:max-w-2xl overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#084154]">
              {editingService
                ? "Edit Service Package"
                : "Add Modular Service Package"}
            </DialogTitle>
            <DialogDescription>
              Configure pricing and standard deliverables. These auto-populate when creating client proposals.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveService} className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="srv-name">Service Name *</Label>
                <Input
                  id="srv-name"
                  required
                  placeholder="e.g., Fractional CMO Retainer"
                  value={srvName}
                  onChange={(e) => setSrvName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="srv-cat">Practice Category</Label>
                <select
                  id="srv-cat"
                  value={srvCategoryId}
                  onChange={(e) => setSrvCategoryId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="srv-model">Pricing Model *</Label>
                <select
                  id="srv-model"
                  value={srvPricingModel}
                  onChange={(e) => {
                    const nextModel = e.target.value as PricingModel;
                    setSrvPricingModel(nextModel);
                    if (nextModel === "Custom Quote" && !srvDefaultPrice) {
                      setSrvDefaultPrice("0");
                    }
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
                >
                  {PRICING_MODELS.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="srv-price">
                  Default Price ({currency}) *
                </Label>
                <Input
                  id="srv-price"
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="2500"
                  value={srvDefaultPrice}
                  onChange={(e) => setSrvDefaultPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="srv-desc">Service Summary</Label>
              <Textarea
                id="srv-desc"
                rows={2}
                placeholder="Brief client-facing summary of what this package achieves..."
                value={srvDescription}
                onChange={(e) => setSrvDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="srv-deliv">
                Default Deliverables (One item per line)
              </Label>
              <Textarea
                id="srv-deliv"
                rows={4}
                placeholder={"Trade name reservation & filing\nMOA drafting & notarization\nCorporate bank account advisory"}
                value={srvDeliverables}
                onChange={(e) => setSrvDeliverables(e.target.value)}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-[#084154]">
              <input
                type="checkbox"
                checked={srvIsActive}
                onChange={(e) => setSrvIsActive(e.target.checked)}
                className="h-4 w-4 accent-[#084154]"
              />
              Active & Available for New Client Proposals
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setServiceModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingService}
                className="brand-gradient font-semibold text-white"
              >
                {isSavingService
                  ? "Saving..."
                  : editingService
                    ? "Save Service"
                    : "Add to Catalog"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}