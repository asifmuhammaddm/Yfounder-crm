import { createClient } from "@/lib/supabase/server";
import {
  EngagementsWorkspace,
  type CatalogServiceOption,
  type CompanyOption,
} from "@/components/engagements/engagements-workspace";
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
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("engagements")
      .select(
        "*, companies(id, name, client_category), engagement_services(*, services(id, name, pricing_model))"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("companies")
      .select("id, name, client_category, status")
      .order("name", { ascending: true }),
    supabase
      .from("services")
      .select(
        "id, name, pricing_model, default_price, default_deliverables, service_categories(name)"
      )
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase.from("projects").select("id, engagement_id, title, status"),
  ]);

  return (
    <EngagementsWorkspace
      initialEngagements={(engagements as EngagementWithDetails[]) ?? []}
      companies={(companies as CompanyOption[]) ?? []}
      catalogServices={(services as unknown as CatalogServiceOption[]) ?? []}
      initialProjects={(projects as ProjectSummaryRecord[]) ?? []}
      currentUserId={user?.id ?? ""}
      defaultCompanyId={companyId}
    />
  );
}