"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2,
  Coins,
  Landmark,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  CURRENCY_OPTIONS,
  DEFAULT_FX_RATES_TO_INR,
  type CurrencyCode,
} from "@/lib/currency";
import type { OrganizationSettings } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface BillingSettingsWorkspaceProps {
  initialSettings: OrganizationSettings;
  isAdmin: boolean;
}

export function BillingSettingsWorkspace({
  initialSettings,
  isAdmin,
}: BillingSettingsWorkspaceProps) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(
    initialSettings.company_name || "YFounder"
  );
  const [tagline, setTagline] = useState(
    initialSettings.tagline || "360° Business Consulting & Growth Partner"
  );
  const [website, setWebsite] = useState(
    initialSettings.website || "https://yfounder.in"
  );
  const [billingEmail, setBillingEmail] = useState(
    initialSettings.billing_email || ""
  );
  const [billingPhone, setBillingPhone] = useState(
    initialSettings.billing_phone || ""
  );
  const [addressLine1, setAddressLine1] = useState(
    initialSettings.address_line1 || ""
  );
  const [addressLine2, setAddressLine2] = useState(
    initialSettings.address_line2 || ""
  );
  const [taxIdLabel, setTaxIdLabel] = useState(
    initialSettings.tax_id_label || "GSTIN"
  );
  const [taxIdValue, setTaxIdValue] = useState(
    initialSettings.tax_id_value || ""
  );
  const [defaultReportingCurrency, setDefaultReportingCurrency] =
    useState<CurrencyCode>(
      initialSettings.default_reporting_currency || "INR"
    );

  const [fxRates, setFxRates] = useState<Record<CurrencyCode, string>>(() => {
    const merged = {
      ...DEFAULT_FX_RATES_TO_INR,
      ...(initialSettings.fx_rates_to_inr ?? {}),
    };
    return {
      INR: "1",
      AED: String(merged.AED),
      USD: String(merged.USD),
      SAR: String(merged.SAR),
      QAR: String(merged.QAR),
      KWD: String(merged.KWD),
      BHD: String(merged.BHD),
      OMR: String(merged.OMR),
    };
  });

  const [inrPaymentDetails, setInrPaymentDetails] = useState(
    initialSettings.inr_payment_details || ""
  );
  const [internationalPaymentDetails, setInternationalPaymentDetails] =
    useState(initialSettings.international_payment_details || "");
  const [invoiceFooterNote, setInvoiceFooterNote] = useState(
    initialSettings.invoice_footer_note ||
      "Thank you for partnering with YFounder."
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingRates, setIsRefreshingRates] = useState(false);

  async function handleRefreshLiveRates() {
    setIsRefreshingRates(true);
    try {
      const response = await fetch("https://open.er-api.com/v6/latest/INR");
      if (!response.ok) {
        throw new Error("Live FX service temporarily unavailable.");
      }
      const payload = (await response.json()) as {
        rates?: Record<string, number>;
      };
      const ratesFromInr = payload.rates;
      if (!ratesFromInr) {
        throw new Error("Invalid FX response received.");
      }

      const nextRates: Record<CurrencyCode, string> = { ...fxRates, INR: "1" };
      for (const meta of CURRENCY_OPTIONS) {
        if (meta.code === "INR") continue;
        const unitPerInr = ratesFromInr[meta.code];
        if (unitPerInr && unitPerInr > 0) {
          const inrPerUnit = 1 / unitPerInr;
          nextRates[meta.code] = inrPerUnit.toFixed(2);
        }
      }

      setFxRates(nextRates);
      toast.success("Live FX rates fetched (click Save Settings to apply)");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not refresh live rates; you can edit them manually."
      );
    } finally {
      setIsRefreshingRates(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) {
      toast.error("Only workspace admins can update billing settings.");
      return;
    }

    const parsedRates: Record<CurrencyCode, number> = {
      INR: 1,
      AED: Number(fxRates.AED) || DEFAULT_FX_RATES_TO_INR.AED,
      USD: Number(fxRates.USD) || DEFAULT_FX_RATES_TO_INR.USD,
      SAR: Number(fxRates.SAR) || DEFAULT_FX_RATES_TO_INR.SAR,
      QAR: Number(fxRates.QAR) || DEFAULT_FX_RATES_TO_INR.QAR,
      KWD: Number(fxRates.KWD) || DEFAULT_FX_RATES_TO_INR.KWD,
      BHD: Number(fxRates.BHD) || DEFAULT_FX_RATES_TO_INR.BHD,
      OMR: Number(fxRates.OMR) || DEFAULT_FX_RATES_TO_INR.OMR,
    };

    setIsSaving(true);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("organization_settings")
        .update({
          company_name: companyName.trim() || "YFounder",
          tagline: tagline.trim() || null,
          website: website.trim() || null,
          billing_email: billingEmail.trim() || null,
          billing_phone: billingPhone.trim() || null,
          address_line1: addressLine1.trim() || null,
          address_line2: addressLine2.trim() || null,
          tax_id_label: taxIdLabel.trim() || "GSTIN",
          tax_id_value: taxIdValue.trim() || null,
          default_reporting_currency: defaultReportingCurrency,
          fx_rates_to_inr: parsedRates,
          inr_payment_details: inrPaymentDetails.trim() || null,
          international_payment_details:
            internationalPaymentDetails.trim() || null,
          invoice_footer_note: invoiceFooterNote.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (error) {
        throw new Error(error.message);
      }

      toast.success("Master Billing Profile & FX rates saved");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save settings."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[#084154]">
            Master Billing Profile & FX Rates
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure YFounder&apos;s legal identity, bank/UPI payment blocks for A4 invoice PDFs, and central 8-currency conversion rates.
          </p>
        </div>

        {!isAdmin && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
            <ShieldCheck className="h-4 w-4" />
            Read-Only Member View
          </span>
        )}
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="glass-card space-y-4 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2.5 border-b border-slate-200/70 pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#084154]/10 text-[#084154]">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#084154]">
                Agency Identity & Tax Registration
              </h2>
              <p className="text-xs text-slate-500">
                Printed in the header of every generated A4 client invoice PDF.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Brand / Legal Name *</Label>
              <Input
                id="org-name"
                disabled={!isAdmin}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="org-tagline">Positioning Tagline</Label>
              <Input
                id="org-tagline"
                disabled={!isAdmin}
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="bg-white"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="org-email">Billing Email</Label>
              <Input
                id="org-email"
                type="email"
                disabled={!isAdmin}
                placeholder="billing@yfounder.in"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
                className="bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="org-phone">Billing Phone / WhatsApp</Label>
              <Input
                id="org-phone"
                disabled={!isAdmin}
                placeholder="+91 98765 43210"
                value={billingPhone}
                onChange={(e) => setBillingPhone(e.target.value)}
                className="bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="org-website">Website</Label>
              <Input
                id="org-website"
                disabled={!isAdmin}
                placeholder="https://yfounder.in"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="bg-white"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="org-addr1">Address Line 1</Label>
              <Input
                id="org-addr1"
                disabled={!isAdmin}
                placeholder="Office / Building, Street"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="org-addr2">Address Line 2 (City, State, Country)</Label>
              <Input
                id="org-addr2"
                disabled={!isAdmin}
                placeholder="Kozhikode / Thiruvananthapuram, Kerala, India"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                className="bg-white"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="org-tax-label">Tax ID Label (e.g., GSTIN, PAN, TRN)</Label>
              <Input
                id="org-tax-label"
                disabled={!isAdmin}
                value={taxIdLabel}
                onChange={(e) => setTaxIdLabel(e.target.value)}
                className="bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="org-tax-val">Tax Registration Number (Optional)</Label>
              <Input
                id="org-tax-val"
                disabled={!isAdmin}
                placeholder="32AAAAA0000A1Z5"
                value={taxIdValue}
                onChange={(e) => setTaxIdValue(e.target.value)}
                className="bg-white"
              />
            </div>
          </div>
        </div>

        <div className="glass-card space-y-4 rounded-2xl p-4 sm:p-6">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-200/70 pb-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4b8f9a]/15 text-[#084154]">
                <Coins className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#084154]">
                  8-Currency FX Conversion Table (Anchored to INR)
                </h2>
                <p className="text-xs text-slate-500">
                  Used by Dashboard, Engagements, and Invoices KPI cards to convert mixed-currency totals accurately.
                </p>
              </div>
            </div>

            {isAdmin && (
              <Button
                type="button"
                variant="outline"
                disabled={isRefreshingRates}
                onClick={() => void handleRefreshLiveRates()}
                className="h-9 shrink-0 rounded-xl border-slate-200 bg-white px-3 text-xs font-semibold text-[#084154]"
              >
                <RefreshCw
                  className={`mr-1.5 h-3.5 w-3.5 text-[#4b8f9a] ${
                    isRefreshingRates ? "animate-spin" : ""
                  }`}
                />
                {isRefreshingRates ? "Fetching..." : "Refresh Live FX Rates"}
              </Button>
            )}
          </div>

          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="default-rep-curr">Default Executive Reporting Currency</Label>
            <select
              id="default-rep-curr"
              disabled={!isAdmin}
              value={defaultReportingCurrency}
              onChange={(e) =>
                setDefaultReportingCurrency(e.target.value as CurrencyCode)
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#084154]"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CURRENCY_OPTIONS.map((meta) => {
              const isBase = meta.code === "INR";
              return (
                <div
                  key={meta.code}
                  className="rounded-xl border border-slate-200/80 bg-white/90 p-3"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-[#084154]">
                    <span>
                      {meta.flag} 1 {meta.code}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                      {meta.region}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-500">=</span>
                    <Input
                      type="number"
                      step="any"
                      min="0.0001"
                      disabled={!isAdmin || isBase}
                      value={isBase ? "1" : fxRates[meta.code]}
                      onChange={(e) =>
                        setFxRates((prev) => ({
                          ...prev,
                          [meta.code]: e.target.value,
                        }))
                      }
                      className="h-9 bg-slate-50/70 text-xs font-bold text-[#084154]"
                    />
                    <span className="text-xs font-bold text-slate-500">INR</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-card space-y-4 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2.5 border-b border-slate-200/70 pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ffbf00]/20 text-[#084154]">
              <Landmark className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#084154]">
                Smart Payment Instructions (Auto-Selected by Invoice Currency)
              </h2>
              <p className="text-xs text-slate-500">
                INR invoices pull your Indian Bank/UPI details; AED, GCC, and USD invoices pull your International Wire / Payment Link block.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inr-pay">
                Domestic India Bank / UPI Details (Used on INR Invoices)
              </Label>
              <Textarea
                id="inr-pay"
                rows={4}
                disabled={!isAdmin}
                placeholder={`Account Name: YFounder\nBank: HDFC / Federal Bank\nAccount No: XXXXXXXXXX\nIFSC: XXXXXXXX\nUPI ID: yfounder@upi`}
                value={inrPaymentDetails}
                onChange={(e) => setInrPaymentDetails(e.target.value)}
                className="bg-white text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="intl-pay">
                GCC & International Wire / Stripe / Wise Details (AED, SAR, QAR, KWD, BHD, OMR, USD)
              </Label>
              <Textarea
                id="intl-pay"
                rows={4}
                disabled={!isAdmin}
                placeholder={`Beneficiary: Muhammad Asif Shanavas / YFounder\nSWIFT / BIC: XXXXXXXX\nIBAN / Account: XXXXXXXXXX\nOnline Card / Payment Link: https://...`}
                value={internationalPaymentDetails}
                onChange={(e) => setInternationalPaymentDetails(e.target.value)}
                className="bg-white text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inv-footer">Default Invoice PDF Footer Note</Label>
            <Input
              id="inv-footer"
              disabled={!isAdmin}
              value={invoiceFooterNote}
              onChange={(e) => setInvoiceFooterNote(e.target.value)}
              className="bg-white"
            />
          </div>
        </div>

        {isAdmin && (
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isSaving}
              className="brand-gradient h-11 rounded-xl px-6 text-sm font-semibold text-white shadow-sm hover:opacity-95"
            >
              <Save className="mr-2 h-4 w-4 text-[#ffbf00]" />
              {isSaving ? "Saving Profile..." : "Save Billing Profile & FX Rates"}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}