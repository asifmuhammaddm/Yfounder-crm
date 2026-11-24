import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyAmount, normalizeCurrency } from "@/lib/currency-core";
import { PrintInvoiceActions } from "@/components/invoices/print-invoice-actions";
import type { OrganizationSettings } from "@/types/crm";

interface InvoicePrintPageProps {
  params: Promise<{ id: string }>;
}

interface ScopedLineRow {
  id: string;
  custom_scope: string | null;
  agreed_price: number;
  billing_type: string;
  services: {
    id: string;
    name: string;
    pricing_model: string;
  } | null;
}

export default async function InvoicePrintPage({
  params,
}: InvoicePrintPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: invoice }, { data: orgSettings }] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "*, companies(*), engagements(id, title, currency, engagement_services(*, services(id, name, pricing_model))), payments(*)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("organization_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  if (!invoice) {
    notFound();
  }

  const { data: primaryContact } = await supabase
    .from("contacts")
    .select("full_name, job_title, email, phone")
    .eq("company_id", invoice.company_id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const org = (orgSettings as OrganizationSettings | null) ?? {
    company_name: "YFounder",
    tagline: "360° Business Consulting & Growth Partner",
    website: "https://yfounder.in",
    billing_email: "",
    billing_phone: "",
    address_line1: "",
    address_line2: "",
    tax_id_label: "GSTIN",
    tax_id_value: "",
    inr_payment_details: "",
    international_payment_details: "",
    invoice_footer_note: "Thank you for partnering with YFounder.",
  };

  const curr = normalizeCurrency(invoice.currency);
  const totalAmount = Number(invoice.total_amount || 0);
  const amountPaid = Number(invoice.amount_paid || 0);
  const balanceDue = Math.max(0, totalAmount - amountPaid);

  const scopedServices =
    (invoice.engagements?.engagement_services as ScopedLineRow[] | undefined) ??
    [];
  const scopedSum = scopedServices.reduce(
    (sum, item) => sum + Number(item.agreed_price || 0),
    0
  );
  const useScopedLines =
    scopedServices.length > 0 && Math.abs(scopedSum - totalAmount) < 0.01;

  const defaultBankDetails =
    curr === "INR"
      ? org.inr_payment_details
      : org.international_payment_details;
  const paymentInstructions =
    invoice.notes?.trim() || defaultBankDetails?.trim() || "";

  return (
    <div className="min-h-screen bg-slate-100/70 py-4 sm:py-8 print:bg-white print:py-0">
      <PrintInvoiceActions />

      <div className="mx-auto w-full max-w-[210mm] rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-12 shadow-sm print:max-w-none print:rounded-none print:border-none print:p-0 print:shadow-none">
        <div className="h-2 w-full rounded-full bg-gradient-to-r from-[#084154] via-[#4b8f9a] to-[#ffbf00]" />

        <div className="mt-8 flex flex-col justify-between gap-6 border-b border-slate-200 pb-8 sm:flex-row sm:items-start">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#084154]">
              {org.company_name}
            </h1>
            {org.tagline && (
              <p className="text-xs font-semibold uppercase tracking-wider text-[#4b8f9a]">
                {org.tagline}
              </p>
            )}
            <div className="pt-2 space-y-0.5 text-xs text-slate-600">
              {org.address_line1 && <p>{org.address_line1}</p>}
              {org.address_line2 && <p>{org.address_line2}</p>}
              {(org.billing_email || org.billing_phone) && (
                <p>
                  {[org.billing_email, org.billing_phone]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {org.website && <p>{org.website}</p>}
              {org.tax_id_value && (
                <p className="pt-1 font-semibold text-[#084154]">
                  {org.tax_id_label || "Tax ID"}: {org.tax_id_value}
                </p>
              )}
            </div>
          </div>

          <div className="sm:text-right">
            <span className="inline-block rounded-lg bg-[#084154] px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
              INVOICE
            </span>
            <p className="mt-3 text-xl font-extrabold text-[#084154]">
              {invoice.invoice_number}
            </p>
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <p>
                <span className="font-semibold text-slate-500">Issue Date:</span>{" "}
                {invoice.issue_date}
              </p>
              <p>
                <span className="font-semibold text-slate-500">Due Date:</span>{" "}
                <span className="font-bold text-[#084154]">
                  {invoice.due_date}
                </span>
              </p>
              <p>
                <span className="font-semibold text-slate-500">Currency:</span>{" "}
                <span className="font-bold text-[#084154]">{curr}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-500">Status:</span>{" "}
                <span className="font-bold text-[#4b8f9a]">
                  {invoice.status}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Billed To
            </p>
            <p className="mt-1.5 text-base font-bold text-[#084154]">
              {invoice.companies?.name}
            </p>
            {primaryContact && (
              <p className="mt-0.5 text-xs font-medium text-slate-700">
                Attn: {primaryContact.full_name}
                {primaryContact.job_title
                  ? ` (${primaryContact.job_title})`
                  : ""}
              </p>
            )}
            {(invoice.companies?.city || invoice.companies?.country) && (
              <p className="mt-0.5 text-xs text-slate-500">
                {[invoice.companies.city, invoice.companies.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
            {(primaryContact?.email || primaryContact?.phone) && (
              <p className="mt-1 text-xs text-slate-500">
                {[primaryContact.email, primaryContact.phone]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200/80 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Engagement Reference
            </p>
            <p className="mt-1.5 text-sm font-bold text-[#084154]">
              {invoice.engagements?.title || "Consulting & Growth Advisory"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              All amounts on this invoice are denominated and payable in{" "}
              <span className="font-bold text-[#084154]">{curr}</span>.
            </p>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#084154] text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">Description & Scope</th>
                <th className="px-4 py-3 font-semibold">Billing Type</th>
                <th className="px-4 py-3 text-right font-semibold">
                  Amount ({curr})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {useScopedLines ? (
                scopedServices.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-[#084154]">
                        {line.services?.name ?? "Consulting Service"}
                      </p>
                      {line.custom_scope && (
                        <p className="mt-1 whitespace-pre-line text-[11px] text-slate-500">
                          {line.custom_scope}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {line.billing_type}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-[#084154]">
                      {formatCurrencyAmount(line.agreed_price, curr)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-3.5">
                    <p className="font-bold text-[#084154]">
                      {invoice.engagements?.title ||
                        "Strategic Growth & Consulting Services"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Professional consulting deliverables as per agreed scope.
                    </p>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">Invoice</td>
                  <td className="px-4 py-3.5 text-right font-bold text-[#084154]">
                    {formatCurrencyAmount(totalAmount, curr)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-12">
          <div className="sm:col-span-7">
            {paymentInstructions && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#084154]">
                  Payment Instructions ({curr})
                </p>
                <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">
                  {paymentInstructions}
                </p>
              </div>
            )}
          </div>

          <div className="sm:col-span-5">
            <div className="space-y-2.5 rounded-xl bg-[#084154]/[0.04] p-4 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Invoice Total</span>
                <span className="font-bold text-[#084154]">
                  {formatCurrencyAmount(totalAmount, curr)}
                </span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Amount Paid</span>
                <span className="font-bold">
                  {formatCurrencyAmount(amountPaid, curr)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-300/80 pt-2.5 text-sm font-extrabold text-[#084154]">
                <span>Balance Due</span>
                <span>{formatCurrencyAmount(balanceDue, curr)}</span>
              </div>
            </div>
          </div>
        </div>

        {org.invoice_footer_note && (
          <div className="mt-10 border-t border-slate-200 pt-5 text-center text-xs text-slate-500">
            {org.invoice_footer_note}
          </div>
        )}
      </div>
    </div>
  );
}