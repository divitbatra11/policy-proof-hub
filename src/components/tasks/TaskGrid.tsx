import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Filter,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { useTasks, useUpdateTask, useDeleteTask, useUsers, useUpdateTaskAssignees } from "@/hooks/useTasks";
import {
  Task,
  TaskFilters,
  TaskSort,
  TaskStatus,
  TaskPriority,
  STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
} from "@/types/tasks";
import TaskDetailsDrawer from "./TaskDetailsDrawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const TaskGrid = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<TaskFilters>({
    search: searchParams.get("search") || "",
    status: (searchParams.get("status") as TaskStatus | "all") || "all",
    priority: (searchParams.get("priority") as TaskPriority | "all") || "all",
    assignee: searchParams.get("assignee") || undefined,
    overdue: searchParams.get("overdue") === "true",
  });
  const [sort, setSort] = useState<TaskSort>({
    field: (searchParams.get("sortField") as TaskSort["field"]) || "created_at",
    direction: (searchParams.get("sortDir") as TaskSort["direction"]) || "desc",
  });
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  const { data, isLoading, error } = useTasks({ filters, sort, page });
  const { data: users = [] } = useUsers();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const updateAssignees = useUpdateTaskAssignees();

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status && filters.status !== "all") params.set("status", filters.status);
    if (filters.priority && filters.priority !== "all") params.set("priority", filters.priority);
    if (filters.assignee) params.set("assignee", filters.assignee);
    if (filters.overdue) params.set("overdue", "true");
    if (sort.field !== "created_at") params.set("sortField", sort.field);
    if (sort.direction !== "desc") params.set("sortDir", sort.direction);
    if (page > 1) params.set("page", String(page));
    setSearchParams(params, { replace: true });
  }, [filters, sort, page, setSearchParams]);

  const handleSort = (field: TaskSort["field"]) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    await updateTask.mutateAsync({ taskId, input: { status } });
  };

  const handlePriorityChange = async (taskId: string, priority: TaskPriority) => {
    await updateTask.mutateAsync({ taskId, input: { priority } });
  };

  const handleDueDateChange = async (taskId: string, date: Date | undefined) => {
    await updateTask.mutateAsync({
      taskId,
      input: { due_date: date?.toISOString() || null },
    });
  };

  const handleAssigneesChange = async (taskId: string, assigneeIds: string[]) => {
    await updateAssignees.mutateAsync({ taskId, assigneeIds });
  };

  const handleDelete = async () => {
    if (deleteTaskId) {
      await deleteTask.mutateAsync(deleteTaskId);
      setDeleteTaskId(null);
    }
  };

  const handleComplete = async (taskId: string) => {
    await updateTask.mutateAsync({ taskId, input: { status: "completed" } });
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const isOverdue = (dueDate: string | null, status: TaskStatus) => {
    if (!dueDate || status === "completed") return false;
    const date = new Date(dueDate);
    return isPast(date) && !isToday(date);
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Failed to load tasks. Please try again.</p>
        <Button variant="outline" onClick={() => window.location.reload()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="pl-9"
          />
        </div>

        <Select
          value={filters.status || "all"}
          onValueChange={(value) => setFilters(prev => ({ ...prev, status: value as TaskStatus | "all" }))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.priority || "all"}
          onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value as TaskPriority | "all" }))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.assignee || "all"}
          onValueChange={(value) => setFilters(prev => ({ ...prev, assignee: value === "all" ? undefined : value }))}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>{user.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Checkbox
            id="overdue"
            checked={filters.overdue}
            onCheckedChange={(checked) => setFilters(prev => ({ ...prev, overdue: !!checked }))}
          />
          <label htmlFor="overdue" className="text-sm cursor-pointer">
            Overdue only
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">
                <Button variant="ghost" size="sm" onClick={() => handleSort("title")} className="-ml-3">
                  Task Title
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort("status")} className="-ml-3">
                  Status
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort("priority")} className="-ml-3">
                  Priority
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort("due_date")} className="-ml-3">
                  Due Date
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>Created By</TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort("created_at")} className="-ml-3">
                  Created
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="w-[60px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(9)].map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <p className="text-muted-foreground">No tasks yet—create your first task</p>
                </TableCell>
              </TableRow>
            ) : (
              data?.tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <button
                      onClick={() => setSelectedTaskId(task.id)}
                      className="text-left font-medium hover:text-primary hover:underline"
                    >
                      {task.title}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={task.status}
                      onValueChange={(value: TaskStatus) => handleStatusChange(task.id, value)}
                    >
                      <SelectTrigger className={cn("w-[130px] h-8", STATUS_COLORS[task.status])}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={task.priority}
                      onValueChange={(value: TaskPriority) => handlePriorityChange(task.id, value)}
                    >
                      <SelectTrigger className={cn("w-[100px] h-8", PRIORITY_COLORS[task.priority])}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <AssigneeSelector
                      task={task}
                      users={users}
                      onAssigneesChange={handleAssigneesChange}
                      getInitials={getInitials}
                    />
                  </TableCell>
                  <TableCell>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-8 px-2",
                            isOverdue(task.due_date, task.status) && "text-destructive"
                          )}
                        >
                          {task.due_date ? format(new Date(task.due_date), "MMM d, yyyy") : "—"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={task.due_date ? new Date(task.due_date) : undefined}
                          onSelect={(date) => handleDueDateChange(task.id, date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {task.creator?.full_name || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(task.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {task.tags?.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {(task.tags?.length || 0) > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{(task.tags?.length || 0) - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedTaskId(task.id)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        {task.status !== "completed" && (
                          <DropdownMenuItem onClick={() => handleComplete(task.id)}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Complete
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setDeleteTaskId(task.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * data.pageSize + 1} to {Math.min(page * data.pageSize, data.totalCount)} of {data.totalCount} tasks
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Task Details Drawer */}
      <TaskDetailsDrawer
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTaskId} onOpenChange={(open) => !open && setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Assignee selector component
const AssigneeSelector = ({
  task,
  users,
  onAssigneesChange,
  getInitials,
}: {
  task: Task;
  users: { id: string; full_name: string; email: string }[];
  onAssigneesChange: (taskId: string, assigneeIds: string[]) => void;
  getInitials: (name: string) => string;
}) => {
  const [open, setOpen] = useState(false);
  const currentAssigneeIds = task.assignees?.map(a => a.user_id) || [];

  const toggleAssignee = (userId: string) => {
    const newIds = currentAssigneeIds.includes(userId)
      ? currentAssigneeIds.filter(id => id !== userId)
      : [...currentAssigneeIds, userId];
    onAssigneesChange(task.id, newIds);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2 -ml-2">
          {task.assignees && task.assignees.length > 0 ? (
            <div className="flex -space-x-2">
              {task.assignees.slice(0, 3).map((assignee) => (
                <Avatar key={assignee.id} className="h-6 w-6 border-2 border-background">
                  <AvatarFallback className="text-xs">
                    {getInitials(assignee.user?.full_name || "?")}
                  </AvatarFallback>
                </Avatar>
              ))}
              {task.assignees.length > 3 && (
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                  +{task.assignees.length - 3}
                </div>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">Unassigned</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <ScrollArea className="h-48">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer"
              onClick={() => toggleAssignee(user.id)}
            >
              <Checkbox checked={currentAssigneeIds.includes(user.id)} />
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">{getInitials(user.full_name)}</AvatarFallback>
              </Avatar>
              <span className="text-sm truncate">{user.full_name}</span>
            </div>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default TaskGrid;
