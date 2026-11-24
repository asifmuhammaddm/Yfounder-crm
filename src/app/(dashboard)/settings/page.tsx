import { createClient } from "@/lib/supabase/server";
import { BillingSettingsWorkspace } from "@/components/settings/billing-settings-workspace";
import { DEFAULT_FX_RATES_TO_INR } from "@/lib/currency-core";
import type { OrganizationSettings } from "@/types/crm";

export default async function SettingsPage() {
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    { data: settingsRow },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("organization_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  let isAdmin = false;
  if (user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = profile?.role === "admin";
  }

  const fallbackSettings: OrganizationSettings = {
    id: 1,
    company_name: "YFounder",
    tagline: "360° Business Consulting & Growth Partner",
    website: "https://yfounder.in",
    billing_email: "",
    billing_phone: "",
    address_line1: "",
    address_line2: "",
    tax_id_label: "GSTIN",
    tax_id_value: "",
    default_reporting_currency: "INR",
    fx_rates_to_inr: DEFAULT_FX_RATES_TO_INR,
    inr_payment_details: "",
    international_payment_details: "",
    invoice_footer_note: "Thank you for partnering with YFounder.",
    updated_at: new Date().toISOString(),
  };

  return (
    <BillingSettingsWorkspace
      initialSettings={(settingsRow as OrganizationSettings) ?? fallbackSettings}
      isAdmin={isAdmin}
    />
  );
}