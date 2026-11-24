import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyAmount, normalizeCurrency } from "@/lib/currency-core";
import type { OrganizationSettings } from "@/types/crm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return NextResponse.json(
      {
        error:
          "RESEND_API_KEY is not configured yet. Add it in .env.local and Vercel Environment Variables.",
      },
      { status: 400 }
    );
  }

  const [{ data: invoice }, { data: orgSettings }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, companies(id, name), engagements(id, title)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("organization_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select("full_name, email")
    .eq("company_id", invoice.company_id)
    .not("email", "is", null)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!contact?.email) {
    return NextResponse.json(
      {
        error: `No contact email found for ${invoice.companies?.name || "this client"}. Add a contact email under Clients & Companies first.`,
      },
      { status: 400 }
    );
  }

  const org = (orgSettings as OrganizationSettings | null) ?? {
    company_name: "YFounder",
    billing_email: "",
    inr_payment_details: "",
    international_payment_details: "",
    invoice_footer_note: "Thank you for partnering with YFounder.",
  };

  const curr = normalizeCurrency(invoice.currency);
  const totalFormatted = formatCurrencyAmount(invoice.total_amount, curr);
  const balanceDue = Math.max(
    0,
    Number(invoice.total_amount || 0) - Number(invoice.amount_paid || 0)
  );
  const balanceFormatted = formatCurrencyAmount(balanceDue, curr);

  const origin = new URL(request.url).origin;
  const printUrl = `${origin}/invoices/${invoice.id}/print`;
  const paymentBlock =
    invoice.notes?.trim() ||
    (curr === "INR"
      ? org.inr_payment_details
      : org.international_payment_details) ||
    "";

  const fromEmail =
    process.env.RESEND_FROM_EMAIL || "YFounder Billing <onboarding@resend.dev>";

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; color: #202124; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #084154 0%, #4b8f9a 100%); padding: 24px; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px;">${org.company_name}</h2>
        <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Invoice ${invoice.invoice_number}</p>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 14px;">Hi ${contact.full_name || invoice.companies?.name || "there"},</p>
        <p style="font-size: 14px; line-height: 1.6;">
          Please find your invoice <strong>${invoice.invoice_number}</strong>${
            invoice.engagements?.title
              ? ` for <strong>${invoice.engagements.title}</strong>`
              : ""
          }.
        </p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 13px;">
          <p style="margin: 4px 0;"><strong>Invoice Total:</strong> ${totalFormatted}</p>
          <p style="margin: 4px 0;"><strong>Balance Due:</strong> ${balanceFormatted}</p>
          <p style="margin: 4px 0;"><strong>Due Date:</strong> ${invoice.due_date}</p>
        </div>
        ${
          paymentBlock
            ? `<div style="border-left: 3px solid #ffbf00; padding-left: 12px; margin: 16px 0; font-size: 12px; white-space: pre-line; color: #334155;"><strong>Payment Instructions:</strong><br/>${paymentBlock}</div>`
            : ""
        }
        <p style="margin: 22px 0;">
          <a href="${printUrl}" style="background: #084154; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: bold;">
            View & Download A4 Invoice PDF
          </a>
        </p>
        <p style="font-size: 12px; color: #64748b; margin-top: 24px;">${org.invoice_footer_note || ""}</p>
      </div>
    </div>
  `;

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [contact.email],
      reply_to: org.billing_email || undefined,
      subject: `Invoice ${invoice.invoice_number} from ${org.company_name} (${balanceFormatted})`,
      html: htmlBody,
    }),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text();
    return NextResponse.json(
      { error: `Email dispatch failed: ${errText}` },
      { status: 502 }
    );
  }

  if (invoice.status === "Draft") {
    await supabase
      .from("invoices")
      .update({ status: "Sent" })
      .eq("id", invoice.id);
  }

  return NextResponse.json({ sentTo: contact.email });
}