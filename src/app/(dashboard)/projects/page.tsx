import { createClient } from "@/lib/supabase/server";
import {
  ProjectsWorkspace,
  type ProjectCompanyOption,
  type ProjectEngagementOption,
} from "@/components/projects/projects-workspace";
import type {
  ActivityRecord,
  ProjectWithDetails,
  TaskRecord,
} from "@/types/crm";

export default async function ProjectsPage() {
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    { data: projects },
    { data: tasks },
    { data: activities },
    { data: companies },
    { data: engagements },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("projects")
      .select(
        "*, companies(id, name, client_category), engagements(id, title, status)"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("activities")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("companies")
      .select("id, name, client_category")
      .order("name", { ascending: true }),
    supabase
      .from("engagements")
      .select("id, company_id, title, status")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <ProjectsWorkspace
      initialProjects={(projects as ProjectWithDetails[]) ?? []}
      initialTasks={(tasks as TaskRecord[]) ?? []}
      initialActivities={(activities as ActivityRecord[]) ?? []}
      companies={(companies as ProjectCompanyOption[]) ?? []}
      engagements={(engagements as ProjectEngagementOption[]) ?? []}
      currentUserId={user?.id ?? ""}
    />
  );
}