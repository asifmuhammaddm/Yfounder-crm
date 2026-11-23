import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmSidebar } from "@/components/crm-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] lg:flex">
      <CrmSidebar userEmail={user.email ?? "Founder"} />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}