import { createClient } from "@/lib/supabase/server";
import { LeadsWorkspace } from "@/components/leads/leads-workspace";
import type { LeadRecord } from "@/types/crm";
export default async function LeadsPage() {
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    { data: leads },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <LeadsWorkspace
      initialLeads={(leads as LeadRecord[]) ?? []}
      currentUserId={user?.id ?? ""}
    />
  );
}