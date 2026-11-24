import { createClient } from "@/lib/supabase/server";
import {
  InvoicesWorkspace,
  type InvoiceCompanyOption,
  type InvoiceEngagementOption,
} from "@/components/invoices/invoices-workspace";
import { DEFAULT_FX_RATES_TO_INR, type CurrencyCode } from "@/lib/currency-core";
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

  const [
    { data: invoices },
    { data: companies },
    { data: engagements },
    { data: orgSettings },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "*, companies(id, name, client_category, default_currency, city, country), engagements(id, title, currency), payments(*)"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("companies")
      .select("id, name, client_category, default_currency")
      .order("name", { ascending: true }),
    supabase
      .from("engagements")
      .select("id, company_id, title, currency, total_value, status")
      .order("created_at", { ascending: false }),
    supabase
      .from("organization_settings")
      .select(
        "default_reporting_currency, fx_rates_to_inr, inr_payment_details, international_payment_details"
      )
      .eq("id", 1)
      .maybeSingle(),
  ]);

  return (
    <InvoicesWorkspace
      initialInvoices={(invoices as InvoiceWithDetails[]) ?? []}
      companies={(companies as InvoiceCompanyOption[]) ?? []}
      engagements={(engagements as InvoiceEngagementOption[]) ?? []}
      defaultCompanyId={companyId}
      defaultEngagementId={engagementId}
      autoOpenCreate={openNew === "1"}
      defaultReportingCurrency={
        (orgSettings?.default_reporting_currency as CurrencyCode) || "INR"
      }
      fxRatesToInr={
        (orgSettings?.fx_rates_to_inr as Record<CurrencyCode, number>) ??
        DEFAULT_FX_RATES_TO_INR
      }
      inrPaymentDetails={orgSettings?.inr_payment_details ?? ""}
      internationalPaymentDetails={
        orgSettings?.international_payment_details ?? ""
      }
    />
  );
}