"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Building2,
  Briefcase,
  Calendar,
  Pencil,
  Trash2,
  CheckCircle2,
  Circle,
  Award,
  MessageSquarePlus,
  PhoneCall,
  Users,
  FileText,
  StickyNote,
  ExternalLink,
  Sparkles,
  ListTodo,
  Link2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  ActivityRecord,
  ActivityType,
  ProjectStatus,
  ProjectWithDetails,
  TaskPriority,
  TaskRecord,
  TaskStatus,
} from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const PROJECT_STATUSES: ProjectStatus[] = [
  "Not Started",
  "In Progress",
  "Waiting on Client",
  "On Hold",
  "Completed",
  "Cancelled",
];

const TASK_PRIORITIES: TaskPriority[] = ["Low", "Medium", "High"];
const TASK_STATUSES: TaskStatus[] = ["Todo", "In Progress", "Done"];
const ACTIVITY_TYPES: ActivityType[] = ["Note", "Call", "Meeting", "File"];

export interface ProjectCompanyOption {
  id: string;
  name: string;
  client_category: string;
}

export interface ProjectEngagementOption {
  id: string;
  company_id: string;
  title: string;
  status: string;
}

function getProjectBadgeClass(status: string) {
  switch (status) {
    case "Not Started":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "In Progress":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "Waiting on Client":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "On Hold":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "Completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Cancelled":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function getPriorityBadgeClass(priority: string) {
  switch (priority) {
    case "High":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "Medium":
      return "bg-amber-50 text-amber-800 border-amber-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function renderActivityIcon(type: string) {
  switch (type) {
    case "Call":
      return <PhoneCall className="h-3.5 w-3.5 text-sky-600" />;
    case "Meeting":
      return <Users className="h-3.5 w-3.5 text-amber-600" />;
    case "File":
      return <FileText className="h-3.5 w-3.5 text-emerald-600" />;
    default:
      return <StickyNote className="h-3.5 w-3.5 text-[#4b8f9a]" />;
  }
}

interface ProjectsWorkspaceProps {
  initialProjects: ProjectWithDetails[];
  initialTasks: TaskRecord[];
  initialActivities: ActivityRecord[];
  companies: ProjectCompanyOption[];
  engagements: ProjectEngagementOption[];
  currentUserId: string;
}

export function ProjectsWorkspace({
  initialProjects,
  initialTasks,
  initialActivities,
  companies,
  engagements,
  currentUserId,
}: ProjectsWorkspaceProps) {
  const router = useRouter();
  const [projects, setProjects] =
    useState<ProjectWithDetails[]>(initialProjects);
  const [tasks, setTasks] = useState<TaskRecord[]>(initialTasks);
  const [activities, setActivities] =
    useState<ActivityRecord[]>(initialActivities);

  // Sync latest tasks & activities whenever navigating to /projects
  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function syncLatestDeliveryData() {
      const [{ data: latestTasks }, { data: latestActivities }] =
        await Promise.all([
          supabase
            .from("tasks")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("activities")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);

      if (!isMounted) return;
      if (latestTasks) setTasks(latestTasks as TaskRecord[]);
      if (latestActivities) setActivities(latestActivities as ActivityRecord[]);
    }

    syncLatestDeliveryData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [companyFilter, setCompanyFilter] = useState<string>("All");

  // Create / Edit Project Modal
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] =
    useState<ProjectWithDetails | null>(null);
  const [projCompanyId, setProjCompanyId] = useState<string>(
    companies[0]?.id ?? ""
  );
  const [projEngagementId, setProjEngagementId] = useState<string>("");
  const [projTitle, setProjTitle] = useState("");
  const [projStatus, setProjStatus] = useState<ProjectStatus>("In Progress");
  const [projStartDate, setProjStartDate] = useState("");
  const [projDueDate, setProjDueDate] = useState("");
  const [isSavingProject, setIsSavingProject] = useState(false);

  // Delivery Workspace Modal
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskIsMilestone, setNewTaskIsMilestone] = useState(false);
  const [newTaskPriority, setNewTaskPriority] =
    useState<TaskPriority>("Medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);

  const [newActivityType, setNewActivityType] = useState<ActivityType>("Note");
  const [newActivitySummary, setNewActivitySummary] = useState("");
  const [newActivityFileUrl, setNewActivityFileUrl] = useState("");
  const [isAddingActivity, setIsAddingActivity] = useState(false);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  const activeProjectTasks = useMemo(
    () => tasks.filter((t) => t.project_id === activeProjectId),
    [tasks, activeProjectId]
  );

  const activeCompanyUnassignedTasks = useMemo(() => {
    if (!activeProject) return [];
    return tasks.filter(
      (t) => t.company_id === activeProject.company_id && !t.project_id
    );
  }, [tasks, activeProject]);

  const activeProjectActivities = useMemo(
    () =>
      activities.filter(
        (a) =>
          a.project_id === activeProjectId ||
          (activeProject &&
            a.company_id === activeProject.company_id &&
            !a.project_id)
      ),
    [activities, activeProjectId, activeProject]
  );

  const metrics = useMemo(() => {
    return {
      total: projects.length,
      inProgress: projects.filter((p) => p.status === "In Progress").length,
      waiting: projects.filter(
        (p) => p.status === "Waiting on Client" || p.status === "On Hold"
      ).length,
      completed: projects.filter((p) => p.status === "Completed").length,
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((proj) => {
      if (statusFilter !== "All" && proj.status !== statusFilter) return false;
      if (companyFilter !== "All" && proj.company_id !== companyFilter) {
        return false;
      }

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const haystack = [
        proj.title,
        proj.companies?.name,
        proj.engagements?.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [projects, statusFilter, companyFilter, searchQuery]);

  const availableEngagementsForSelectedCompany = useMemo(() => {
    return engagements.filter((e) => e.company_id === projCompanyId);
  }, [engagements, projCompanyId]);

  function openCreateProjectModal() {
    if (companies.length === 0) {
      toast.error(
        "Add or convert a Client Company first before creating a project."
      );
      return;
    }

    const defaultComp =
      companyFilter !== "All" ? companyFilter : companies[0]?.id ?? "";
    setEditingProject(null);
    setProjCompanyId(defaultComp);
    setProjEngagementId("");
    setProjTitle("");
    setProjStatus("In Progress");
    setProjStartDate(new Date().toISOString().slice(0, 10));
    setProjDueDate("");
    setProjectModalOpen(true);
  }

  function openEditProjectModal(proj: ProjectWithDetails) {
    setEditingProject(proj);
    setProjCompanyId(proj.company_id);
    setProjEngagementId(proj.engagement_id ?? "");
    setProjTitle(proj.title);
    setProjStatus(proj.status as ProjectStatus);
    setProjStartDate(proj.start_date ?? "");
    setProjDueDate(proj.due_date ?? "");
    setProjectModalOpen(true);
  }

  async function handleSaveProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!projCompanyId || !projTitle.trim()) {
      toast.error("Client company and project title are required.");
      return;
    }

    setIsSavingProject(true);
    const supabase = createClient();

    const payload = {
      company_id: projCompanyId,
      engagement_id: projEngagementId || null,
      title: projTitle.trim(),
      status: projStatus,
      start_date: projStartDate || null,
      due_date: projDueDate || null,
      owner_id: currentUserId || null,
    };

    try {
      if (editingProject) {
        const { data, error } = await supabase
          .from("projects")
          .update(payload)
          .eq("id", editingProject.id)
          .select(
            "*, companies(id, name, client_category), engagements(id, title, status)"
          )
          .single();

        if (error || !data) {
          throw new Error(error?.message || "Could not update project.");
        }

        setProjects((prev) =>
          prev.map((item) =>
            item.id === editingProject.id ? (data as ProjectWithDetails) : item
          )
        );
        toast.success("Project updated");
      } else {
        const { data, error } = await supabase
          .from("projects")
          .insert(payload)
          .select(
            "*, companies(id, name, client_category), engagements(id, title, status)"
          )
          .single();

        if (error || !data) {
          throw new Error(error?.message || "Could not create project.");
        }

        setProjects((prev) => [data as ProjectWithDetails, ...prev]);
        toast.success("Delivery project created");
      }

      setProjectModalOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save project."
      );
    } finally {
      setIsSavingProject(false);
    }
  }

  async function handleDeleteProject(proj: ProjectWithDetails) {
    const confirmed = window.confirm(
      `Delete project "${proj.title}"? Linked tasks will remain available under Tasks & Follow-Ups.`
    );
    if (!confirmed) return;

    const supabase = createClient();

    await supabase
      .from("tasks")
      .update({ project_id: null })
      .eq("project_id", proj.id);
    await supabase
      .from("activities")
      .update({ project_id: null })
      .eq("project_id", proj.id);

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", proj.id);

    if (error) {
      toast.error(`Could not delete project: ${error.message}`);
      return;
    }

    setProjects((prev) => prev.filter((item) => item.id !== proj.id));
    setTasks((prev) =>
      prev.map((t) => (t.project_id === proj.id ? { ...t, project_id: null } : t))
    );
    if (activeProjectId === proj.id) setActiveProjectId(null);
    toast.success("Project deleted");
    router.refresh();
  }

  async function handleQuickProjectStatusChange(
    proj: ProjectWithDetails,
    nextStatus: string
  ) {
    if (nextStatus === proj.status) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({ status: nextStatus })
      .eq("id", proj.id);

    if (error) {
      toast.error(`Status update failed: ${error.message}`);
      return;
    }

    setProjects((prev) =>
      prev.map((item) =>
        item.id === proj.id ? { ...item, status: nextStatus } : item
      )
    );
    toast.success(`Project moved to ${nextStatus}`);
    router.refresh();
  }

  async function handleAddProjectTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeProject || !newTaskTitle.trim()) return;

    setIsAddingTask(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        project_id: activeProject.id,
        company_id: activeProject.company_id,
        title: newTaskTitle.trim(),
        is_milestone: newTaskIsMilestone,
        priority: newTaskPriority,
        status: "Todo",
        due_date: newTaskDueDate || null,
        assigned_to: currentUserId || null,
      })
      .select()
      .single();

    setIsAddingTask(false);

    if (error || !data) {
      toast.error(`Could not add task: ${error?.message || "Error"}`);
      return;
    }

    setTasks((prev) => [data as TaskRecord, ...prev]);
    setNewTaskTitle("");
    setNewTaskIsMilestone(false);
    setNewTaskDueDate("");
    toast.success(newTaskIsMilestone ? "Milestone added" : "Task added");
    router.refresh();
  }

  async function handleAssignTaskToActiveProject(taskId: string) {
    if (!activeProject) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("tasks")
      .update({ project_id: activeProject.id })
      .eq("id", taskId);

    if (error) {
      toast.error(error.message);
      return;
    }

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, project_id: activeProject.id } : t
      )
    );
    toast.success("Task linked to this project");
    router.refresh();
  }

  async function handleCycleTaskStatus(task: TaskRecord) {
    const nextStatus: TaskStatus =
      task.status === "Todo"
        ? "In Progress"
        : task.status === "In Progress"
          ? "Done"
          : "Todo";

    const supabase = createClient();
    const { error } = await supabase
      .from("tasks")
      .update({ status: nextStatus })
      .eq("id", task.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );
    router.refresh();
  }

  async function handleDeleteTask(taskId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      toast.error(error.message);
      return;
    }

    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    toast.success("Task deleted");
    router.refresh();
  }

  async function handleAddProjectActivity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeProject || !newActivitySummary.trim()) return;

    setIsAddingActivity(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("activities")
      .insert({
        company_id: activeProject.company_id,
        project_id: activeProject.id,
        type: newActivityType,
        summary: newActivitySummary.trim(),
        file_url: newActivityFileUrl.trim() || null,
        created_by: currentUserId || null,
      })
      .select()
      .single();

    setIsAddingActivity(false);

    if (error || !data) {
      toast.error(`Could not log activity: ${error?.message || "Error"}`);
      return;
    }

    setActivities((prev) => [data as ActivityRecord, ...prev]);
    setNewActivitySummary("");
    setNewActivityFileUrl("");
    toast.success(`${newActivityType} logged`);
    router.refresh();
  }

  async function handleDeleteActivity(activityId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("activities")
      .delete()
      .eq("id", activityId);

    if (error) {
      toast.error(error.message);
      return;
    }

    setActivities((prev) => prev.filter((a) => a.id !== activityId));
    toast.success("Activity entry deleted");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#084154]">
            Project Delivery & Milestones
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track client delivery workspaces, key milestones, action items, and meeting logs.
          </p>
        </div>

        <Button
          type="button"
          onClick={openCreateProjectModal}
          className="brand-gradient h-10 rounded-xl px-4 text-xs font-semibold text-white shadow-sm hover:opacity-95"
        >
          <Plus className="mr-1.5 h-4 w-4 text-[#ffbf00]" />
          New Delivery Project
        </Button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Projects
          </p>
          <p className="mt-2 text-2xl font-bold text-[#084154]">
            {metrics.total}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            In Progress
          </p>
          <p className="mt-2 text-2xl font-bold text-sky-600">
            {metrics.inProgress}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Waiting / On Hold
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {metrics.waiting}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Completed
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {metrics.completed}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card space-y-4 rounded-2xl p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search project title, client, or engagement..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 bg-white pl-9"
            />
          </div>

          <select
            aria-label="Filter by client"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#084154]"
          >
            <option value="All">All Client Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200/70 pt-3">
          {["All", ...PROJECT_STATUSES].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                statusFilter === st
                  ? "bg-[#4b8f9a] text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-[#4b8f9a]"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center">
          <div className="brand-gradient-subtle flex h-12 w-12 items-center justify-center rounded-2xl text-[#084154]">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-bold text-[#084154]">
            {projects.length === 0
              ? "No delivery projects launched yet"
              : "No projects match your current filters"}
          </h3>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            {projects.length === 0
              ? "Launch a project from any proposal in Engagements or create a standalone delivery workspace right here."
              : "Try clearing your search text or switching the status/client filters above."}
          </p>
          {projects.length === 0 && (
            <Button
              type="button"
              onClick={openCreateProjectModal}
              className="brand-gradient mt-5 rounded-xl font-semibold text-white"
            >
              + Create First Delivery Project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredProjects.map((proj) => {
            const projectTasks = tasks.filter((t) => t.project_id === proj.id);
            const doneTasks = projectTasks.filter(
              (t) => t.status === "Done"
            ).length;
            const milestonesCount = projectTasks.filter(
              (t) => t.is_milestone
            ).length;
            const projectActivitiesCount = activities.filter(
              (a) => a.project_id === proj.id
            ).length;
            const generalCompanyTasksCount = tasks.filter(
              (t) => t.company_id === proj.company_id && !t.project_id
            ).length;
            const progressPct =
              projectTasks.length > 0
                ? Math.round((doneTasks / projectTasks.length) * 100)
                : 0;

            return (
              <div
                key={proj.id}
                className="glass-card flex flex-col justify-between rounded-2xl p-5 transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-[#084154]">
                        {proj.title}
                      </h2>
                      {proj.companies && (
                        <Link
                          href={`/companies/${proj.companies.id}`}
                          className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[#4b8f9a] hover:text-[#084154]"
                        >
                          <Building2 className="h-3.5 w-3.5" />
                          {proj.companies.name}
                        </Link>
                      )}
                    </div>

                    <select
                      aria-label={`Status for ${proj.title}`}
                      value={proj.status}
                      onChange={(e) =>
                        handleQuickProjectStatusChange(proj, e.target.value)
                      }
                      className={`rounded-full border px-3 py-1 text-xs font-semibold focus:outline-none ${getProjectBadgeClass(
                        proj.status
                      )}`}
                    >
                      {PROJECT_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    {proj.engagements && (
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Briefcase className="h-3.5 w-3.5 text-[#4b8f9a]" />
                        Deal: {proj.engagements.title}
                      </span>
                    )}

                    {proj.start_date && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        Start: {proj.start_date}
                      </span>
                    )}

                    {proj.due_date && (
                      <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                        <Calendar className="h-3.5 w-3.5" />
                        Due: {proj.due_date}
                      </span>
                    )}
                  </div>

                  {/* Milestone & Task Progress Bar */}
                  <div className="mt-4 rounded-xl bg-[#084154]/[0.04] p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#084154]">
                        Delivery Progress ({doneTasks}/{projectTasks.length}{" "}
                        tasks · {milestonesCount} milestones)
                      </span>
                      <span className="font-bold text-[#4b8f9a]">
                        {progressPct}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="brand-gradient h-full rounded-full transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    {generalCompanyTasksCount > 0 && (
                      <p className="mt-2 text-[11px] text-slate-500">
                        + {generalCompanyTasksCount} general client{" "}
                        {generalCompanyTasksCount === 1 ? "task" : "tasks"} (open
                        Tasks & Activity to link)
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-3.5">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setActiveProjectId(proj.id)}
                    className="brand-gradient h-8 rounded-lg px-3.5 text-xs font-semibold text-white"
                  >
                    <ListTodo className="mr-1.5 h-3.5 w-3.5 text-[#ffbf00]" />
                    Tasks & Activity ({projectTasks.length} ·{" "}
                    {projectActivitiesCount})
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEditProjectModal(proj)}
                      className="h-8 rounded-lg px-2.5 text-xs font-semibold text-[#084154]"
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${proj.title}`}
                      onClick={() => handleDeleteProject(proj)}
                      className="h-8 w-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Project Modal */}
      <Dialog open={projectModalOpen} onOpenChange={setProjectModalOpen}>
        <DialogContent className="sm:max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#084154]">
              {editingProject
                ? "Edit Delivery Project"
                : "New Delivery Project"}
            </DialogTitle>
            <DialogDescription>
              Associate a project workspace with a client company and optional engagement scope.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProject} className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="proj-company">Client Company *</Label>
                <select
                  id="proj-company"
                  required
                  value={projCompanyId}
                  onChange={(e) => {
                    setProjCompanyId(e.target.value);
                    setProjEngagementId("");
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.client_category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proj-eng">Linked Engagement (Optional)</Label>
                <select
                  id="proj-eng"
                  value={projEngagementId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setProjEngagementId(nextId);
                    const matched = engagements.find(
                      (item) => item.id === nextId
                    );
                    if (matched && !projTitle.trim()) {
                      setProjTitle(matched.title);
                    }
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
                >
                  <option value="">Standalone Project</option>
                  {availableEngagementsForSelectedCompany.map((eng) => (
                    <option key={eng.id} value={eng.id}>
                      {eng.title} ({eng.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="proj-title">Project Title *</Label>
                <Input
                  id="proj-title"
                  required
                  placeholder="e.g., UAE Mainland License & Bank Setup"
                  value={projTitle}
                  onChange={(e) => setProjTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proj-status">Delivery Status *</Label>
                <select
                  id="proj-status"
                  value={projStatus}
                  onChange={(e) =>
                    setProjStatus(e.target.value as ProjectStatus)
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
                >
                  {PROJECT_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="proj-start">Start Date</Label>
                <Input
                  id="proj-start"
                  type="date"
                  value={projStartDate}
                  onChange={(e) => setProjStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proj-due">Target Completion Date</Label>
                <Input
                  id="proj-due"
                  type="date"
                  value={projDueDate}
                  onChange={(e) => setProjDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setProjectModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingProject}
                className="brand-gradient font-semibold text-white"
              >
                {isSavingProject
                  ? "Saving..."
                  : editingProject
                    ? "Save Project"
                    : "Create Project"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Project Tasks, Milestones & Activity Log Modal */}
      <Dialog
        open={Boolean(activeProject)}
        onOpenChange={(open) => !open && setActiveProjectId(null)}
      >
        <DialogContent className="max-h-[92vh] sm:max-w-3xl overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#084154]">
              {activeProject?.title}
            </DialogTitle>
            <DialogDescription>
              {activeProject?.companies?.name} · Manage milestones, action tasks, and client delivery logs.
            </DialogDescription>
          </DialogHeader>

          {activeProject && (
            <div className="space-y-6 pt-2">
              {/* Section 1: Milestones & Tasks */}
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#084154]">
                  Project Milestones & Tasks ({activeProjectTasks.length})
                </p>

                <form
                  onSubmit={handleAddProjectTask}
                  className="grid gap-2.5 sm:grid-cols-12"
                >
                  <div className="sm:col-span-5">
                    <Input
                      required
                      placeholder="Add milestone or deliverable task..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <select
                      aria-label="Task priority"
                      value={newTaskPriority}
                      onChange={(e) =>
                        setNewTaskPriority(e.target.value as TaskPriority)
                      }
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800"
                    >
                      {TASK_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <Input
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="bg-white text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Button
                      type="submit"
                      disabled={isAddingTask}
                      className="brand-gradient h-9 w-full text-xs font-semibold text-white"
                    >
                      + Add
                    </Button>
                  </div>

                  <label className="sm:col-span-12 inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#084154]">
                    <input
                      type="checkbox"
                      checked={newTaskIsMilestone}
                      onChange={(e) => setNewTaskIsMilestone(e.target.checked)}
                      className="accent-[#084154]"
                    />
                    Mark as Key Client Milestone
                  </label>
                </form>

                {activeProjectTasks.length === 0 ? (
                  <p className="py-3 text-center text-xs text-slate-400">
                    No tasks directly linked to this project yet.
                  </p>
                ) : (
                  <div className="space-y-2 pt-1">
                    {activeProjectTasks.map((task) => {
                      const isDone = task.status === "Done";

                      return (
                        <div
                          key={task.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5"
                        >
                          <div className="flex items-start gap-2.5">
                            <button
                              type="button"
                              onClick={() => handleCycleTaskStatus(task)}
                              title="Click to cycle status (Todo → In Progress → Done)"
                              className="mt-0.5 text-[#4b8f9a] hover:text-[#084154]"
                            >
                              {isDone ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Circle className="h-4 w-4" />
                              )}
                            </button>

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`text-xs font-semibold ${
                                    isDone
                                      ? "line-through text-slate-400"
                                      : "text-[#084154]"
                                  }`}
                                >
                                  {task.title}
                                </span>

                                {task.is_milestone && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#ffbf00]/25 px-2 py-0.5 text-[10px] font-bold text-[#084154]">
                                    <Award className="h-3 w-3" />
                                    Milestone
                                  </span>
                                )}
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                <span
                                  className={`rounded border px-1.5 py-0.2 font-semibold ${getPriorityBadgeClass(
                                    task.priority
                                  )}`}
                                >
                                  {task.priority}
                                </span>
                                <span className="font-medium text-[#4b8f9a]">
                                  {task.status}
                                </span>
                                {task.due_date && (
                                  <span>· Due {task.due_date}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            aria-label="Delete task"
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Unassigned General Client Tasks */}
                {activeCompanyUnassignedTasks.length > 0 && (
                  <div className="mt-4 space-y-2 border-t border-slate-200 pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      General Tasks for {activeProject.companies?.name} (
                      {activeCompanyUnassignedTasks.length})
                    </p>
                    {activeCompanyUnassignedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-slate-300 bg-white/80 px-3 py-2 text-xs"
                      >
                        <span className="font-medium text-slate-700">
                          {task.title}{" "}
                          <span className="text-slate-400">({task.status})</span>
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignTaskToActiveProject(task.id)}
                          className="h-7 px-2.5 text-[11px] font-semibold text-[#084154]"
                        >
                          <Link2 className="mr-1 h-3 w-3 text-[#4b8f9a]" />
                          Link to Project
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Project & Client Activity Log */}
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#084154]">
                  <MessageSquarePlus className="h-4 w-4 text-[#4b8f9a]" />
                  Delivery Activity Log ({activeProjectActivities.length})
                </p>

                <form
                  onSubmit={handleAddProjectActivity}
                  className="grid gap-2.5 sm:grid-cols-12"
                >
                  <div className="sm:col-span-3">
                    <select
                      aria-label="Activity type"
                      value={newActivityType}
                      onChange={(e) =>
                        setNewActivityType(e.target.value as ActivityType)
                      }
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-[#084154]"
                    >
                      {ACTIVITY_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-6">
                    <Input
                      required
                      placeholder="Log call summary, meeting outcome, or deliverable update..."
                      value={newActivitySummary}
                      onChange={(e) => setNewActivitySummary(e.target.value)}
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <Button
                      type="submit"
                      disabled={isAddingActivity}
                      className="h-9 w-full bg-[#084154] text-xs font-semibold text-white hover:bg-[#4b8f9a]"
                    >
                      Log Entry
                    </Button>
                  </div>

                  <div className="sm:col-span-12">
                    <Input
                      type="url"
                      placeholder="Optional document / recording URL (https://...)"
                      value={newActivityFileUrl}
                      onChange={(e) => setNewActivityFileUrl(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </form>

                {activeProjectActivities.length === 0 ? (
                  <p className="py-2 text-center text-xs text-slate-400">
                    No calls, meetings, or notes logged for this project yet.
                  </p>
                ) : (
                  <div className="max-h-56 space-y-2 overflow-y-auto pt-1">
                    {activeProjectActivities.map((act) => (
                      <div
                        key={act.id}
                        className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5">
                            {renderActivityIcon(act.type)}
                          </div>
                          <div>
                            <p className="font-semibold text-[#084154]">
                              <span className="mr-1.5 rounded bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 border border-slate-200">
                                {act.type}
                              </span>
                              {act.summary}
                            </p>
                            {act.file_url && (
                              <a
                                href={act.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#4b8f9a] hover:underline"
                              >
                                Open Attachment
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-400">
                            {new Date(act.created_at).toLocaleDateString()}
                          </span>
                          <button
                            type="button"
                            aria-label="Delete activity"
                            onClick={() => handleDeleteActivity(act.id)}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}