import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { CalendarIcon, X, Pencil, Save, XCircle } from "lucide-react";
import { useTask, useUpdateTask, useUpdateTaskAssignees, useUsers } from "@/hooks/useTasks";
import {
  TaskStatus,
  TaskPriority,
  STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
} from "@/types/tasks";
import { cn } from "@/lib/utils";

const updateTaskSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(120, "Title must be less than 120 characters"),
  description: z.string().optional(),
});

type FormData = z.infer<typeof updateTaskSchema>;

interface TaskDetailsDrawerProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TaskDetailsDrawer = ({ taskId, open, onOpenChange }: TaskDetailsDrawerProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

  const { data: task, isLoading } = useTask(taskId || undefined);
  const { data: users = [] } = useUsers();
  const updateTask = useUpdateTask();
  const updateAssignees = useUpdateTaskAssignees();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(updateTaskSchema),
  });

  // Initialize form when task loads
  const initializeForm = () => {
    if (task) {
      reset({
        title: task.title,
        description: task.description || "",
      });
      setDueDate(task.due_date ? new Date(task.due_date) : undefined);
      setTags(task.tags || []);
      setSelectedAssignees(task.assignees?.map(a => a.user_id) || []);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!taskId) return;

    await updateTask.mutateAsync({
      taskId,
      input: {
        title: data.title,
        description: data.description || null,
        due_date: dueDate?.toISOString() || null,
        tags,
      },
    });

    await updateAssignees.mutateAsync({
      taskId,
      assigneeIds: selectedAssignees,
    });

    setIsEditing(false);
  };

  const handleStatusChange = async (status: TaskStatus) => {
    if (!taskId) return;
    await updateTask.mutateAsync({ taskId, input: { status } });
  };

  const handlePriorityChange = async (priority: TaskPriority) => {
    if (!taskId) return;
    await updateTask.mutateAsync({ taskId, input: { priority } });
  };

  const addTag = () => {
    if (tagInput.trim() && tags.length < 6 && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const toggleAssignee = (userId: string) => {
    setSelectedAssignees(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleClose = () => {
    setIsEditing(false);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4 pt-6">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : task ? (
          <>
            <SheetHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-left">Task Details</SheetTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (isEditing) {
                      setIsEditing(false);
                      initializeForm();
                    } else {
                      initializeForm();
                      setIsEditing(true);
                    }
                  }}
                >
                  {isEditing ? (
                    <>
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </>
                  )}
                </Button>
              </div>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {isEditing ? (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      {...register("title")}
                      className={errors.title ? "border-destructive" : ""}
                    />
                    {errors.title && (
                      <p className="text-sm text-destructive">{errors.title.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      {...register("description")}
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dueDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dueDate ? format(dueDate, "PPP") : "Select due date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dueDate}
                          onSelect={setDueDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Assignees</Label>
                    <ScrollArea className="h-32 border rounded-md p-2">
                      {users.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center space-x-2 py-1"
                        >
                          <Checkbox
                            id={`edit-${user.id}`}
                            checked={selectedAssignees.includes(user.id)}
                            onCheckedChange={() => toggleAssignee(user.id)}
                          />
                          <label
                            htmlFor={`edit-${user.id}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {user.full_name}
                          </label>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>

                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <div className="flex gap-2">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder="Add a tag"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTag();
                          }
                        }}
                        disabled={tags.length >= 6}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addTag}
                        disabled={tags.length >= 6}
                      >
                        Add
                      </Button>
                    </div>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {tags.map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={updateTask.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {updateTask.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              ) : (
                <>
                  <div>
                    <h2 className="text-xl font-semibold">{task.title}</h2>
                    {task.description && (
                      <p className="mt-2 text-muted-foreground">{task.description}</p>
                    )}
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={task.status} onValueChange={handleStatusChange}>
                        <SelectTrigger className={cn(STATUS_COLORS[task.status])}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={task.priority} onValueChange={handlePriorityChange}>
                        <SelectTrigger className={cn(PRIORITY_COLORS[task.priority])}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <p className="text-sm">
                      {task.due_date ? format(new Date(task.due_date), "PPP") : "No due date"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Assignees</Label>
                    {task.assignees && task.assignees.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {task.assignees.map((assignee) => (
                          <div key={assignee.id} className="flex items-center gap-2 bg-muted rounded-full px-3 py-1">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-xs">
                                {getInitials(assignee.user?.full_name || "?")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{assignee.user?.full_name}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Unassigned</p>
                    )}
                  </div>

                  {task.tags && task.tags.length > 0 && (
                    <div className="space-y-2">
                      <Label>Tags</Label>
                      <div className="flex flex-wrap gap-1">
                        {task.tags.map((tag) => (
                          <Badge key={tag} variant="outline">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      <strong>Created by:</strong> {task.creator?.full_name || "Unknown"} on{" "}
                      {format(new Date(task.created_at), "PPP 'at' p")}
                    </p>
                    <p>
                      <strong>Last updated:</strong> {format(new Date(task.updated_at), "PPP 'at' p")}
                    </p>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Task not found</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default TaskDetailsDrawer;
