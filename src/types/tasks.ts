// Task types and interfaces for the Planner feature

export type TaskStatus = "not_started" | "in_progress" | "completed";
export type TaskPriority = "low" | "medium" | "high";

// Board columns for the Kanban view — order is intentional
export const BOARD_COLUMNS = [
  "ED Approval or Follow UP",
  "Policy Work",
  "PPDU Projects",
  "EPICS Projects",
  "PPDU Tasks & Requests",
  "CMU & MMU Support",
  "Policy Toolkit Teams",
  "General",
  "Pending Assignments",
] as const;

export type BoardColumn = (typeof BOARD_COLUMNS)[number];

export const BOARD_COLUMN_COLORS: Record<string, string> = {
  "ED Approval or Follow UP": "border-red-300 bg-red-50/40",
  "Policy Work": "border-blue-300 bg-blue-50/40",
  "PPDU Projects": "border-purple-300 bg-purple-50/40",
  "EPICS Projects": "border-orange-300 bg-orange-50/40",
  "PPDU Tasks & Requests": "border-pink-300 bg-pink-50/40",
  "CMU & MMU Support": "border-teal-300 bg-teal-50/40",
  "Policy Toolkit Teams": "border-cyan-300 bg-cyan-50/40",
  "General": "border-slate-300 bg-slate-50/40",
  "Pending Assignments": "border-yellow-300 bg-yellow-50/40",
};

export const BOARD_COLUMN_HEADER_COLORS: Record<string, string> = {
  "ED Approval or Follow UP": "bg-red-100 text-red-800",
  "Policy Work": "bg-blue-100 text-blue-800",
  "PPDU Projects": "bg-purple-100 text-purple-800",
  "EPICS Projects": "bg-orange-100 text-orange-800",
  "PPDU Tasks & Requests": "bg-pink-100 text-pink-800",
  "CMU & MMU Support": "bg-teal-100 text-teal-800",
  "Policy Toolkit Teams": "bg-cyan-100 text-cyan-800",
  "General": "bg-slate-100 text-slate-800",
  "Pending Assignments": "bg-yellow-100 text-yellow-800",
};

export interface Task {
  id: string;
  title: string;
  description: string | null;
  attachment_name: string | null;
  attachment_path: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  board_column: string;
  start_date: string | null;
  due_date: string | null;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Joined data
  creator?: {
    id: string;
    full_name: string;
    email: string;
  };
  assignees?: TaskAssignee[];
}

export interface TaskAssignee {
  id: string;
  task_id: string;
  user_id: string;
  assigned_at: string;
  assigned_by: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  item_text: string;
  is_completed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TaskFilters {
  search?: string;
  status?: TaskStatus | "all";
  assignee?: string;
  priority?: TaskPriority | "all";
  overdue?: boolean;
  tag?: string;
}

export interface TaskSort {
  field: "due_date" | "priority" | "status" | "created_at" | "title";
  direction: "asc" | "desc";
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  // Either upload a file OR provide a URL. Both are stored in the same DB columns
  // (attachment_path + attachment_name).
  attachment_file?: File | null;
  attachment_url?: string | null;
  attachment_display_name?: string | null;

  status?: TaskStatus;
  priority?: TaskPriority;
  board_column?: string;
  start_date?: string | null;
  due_date?: string | null;
  tags?: string[];
  assignee_ids?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  attachment_name?: string | null;
  attachment_path?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  board_column?: string;
  due_date?: string | null;
  tags?: string[];
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};