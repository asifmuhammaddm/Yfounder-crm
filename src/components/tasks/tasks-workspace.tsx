"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  Plus,
  Search,
  Award,
  Building2,
  FolderKanban,
  Trash2,
  Pencil,
  MessageSquarePlus,
  PhoneCall,
  Users,
  FileText,
  StickyNote,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  ActivityType,
  ActivityWithDetails,
  TaskPriority,
  TaskStatus,
  TaskWithDetails,
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

const TASK_PRIORITIES: TaskPriority[] = ["Low", "Medium", "High"];
const TASK_STATUSES: TaskStatus[] = ["Todo", "In Progress", "Done"];
const ACTIVITY_TYPES: ActivityType[] = ["Note", "Call", "Meeting", "File"];

interface TasksWorkspaceProps {
  initialTasks: TaskWithDetails[];
  initialActivities: ActivityWithDetails[];
  companies: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; company_id: string; title: string }>;
  currentUserId: string;
}

export function TasksWorkspace({
  initialTasks,
  initialActivities,
  companies,
  projects,
  currentUserId,
}: TasksWorkspaceProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskWithDetails[]>(initialTasks);
  const [activities, setActivities] =
    useState<ActivityWithDetails[]>(initialActivities);

  const defaultCompany = companies[0]?.id ?? "";
  const defaultProjectForFirstCompany =
    projects.find((p) => p.company_id === defaultCompany)?.id ?? "";

  // Task Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Open");
  const [milestonesOnly, setMilestonesOnly] = useState(false);

  // Quick Add Task State
  const [title, setTitle] = useState("");
  const [companyId, setCompanyId] = useState<string>(defaultCompany);
  const [projectId, setProjectId] = useState<string>(
    defaultProjectForFirstCompany
  );
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [dueDate, setDueDate] = useState("");
  const [isMilestone, setIsMilestone] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);

  // Edit Task Modal State
  const [editingTask, setEditingTask] = useState<TaskWithDetails | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCompanyId, setEditCompanyId] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editPriority, setEditPriority] = useState<TaskPriority>("Medium");
  const [editStatus, setEditStatus] = useState<TaskStatus>("Todo");
  const [editDueDate, setEditDueDate] = useState("");
  const [editIsMilestone, setEditIsMilestone] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Quick Log Activity State
  const [actCompanyId, setActCompanyId] = useState<string>(defaultCompany);
  const [actType, setActType] = useState<ActivityType>("Call");
  const [actSummary, setActSummary] = useState("");
  const [actFileUrl, setActFileUrl] = useState("");
  const [isLoggingAct, setIsLoggingAct] = useState(false);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter === "Open" && task.status === "Done") return false;
      if (
        statusFilter !== "All" &&
        statusFilter !== "Open" &&
        task.status !== statusFilter
      ) {
        return false;
      }
      if (milestonesOnly && !task.is_milestone) return false;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const haystack = [
        task.title,
        task.companies?.name,
        task.projects?.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [tasks, statusFilter, milestonesOnly, searchQuery]);

  function handleCompanyChange(nextCompanyId: string) {
    setCompanyId(nextCompanyId);
    const firstMatchingProject =
      projects.find((p) => p.company_id === nextCompanyId)?.id ?? "";
    setProjectId(firstMatchingProject);
  }

  async function handleAddTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return;

    setIsAddingTask(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        company_id: companyId || null,
        project_id: projectId || null,
        title: title.trim(),
        is_milestone: isMilestone,
        priority,
        status: "Todo",
        due_date: dueDate || null,
        assigned_to: currentUserId || null,
      })
      .select("*, companies(id, name), projects(id, title)")
      .single();

    setIsAddingTask(false);

    if (error || !data) {
      toast.error(`Could not create task: ${error?.message || "Error"}`);
      return;
    }

    setTasks((prev) => [data as TaskWithDetails, ...prev]);
    setTitle("");
    setDueDate("");
    setIsMilestone(false);
    toast.success("Task added");
    router.refresh();
  }

  function openEditTaskModal(task: TaskWithDetails) {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditCompanyId(task.company_id ?? "");
    setEditProjectId(task.project_id ?? "");
    setEditPriority(task.priority as TaskPriority);
    setEditStatus(task.status as TaskStatus);
    setEditDueDate(task.due_date ?? "");
    setEditIsMilestone(task.is_milestone);
  }

  async function handleSaveEditedTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingTask || !editTitle.trim()) return;

    setIsSavingEdit(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("tasks")
      .update({
        title: editTitle.trim(),
        company_id: editCompanyId || null,
        project_id: editProjectId || null,
        priority: editPriority,
        status: editStatus,
        due_date: editDueDate || null,
        is_milestone: editIsMilestone,
      })
      .eq("id", editingTask.id)
      .select("*, companies(id, name), projects(id, title)")
      .single();

    setIsSavingEdit(false);

    if (error || !data) {
      toast.error(`Could not update task: ${error?.message || "Error"}`);
      return;
    }

    setTasks((prev) =>
      prev.map((item) =>
        item.id === editingTask.id ? (data as TaskWithDetails) : item
      )
    );
    toast.success("Task updated");
    setEditingTask(null);
    router.refresh();
  }

  async function handleUpdateTaskStatus(
    task: TaskWithDetails,
    nextStatus: TaskStatus
  ) {
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

  async function handleLogActivity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!actSummary.trim()) return;

    setIsLoggingAct(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("activities")
      .insert({
        company_id: actCompanyId || null,
        type: actType,
        summary: actSummary.trim(),
        file_url: actFileUrl.trim() || null,
        created_by: currentUserId || null,
      })
      .select("*, companies(id, name), projects(id, title)")
      .single();

    setIsLoggingAct(false);

    if (error || !data) {
      toast.error(`Could not log activity: ${error?.message || "Error"}`);
      return;
    }

    setActivities((prev) => [data as ActivityWithDetails, ...prev]);
    setActSummary("");
    setActFileUrl("");
    toast.success(`${actType} logged to timeline`);
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#084154]">
          Tasks, Milestones & Activity Feed
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage deliverables across all active clients and log calls, meetings, and strategic notes.
        </p>
      </div>

      {/* Quick Add Task Bar */}
      <form
        onSubmit={handleAddTask}
        className="glass-card space-y-3 rounded-2xl p-4"
      >
        <p className="text-xs font-bold uppercase tracking-wider text-[#084154]">
          Quick Add Deliverable or Follow-Up Task
        </p>

        <div className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <Input
              required
              placeholder="What needs to be delivered or followed up?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-white"
            />
          </div>

          <div className="md:col-span-2">
            <select
              aria-label="Client company"
              value={companyId}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800"
            >
              <option value="">No Client</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              aria-label="Project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800"
            >
              <option value="">General Client Task</option>
              {projects
                .filter((p) => !companyId || p.company_id === companyId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    Project: {p.title}
                  </option>
                ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              aria-label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800"
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p} Priority
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <Button
              type="submit"
              disabled={isAddingTask}
              className="brand-gradient h-9 w-full rounded-lg text-xs font-semibold text-white"
            >
              <Plus className="mr-1 h-3.5 w-3.5 text-[#ffbf00]" />
              Add Task
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Due Date:</span>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-8 w-40 bg-white text-xs"
            />
          </div>

          <label className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-[#084154]">
            <input
              type="checkbox"
              checked={isMilestone}
              onChange={(e) => setIsMilestone(e.target.checked)}
              className="accent-[#084154]"
            />
            Key Milestone
          </label>
        </div>
      </form>

      {/* Main Split: Tasks Checklist (Left 7 cols) + Activity Log (Right 5 cols) */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="glass-card space-y-3 rounded-2xl p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search tasks, milestones, or clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 bg-white pl-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {["Open", "All", ...TASK_STATUSES].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      statusFilter === st
                        ? "bg-[#084154] text-white"
                        : "bg-white text-slate-600 border border-slate-200"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[#084154]">
                <input
                  type="checkbox"
                  checked={milestonesOnly}
                  onChange={(e) => setMilestonesOnly(e.target.checked)}
                  className="accent-[#084154]"
                />
                Milestones Only
              </label>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center text-xs text-slate-500">
              No tasks match the selected filter.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTasks.map((task) => {
                const isDone = task.status === "Done";

                return (
                  <div
                    key={task.id}
                    className="glass-card flex items-center justify-between gap-3 rounded-2xl p-4"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateTaskStatus(
                            task,
                            isDone ? "Todo" : "Done"
                          )
                        }
                        className="mt-0.5 text-[#4b8f9a] hover:text-[#084154]"
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </button>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={`text-sm font-bold ${
                              isDone
                                ? "line-through text-slate-400"
                                : "text-[#084154]"
                            }`}
                          >
                            {task.title}
                          </p>

                          {task.is_milestone && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#ffbf00]/25 px-2 py-0.5 text-[10px] font-bold text-[#084154]">
                              <Award className="h-3 w-3" />
                              Milestone
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          {task.companies && (
                            <Link
                              href={`/companies/${task.companies.id}`}
                              className="inline-flex items-center gap-1 font-medium text-[#4b8f9a] hover:underline"
                            >
                              <Building2 className="h-3 w-3" />
                              {task.companies.name}
                            </Link>
                          )}

                          {task.projects ? (
                            <Link
                              href="/projects"
                              className="inline-flex items-center gap-1 hover:text-[#084154]"
                            >
                              <FolderKanban className="h-3 w-3" />
                              {task.projects.title}
                            </Link>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              General Client Task
                            </span>
                          )}

                          {task.due_date && (
                            <span className="text-amber-700">
                              Due {task.due_date}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <select
                        aria-label={`Status for ${task.title}`}
                        value={task.status}
                        onChange={(e) =>
                          handleUpdateTaskStatus(
                            task,
                            e.target.value as TaskStatus
                          )
                        }
                        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-[#084154]"
                      >
                        {TASK_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        aria-label="Edit task"
                        onClick={() => openEditTaskModal(task)}
                        className="p-1 text-slate-400 hover:text-[#084154]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        aria-label="Delete task"
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Client & Project Activity Log Column */}
        <div className="space-y-4 lg:col-span-5">
          <div className="glass-card space-y-3 rounded-2xl p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#084154]">
              <MessageSquarePlus className="h-4 w-4 text-[#4b8f9a]" />
              Client Activity & Meeting Log
            </h2>

            <form onSubmit={handleLogActivity} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="Activity type"
                  value={actType}
                  onChange={(e) => setActType(e.target.value as ActivityType)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-[#084154]"
                >
                  {ACTIVITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Client company for activity"
                  value={actCompanyId}
                  onChange={(e) => setActCompanyId(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-[#084154]"
                >
                  <option value="">General Note</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                required
                placeholder="Summary of client call, meeting, or file..."
                value={actSummary}
                onChange={(e) => setActSummary(e.target.value)}
                className="bg-white text-xs"
              />

              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="Attachment link (optional)"
                  value={actFileUrl}
                  onChange={(e) => setActFileUrl(e.target.value)}
                  className="bg-white text-xs"
                />
                <Button
                  type="submit"
                  disabled={isLoggingAct}
                  className="h-9 shrink-0 bg-[#084154] px-3.5 text-xs font-semibold text-white hover:bg-[#4b8f9a]"
                >
                  Log
                </Button>
              </div>
            </form>
          </div>

          <div className="space-y-2.5">
            {activities.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center text-xs text-slate-400">
                No activity entries logged yet.
              </div>
            ) : (
              activities.map((act) => (
                <div
                  key={act.id}
                  className="glass-card rounded-2xl p-3.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-bold text-[#084154]">
                      {act.type === "Call" && (
                        <PhoneCall className="h-3.5 w-3.5 text-sky-600" />
                      )}
                      {act.type === "Meeting" && (
                        <Users className="h-3.5 w-3.5 text-amber-600" />
                      )}
                      {act.type === "File" && (
                        <FileText className="h-3.5 w-3.5 text-emerald-600" />
                      )}
                      {act.type === "Note" && (
                        <StickyNote className="h-3.5 w-3.5 text-[#4b8f9a]" />
                      )}
                      {act.type}
                      {act.companies && (
                        <span className="font-semibold text-[#4b8f9a]">
                          · {act.companies.name}
                        </span>
                      )}
                    </span>

                    <div className="flex items-center gap-2">
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

                  <p className="mt-1.5 text-slate-700">{act.summary}</p>

                  {act.file_url && (
                    <a
                      href={act.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 font-semibold text-[#4b8f9a] hover:underline"
                    >
                      Open Link
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Edit Task Modal */}
      <Dialog
        open={Boolean(editingTask)}
        onOpenChange={(open) => !open && setEditingTask(null)}
      >
        <DialogContent className="sm:max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#084154]">Edit Task</DialogTitle>
            <DialogDescription>
              Update task details, client/project link, priority, or due date.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEditedTask} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-task-title">Task Title *</Label>
              <Input
                id="edit-task-title"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-task-comp">Client Company</Label>
                <select
                  id="edit-task-comp"
                  value={editCompanyId}
                  onChange={(e) => {
                    setEditCompanyId(e.target.value);
                    setEditProjectId("");
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">No Client</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-task-proj">Linked Project</Label>
                <select
                  id="edit-task-proj"
                  value={editProjectId}
                  onChange={(e) => setEditProjectId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">General Client Task</option>
                  {projects
                    .filter(
                      (p) => !editCompanyId || p.company_id === editCompanyId
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-task-prio">Priority</Label>
                <select
                  id="edit-task-prio"
                  value={editPriority}
                  onChange={(e) =>
                    setEditPriority(e.target.value as TaskPriority)
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-task-status">Status</Label>
                <select
                  id="edit-task-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  {TASK_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-task-due">Due Date</Label>
                <Input
                  id="edit-task-due"
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
              </div>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#084154]">
              <input
                type="checkbox"
                checked={editIsMilestone}
                onChange={(e) => setEditIsMilestone(e.target.checked)}
                className="accent-[#084154]"
              />
              Key Milestone
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingTask(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingEdit}
                className="brand-gradient font-semibold text-white"
              >
                {isSavingEdit ? "Saving..." : "Save Task"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}