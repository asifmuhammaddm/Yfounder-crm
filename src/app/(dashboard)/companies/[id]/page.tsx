import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompanyDetailWorkspace } from "@/components/companies/company-detail-workspace";
import type {
  CompanyRecord,
  ContactRecord,
  EngagementRecord,
  InvoiceRecord,
  ProjectRecord,
} from "@/types/crm";

interface CompanyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompanyDetailPage({
  params,
}: CompanyDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: company },
    { data: contacts },
    { data: sourceLead },
    { data: engagements },
    { data: projects },
    { data: invoices },
  ] = await Promise.all([
    supabase.from("companies").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("contacts")
      .select("*")
      .eq("company_id", id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("leads")
      .select("contact_name")
      .eq("converted_company_id", id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("engagements")
      .select("*")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("*")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("*")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!company) {
    notFound();
  }

  return (
    <CompanyDetailWorkspace
      initialCompany={company as CompanyRecord}
      initialContacts={(contacts as ContactRecord[]) ?? []}
      sourceLeadName={sourceLead?.contact_name ?? null}
      initialEngagements={(engagements as EngagementRecord[]) ?? []}
      initialProjects={(projects as ProjectRecord[]) ?? []}
      initialInvoices={(invoices as InvoiceRecord[]) ?? []}
    />
  );
}