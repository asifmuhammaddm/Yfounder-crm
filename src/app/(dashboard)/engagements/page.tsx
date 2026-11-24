import { createClient } from "@/lib/supabase/server";
import {
  EngagementsWorkspace,
  type CatalogServiceOption,
  type CompanyOption,
} from "@/components/engagements/engagements-workspace";
import { DEFAULT_FX_RATES_TO_INR, type CurrencyCode } from "@/lib/currency-core";
import type {
  EngagementWithDetails,
  ProjectSummaryRecord,
} from "@/types/crm";

interface EngagementsPageProps {
  searchParams: Promise<{ companyId?: string }>;
}

export default async function EngagementsPage({
  searchParams,
}: EngagementsPageProps) {
  const { companyId } = await searchParams;
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    { data: engagements },
    { data: companies },
    { data: services },
    { data: projects },
    { data: orgSettings },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("engagements")
      .select(
        "*, companies(id, name, client_category, default_currency), engagement_services(*, services(id, name, pricing_model))"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("companies")
      .select("id, name, client_category, status, default_currency")
      .order("name", { ascending: true }),
    supabase
      .from("services")
      .select(
        "id, name, pricing_model, default_price, default_deliverables, service_categories(name)"
      )
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase.from("projects").select("id, engagement_id, title, status"),
    supabase
      .from("organization_settings")
      .select("default_reporting_currency, fx_rates_to_inr")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  return (
    <EngagementsWorkspace
      initialEngagements={(engagements as EngagementWithDetails[]) ?? []}
      companies={(companies as CompanyOption[]) ?? []}
      catalogServices={(services as unknown as CatalogServiceOption[]) ?? []}
      initialProjects={(projects as ProjectSummaryRecord[]) ?? []}
      currentUserId={user?.id ?? ""}
      defaultCompanyId={companyId}
      defaultReportingCurrency={
        (orgSettings?.default_reporting_currency as CurrencyCode) || "INR"
      }
      fxRatesToInr={
        (orgSettings?.fx_rates_to_inr as Record<CurrencyCode, number>) ??
        DEFAULT_FX_RATES_TO_INR
      }
    />
  );
}