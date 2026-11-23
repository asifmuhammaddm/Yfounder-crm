import { createClient } from "@/lib/supabase/server";
import { CompaniesWorkspace } from "@/components/companies/companies-workspace";
import type { CompanyWithContacts } from "@/types/crm";
export default async function CompaniesPage() {
  const supabase = await createClient();

  const { data: companies } = await supabase
    .from("companies")
    .select("*, contacts(*)")
    .order("created_at", { ascending: false });

  return (
    <CompaniesWorkspace
      initialCompanies={(companies as CompanyWithContacts[]) ?? []}
    />
  );
}