import { createClient } from "@/lib/supabase/server";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import type { ActivityWithDetails, TaskWithDetails } from "@/types/crm";

export default async function TasksPage() {
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    { data: tasks },
    { data: activities },
    { data: companies },
    { data: projects },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("tasks")
      .select("*, companies(id, name), projects(id, title)")
      .order("created_at", { ascending: false }),
    supabase
      .from("activities")
      .select("*, companies(id, name), projects(id, title)")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("companies")
      .select("id, name")
      .order("name", { ascending: true }),
    supabase
      .from("projects")
      .select("id, company_id, title")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <TasksWorkspace
      initialTasks={(tasks as TaskWithDetails[]) ?? []}
      initialActivities={(activities as ActivityWithDetails[]) ?? []}
      companies={(companies as Array<{ id: string; name: string }>) ?? []}
      projects={
        (projects as Array<{ id: string; company_id: string; title: string }>) ??
        []
      }
      currentUserId={user?.id ?? ""}
    />
  );
}