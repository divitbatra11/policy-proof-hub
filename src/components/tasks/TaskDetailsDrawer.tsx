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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import {
  CalendarIcon,
  X,
  Pencil,
  Save,
  XCircle,
  ExternalLink,
  ChevronDown,
  MoreHorizontal,
  Copy,
  Trash2,
  Link2,
  Plus,
} from "lucide-react";
import { useTask, useUpdateTask, useUpdateTaskAssignees, useUsers } from "@/hooks/useTasks";
import { useAddTaskChecklistItem, useDeleteTaskChecklistItem, useTaskChecklist, useToggleTaskChecklistItem } from "@/hooks/useTaskChecklist";
import {
  deleteTaskAttachment,
  getTaskAttachmentUrl,
  isExternalAttachmentUrl,
  normalizeExternalUrl,
  uploadTaskAttachment,
} from "@/utils/taskAttachments";
import { supabase } from "@/integrations/supabase/client";

import {
  TaskStatus,
  TaskChecklistItem,
  TaskPriority,
  STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
} from "@/types/tasks";
import { cn } from "@/lib/utils";
import { TaskAttachmentIcon } from "./TaskAttachmentIcon";

const updateTaskSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(120, "Title must be less than 120 characters"),
  description: z.string().optional(),
});

type FormData = z.infer<typeof updateTaskSchema>;

type AttachmentMode = "file" | "link";

interface TaskDetailsDrawerProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const deriveNameFromUrl = (url: string) => {
  try {
    const withoutQuery = url.split("?")[0].split("#")[0];
    const last = withoutQuery.split("/").pop() || "Attachment";
    const decoded = decodeURIComponent(last);
    return decoded || "Attachment";
  } catch {
    return "Attachment";
  }
};

