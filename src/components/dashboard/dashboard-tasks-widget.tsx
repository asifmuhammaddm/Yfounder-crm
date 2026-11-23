"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  Award,
  Building2,
  FolderKanban,
  ArrowRight,
  ListTodo,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { TaskWithDetails } from "@/types/crm";

interface DashboardTasksWidgetProps {
  initialTasks: TaskWithDetails[];
}

export function DashboardTasksWidget({
  initialTasks,
}: DashboardTasksWidgetProps) {
  const [tasks, setTasks] = useState<TaskWithDetails[]>(initialTasks);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function fetchLatestOpenTasks() {
      const { data } = await supabase
        .from("tasks")
        .select("*, companies(id, name), projects(id, title)")
        .neq("status", "Done")
        .order("created_at", { ascending: false })
        .limit(6);

      if (isMounted && data) {
        setTasks(data as TaskWithDetails[]);
      }
    }

    fetchLatestOpenTasks();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleCompleteTask(task: TaskWithDetails) {
    const supabase = createClient();
    const { error } = await supabase
      .from("tasks")
      .update({ status: "Done" })
      .eq("id", task.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setTasks((prev) => prev.filter((item) => item.id !== task.id));
    toast.success(`Completed "${task.title}"`);
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <div className="brand-gradient-subtle flex h-9 w-9 items-center justify-center rounded-xl text-[#084154]">
            <ListTodo className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#084154]">
              Open Tasks & Key Milestones ({tasks.length})
            </h2>
            <p className="text-xs text-slate-500">
              Active deliverables and client follow-ups across your consulting portfolio.
            </p>
          </div>
        </div>

        <Link
          href="/tasks"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4b8f9a] hover:text-[#084154]"
        >
          Manage All Tasks
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {tasks.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-5 text-center text-xs text-slate-500">
          All tasks are caught up! Add a deliverable or milestone in{" "}
          <Link
            href="/tasks"
            className="font-semibold text-[#084154] underline"
          >
            Tasks & Follow-Ups
          </Link>
          .
        </p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/85 p-3.5"
            >
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  title="Mark task done"
                  onClick={() => handleCompleteTask(task)}
                  className="mt-0.5 text-[#4b8f9a] hover:text-emerald-600"
                >
                  <Circle className="h-4 w-4" />
                </button>

                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-xs font-bold text-[#084154]">
                      {task.title}
                    </p>
                    {task.is_milestone && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-[#ffbf00]/25 px-2 py-0.5 text-[10px] font-bold text-[#084154]">
                        <Award className="h-2.5 w-2.5" />
                        Milestone
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2.5 text-[11px] text-slate-500">
                    {task.companies && (
                      <Link
                        href={`/companies/${task.companies.id}`}
                        className="inline-flex items-center gap-1 font-semibold text-[#4b8f9a] hover:underline"
                      >
                        <Building2 className="h-3 w-3" />
                        {task.companies.name}
                      </Link>
                    )}

                    {task.projects && (
                      <Link
                        href="/projects"
                        className="inline-flex items-center gap-1 hover:text-[#084154]"
                      >
                        <FolderKanban className="h-3 w-3" />
                        {task.projects.title}
                      </Link>
                    )}

                    {task.due_date && (
                      <span className="text-amber-700">
                        Due {task.due_date}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {task.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}