import type { CurrencyCode } from "@/lib/currency";

export type { CurrencyCode };

export type ClientCategory = "Startup" | "SMB" | "Enterprise";

export type LeadStatus =
  | "New"
  | "Contacted"
  | "Qualified"
  | "Converted"
  | "Unqualified";

export type CompanyStatus =
  | "Prospect"
  | "Active Client"
  | "Paused"
  | "Past Client";

export type PricingModel =
  | "Fixed Fee"
  | "Monthly Retainer"
  | "Custom Quote";

export type EngagementStatus =
  | "Discovery"
  | "Proposal Sent"
  | "Negotiation"
  | "Won / Active"
  | "On Hold"
  | "Completed"
  | "Lost";

export type BillingType = "One-Time" | "Monthly Retainer";

export type ProjectStatus =
  | "Not Started"
  | "In Progress"
  | "Waiting on Client"
  | "On Hold"
  | "Completed"
  | "Cancelled";

export type TaskPriority = "Low" | "Medium" | "High";

export type TaskStatus = "Todo" | "In Progress" | "Done";

export type ActivityType = "Note" | "Call" | "Meeting" | "File";

export type InvoiceStatus =
  | "Draft"
  | "Sent"
  | "Partially Paid"
  | "Paid"
  | "Overdue"
  | "Void";

export interface OrganizationSettings {
  id: number;
  company_name: string;
  tagline: string | null;
  website: string | null;
  billing_email: string | null;
  billing_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  tax_id_label: string | null;
  tax_id_value: string | null;
  default_reporting_currency: CurrencyCode;
  fx_rates_to_inr: Record<CurrencyCode, number>;
  inr_payment_details: string | null;
  international_payment_details: string | null;
  invoice_footer_note: string | null;
  updated_at: string;
}

export interface LeadRecord {
  id: string;
  contact_name: string;
  company_name: string | null;
  client_category: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  next_followup_date: string | null;
  lost_reason: string | null;
  notes: string | null;
  owner_id: string | null;
  converted_company_id: string | null;
  created_at: string;
}

export interface ContactRecord {
  id: string;
  company_id: string;
  full_name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface CompanyRecord {
  id: string;
  name: string;
  normalized_name: string;
  client_category: string;
  status: string;
  default_currency: CurrencyCode;
  industry: string | null;
  website: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
}

export interface CompanyWithContacts extends CompanyRecord {
  contacts: ContactRecord[];
}

export interface ServiceCategoryRecord {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ServiceRecord {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  pricing_model: string;
  default_price: number;
  default_deliverables: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ServiceWithCategory extends ServiceRecord {
  service_categories: Pick<ServiceCategoryRecord, "id" | "name" | "is_active"> | null;
}

export interface EngagementRecord {
  id: string;
  company_id: string;
  title: string;
  requirements_summary: string | null;
  status: string;
  currency: CurrencyCode;
  total_value: number;
  start_date: string | null;
  renewal_date: string | null;
  proposal_file_url: string | null;
  contract_file_url: string | null;
  owner_id: string | null;
  created_at: string;
}

export interface EngagementServiceRecord {
  id: string;
  engagement_id: string;
  service_id: string;
  custom_scope: string | null;
  agreed_price: number;
  billing_type: string;
  created_at: string;
}

export interface EngagementServiceWithService extends EngagementServiceRecord {
  services: Pick<ServiceRecord, "id" | "name" | "pricing_model"> | null;
}

export interface EngagementWithDetails extends EngagementRecord {
  companies: Pick<CompanyRecord, "id" | "name" | "client_category" | "default_currency"> | null;
  engagement_services: EngagementServiceWithService[];
}

export interface ProjectSummaryRecord {
  id: string;
  engagement_id: string | null;
  title: string;
  status: string;
}

export interface ProjectRecord {
  id: string;
  company_id: string;
  engagement_id: string | null;
  title: string;
  status: string;
  start_date: string | null;
  due_date: string | null;
  owner_id: string | null;
  created_at: string;
}

export interface TaskRecord {
  id: string;
  project_id: string | null;
  company_id: string | null;
  title: string;
  is_milestone: boolean;
  priority: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
}

export interface ActivityRecord {
  id: string;
  company_id: string | null;
  lead_id: string | null;
  project_id: string | null;
  type: string;
  summary: string;
  file_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ProjectWithDetails extends ProjectRecord {
  companies: Pick<CompanyRecord, "id" | "name" | "client_category"> | null;
  engagements: Pick<EngagementRecord, "id" | "title" | "status"> | null;
}

export interface TaskWithDetails extends TaskRecord {
  companies: Pick<CompanyRecord, "id" | "name"> | null;
  projects: Pick<ProjectRecord, "id" | "title"> | null;
}

export interface ActivityWithDetails extends ActivityRecord {
  companies: Pick<CompanyRecord, "id" | "name"> | null;
  projects: Pick<ProjectRecord, "id" | "title"> | null;
}

export interface PaymentRecord {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  method: string | null;
  reference_note: string | null;
  created_at: string;
}

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  company_id: string;
  engagement_id: string | null;
  issue_date: string;
  due_date: string;
  currency: CurrencyCode;
  total_amount: number;
  amount_paid: number;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface InvoiceWithDetails extends InvoiceRecord {
  companies: Pick<
    CompanyRecord,
    "id" | "name" | "client_category" | "default_currency" | "city" | "country"
  > | null;
  engagements: Pick<EngagementRecord, "id" | "title" | "currency"> | null;
  payments: PaymentRecord[];
}