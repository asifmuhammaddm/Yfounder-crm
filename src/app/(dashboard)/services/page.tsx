import { createClient } from "@/lib/supabase/server";
import { ServicesWorkspace } from "@/components/services/services-workspace";
import type {
  ServiceCategoryRecord,
  ServiceWithCategory,
} from "@/types/crm";

export default async function ServicesCatalogPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: services }] = await Promise.all([
    supabase
      .from("service_categories")
      .select("*")
      .order("name", { ascending: true }),
    supabase
      .from("services")
      .select("*, service_categories(id, name, is_active)")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <ServicesWorkspace
      initialCategories={(categories as ServiceCategoryRecord[]) ?? []}
      initialServices={(services as ServiceWithCategory[]) ?? []}
    />
  );
}