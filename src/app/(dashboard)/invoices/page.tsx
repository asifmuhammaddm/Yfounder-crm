import { createClient } from "@/lib/supabase/server";
import {
  InvoicesWorkspace,
  type InvoiceCompanyOption,
  type InvoiceEngagementOption,
} from "@/components/invoices/invoices-workspace";
import type { InvoiceWithDetails } from "@/types/crm";

interface InvoicesPageProps {
  searchParams: Promise<{
    companyId?: string;
    engagementId?: string;
    new?: string;
  }>;
}

export default async function InvoicesPage({
  searchParams,
}: InvoicesPageProps) {
  const { companyId, engagementId, new: openNew } = await searchParams;
  const supabase = await createClient();

  const [{ data: invoices }, { data: companies }, { data: engagements }] =
    await Promise.all([
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

  return (
    <InvoicesWorkspace
      initialInvoices={(invoices as InvoiceWithDetails[]) ?? []}
      companies={(companies as InvoiceCompanyOption[]) ?? []}
      engagements={(engagements as InvoiceEngagementOption[]) ?? []}
      defaultCompanyId={companyId}
      defaultEngagementId={engagementId}
      autoOpenCreate={openNew === "1"}
    />
  );
}