const TaskDetailsDrawer = ({ taskId, open, onOpenChange }: TaskDetailsDrawerProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

  const [attachmentsOpen, setAttachmentsOpen] = useState(true);
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [attachmentMode, setAttachmentMode] = useState<AttachmentMode>("file");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string>("");
  const [attachmentDisplayName, setAttachmentDisplayName] = useState<string>("");
  const [removeAttachment, setRemoveAttachment] = useState(false);

  const { data: task, isLoading } = useTask(taskId || undefined);
  const { data: checklistItems = [], isLoading: checklistLoading } = useTaskChecklist(taskId || undefined);
  const addChecklistItem = useAddTaskChecklistItem();
  const toggleChecklistItem = useToggleTaskChecklistItem();
  const deleteChecklistItem = useDeleteTaskChecklistItem();
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
    if (!task) return;

    reset({
      title: task.title,
      description: task.description || "",
    });

    setDueDate(task.due_date ? new Date(task.due_date) : undefined);
    setTags(task.tags || []);
    setSelectedAssignees(task.assignees?.map((a) => a.user_id) || []);

    setAttachmentFile(null);
    setRemoveAttachment(false);

    if (task.attachment_path && isExternalAttachmentUrl(task.attachment_path)) {
      setAttachmentMode("link");
      setAttachmentUrl(task.attachment_path);
      setAttachmentDisplayName(task.attachment_name || "");
    } else {
      setAttachmentMode("file");
      setAttachmentUrl("");
      setAttachmentDisplayName("");
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!taskId || !task) return;

    let attachmentPath = task.attachment_path ?? null;
    let attachmentName = task.attachment_name ?? null;

    const previousAttachmentPath = attachmentPath;
    const previousWasExternal = !!previousAttachmentPath && isExternalAttachmentUrl(previousAttachmentPath);

    // Explicit remove
    if (removeAttachment && attachmentPath) {
      await deleteTaskAttachment(attachmentPath);
      attachmentPath = null;
      attachmentName = null;
    }

    // Upload a new file
    if (attachmentFile) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { filePath, fileName } = await uploadTaskAttachment({
        file: attachmentFile,
        taskId,
        userId: user.id,
      });

      // If switching from an existing stored file to a new stored file, delete old storage object.
      if (previousAttachmentPath && !previousWasExternal && previousAttachmentPath !== filePath) {
        await deleteTaskAttachment(previousAttachmentPath);
      }

      attachmentPath = filePath;
      attachmentName = fileName;
    }

    // Save a link
    const normalizedUrl = attachmentMode === "link" ? normalizeExternalUrl(attachmentUrl) : "";
    if (!attachmentFile && !removeAttachment && attachmentMode === "link" && normalizedUrl) {
      // If switching away from a stored file to a link, delete the old stored file.
      if (previousAttachmentPath && !previousWasExternal && previousAttachmentPath !== normalizedUrl) {
        await deleteTaskAttachment(previousAttachmentPath);
      }

      attachmentPath = normalizedUrl;
      attachmentName = attachmentDisplayName.trim() || deriveNameFromUrl(normalizedUrl);
    }

    await updateTask.mutateAsync({
      taskId,
      input: {
        title: data.title,
        description: data.description || null,
        due_date: dueDate?.toISOString() || null,
        tags,
        attachment_name: attachmentName,
        attachment_path: attachmentPath,
      },
    });

    await updateAssignees.mutateAsync({
      taskId,
      assigneeIds: selectedAssignees,
    });

    setIsEditing(false);
  };

  const openAttachment = async () => {
    if (!task?.attachment_path) return;
    const url = await getTaskAttachmentUrl(task.attachment_path);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyAttachmentLink = async () => {
    if (!task?.attachment_path) return;
    const url = await getTaskAttachmentUrl(task.attachment_path);
    await navigator.clipboard.writeText(url);
  };

  const removeAttachmentNow = async () => {
    if (!taskId || !task?.attachment_path) return;

    // Delete from storage only if needed (utility handles external links as no-op)
    await deleteTaskAttachment(task.attachment_path);

    await updateTask.mutateAsync({
      taskId,
      input: { attachment_name: null, attachment_path: null },
    });

    setAttachmentFile(null);
    setAttachmentUrl("");
    setAttachmentDisplayName("");
    setRemoveAttachment(false);
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
    setTags(tags.filter((t) => t !== tag));
  };

  const toggleAssignee = (userId: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleClose = () => {
    setIsEditing(false);
    onOpenChange(false);
  };

  const pendingLinkUrl = attachmentMode === "link" ? normalizeExternalUrl(attachmentUrl) : "";
  const pendingLinkName = attachmentDisplayName.trim() || (pendingLinkUrl ? deriveNameFromUrl(pendingLinkUrl) : "");

  const completedChecklistCount = checklistItems.filter((i) => i.is_completed).length;
  const totalChecklistCount = checklistItems.length;

  const handleAddChecklistItem = async () => {
    if (!taskId) return;
    const text = newChecklistText.trim();
    if (!text) return;
    await addChecklistItem.mutateAsync({ taskId, text });
    setNewChecklistText("");
  };

  const handleToggleChecklistItem = async (item: TaskChecklistItem, checked: boolean) => {
    if (!taskId) return;
    await toggleChecklistItem.mutateAsync({
      taskId,
      itemId: item.id,
      isCompleted: checked,
    });
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    if (!taskId) return;
    await deleteChecklistItem.mutateAsync({ taskId, itemId });
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
                    <Textarea id="description" {...register("description")} rows={4} />
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
                        <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Assignees</Label>
                    <ScrollArea className="h-32 border rounded-md p-2">
                      {users.map((user) => (
                        <div key={user.id} className="flex items-center space-x-2 py-1">
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
                      <Button type="button" variant="outline" onClick={addTag} disabled={tags.length >= 6}>
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

                  {/* Attachments */}
                  <div className="space-y-2">
                    <Label>Attachments</Label>

                    {(task.attachment_path && task.attachment_name && !removeAttachment && !attachmentFile) && (
                      <div className="rounded-md border bg-muted/20 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            className="flex items-start gap-3 text-left min-w-0 flex-1"
                            onClick={openAttachment}
                          >
                            <TaskAttachmentIcon
                              name={task.attachment_name}
                              path={task.attachment_path}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                {task.attachment_name}
                              </div>
                              {isExternalAttachmentUrl(task.attachment_path) && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {task.attachment_path}
                                </div>
                              )}
                            </div>
                          </button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setRemoveAttachment(true)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={attachmentMode === "file" ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setAttachmentMode("file");
                          setAttachmentUrl("");
                          setAttachmentDisplayName("");
                          setRemoveAttachment(false);
                        }}
                      >
                        Upload file
                      </Button>
                      <Button
                        type="button"
                        variant={attachmentMode === "link" ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setAttachmentMode("link");
                          setAttachmentFile(null);
                          setRemoveAttachment(false);
                        }}
                      >
                        Add link
                      </Button>
                    </div>

                    {attachmentMode === "file" ? (
                      <Input
                        id="attachment"
                        type="file"
                        onChange={(e) => {
                          setAttachmentFile(e.target.files?.[0] ?? null);
                          if (e.target.files?.[0]) {
                            setRemoveAttachment(false);
                            setAttachmentUrl("");
                            setAttachmentDisplayName("");
                          }
                        }}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg"
                      />
                    ) : (
                      <div className="space-y-2">
                        <Input
                          value={attachmentDisplayName}
                          onChange={(e) => setAttachmentDisplayName(e.target.value)}
                          placeholder="Display name (e.g., DRAFT_Duress Alarm Policy)"
                        />
                        <div className="relative">
                          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={attachmentUrl}
                            onChange={(e) => setAttachmentUrl(e.target.value)}
                            placeholder="https://..."
                            className="pl-9"
                          />
                        </div>
                      </div>
                    )}

                    {attachmentFile && (
                      <div className="rounded-md border bg-muted/20 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <TaskAttachmentIcon name={attachmentFile.name} path={null} />
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{attachmentFile.name}</div>
                              <div className="text-xs text-muted-foreground">(upload)</div>
                            </div>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setAttachmentFile(null)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    )}

                    {!attachmentFile && attachmentMode === "link" && pendingLinkUrl && (
                      <div className="rounded-md border bg-muted/20 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <TaskAttachmentIcon name={pendingLinkName} path={pendingLinkUrl} />
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{pendingLinkName}</div>
                              <div className="text-xs text-muted-foreground truncate">{pendingLinkUrl}</div>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAttachmentUrl("");
                              setAttachmentDisplayName("");
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                 <Collapsible open={checklistOpen} onOpenChange={setChecklistOpen}>
      <div className="flex items-center justify-between">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex items-center gap-2 text-sm font-medium">
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                !checklistOpen && "-rotate-90"
              )}
            />
            Checklist
          </button>
        </CollapsibleTrigger>

        <Badge variant="secondary" className="text-xs h-5 px-1.5">
          {totalChecklistCount === 0 ? "0" : `${completedChecklistCount}/${totalChecklistCount}`}
        </Badge>
      </div>

      <CollapsibleContent className="mt-2 space-y-2">
        {checklistLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : totalChecklistCount === 0 ? (
          <p className="text-sm text-muted-foreground">No checklist items</p>
        ) : (
          <div className="space-y-2">
            {checklistItems.map((item) => (
              <div key={item.id} className="flex items-start gap-2">
                <Checkbox
                  checked={item.is_completed}
                  onCheckedChange={(checked) =>
                    handleToggleChecklistItem(item, !!checked)
                  }
                />
                <span
                  className={cn(
                    "text-sm flex-1 leading-snug",
                    item.is_completed && "line-through text-muted-foreground"
                  )}
                >
                  {item.item_text}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDeleteChecklistItem(item.id)}
                  title="Remove item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Input
            value={newChecklistText}
            onChange={(e) => setNewChecklistText(e.target.value)}
            placeholder="Add checklist item"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddChecklistItem();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddChecklistItem}
            disabled={!newChecklistText.trim() || addChecklistItem.isPending}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>

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
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
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
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
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
                          <div
                            key={assignee.id}
                            className="flex items-center gap-2 bg-muted rounded-full px-3 py-1"
                          >
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
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attachments section */}
                  <Collapsible open={attachmentsOpen} onOpenChange={setAttachmentsOpen}>
                    <div className="flex items-center justify-between">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-2 text-sm font-medium"
                        >
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              !attachmentsOpen && "-rotate-90"
                            )}
                          />
                          Attachments
                        </button>
                      </CollapsibleTrigger>

                      {task.attachment_path && task.attachment_name && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={openAttachment}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={copyAttachmentLink}>
                              <Copy className="mr-2 h-4 w-4" />
                              Copy link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={removeAttachmentNow}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    <CollapsibleContent className="mt-2 space-y-2">
                      {task.attachment_path && task.attachment_name ? (
                        <div className="rounded-md border bg-muted/20 p-3">
                          <button
                            type="button"
                            onClick={openAttachment}
                            className="flex items-start gap-3 text-left w-full"
                          >
                            <TaskAttachmentIcon
                              name={task.attachment_name}
                              path={task.attachment_path}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">
                                {task.attachment_name}
                              </div>
                              {isExternalAttachmentUrl(task.attachment_path) && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {task.attachment_path}
                                </div>
                              )}
                            </div>
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No attachments</p>
                      )}

                      {/* Word-like behavior: user can add attachments by clicking Edit */}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          initializeForm();
                          setIsEditing(true);
                        }}
                      >
                        Add attachment
                      </Button>
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible open={checklistOpen} onOpenChange={setChecklistOpen}>
                    <div className="flex items-center justify-between">
                      <CollapsibleTrigger asChild>
                        <button type="button" className="flex items-center gap-2 text-sm font-medium">
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              !checklistOpen && "-rotate-90"
                            )}
                          />
                          Checklist
                        </button>
                      </CollapsibleTrigger>

                      <Badge variant="secondary" className="text-xs h-5 px-1.5">
                        {totalChecklistCount === 0 ? "0" : `${completedChecklistCount}/${totalChecklistCount}`}
                      </Badge>
                    </div>

                    <CollapsibleContent className="mt-2 space-y-2">
                      {checklistLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-5/6" />
                        </div>
                      ) : totalChecklistCount === 0 ? (
                        <p className="text-sm text-muted-foreground">No checklist items</p>
                      ) : (
                        <div className="space-y-2">
                          {checklistItems.map((item) => (
                            <div key={item.id} className="flex items-start gap-2">
                              <Checkbox
                                checked={item.is_completed}
                                onCheckedChange={(checked) =>
                                  handleToggleChecklistItem(item, !!checked)
                                }
                              />
                              <span
                                className={cn(
                                  "text-sm flex-1 leading-snug",
                                  item.is_completed && "line-through text-muted-foreground"
                                )}
                              >
                                {item.item_text}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleDeleteChecklistItem(item.id)}
                                title="Remove item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <Input
                          value={newChecklistText}
                          onChange={(e) => setNewChecklistText(e.target.value)}
                          placeholder="Add checklist item"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddChecklistItem();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleAddChecklistItem}
                          disabled={!newChecklistText.trim() || addChecklistItem.isPending}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

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