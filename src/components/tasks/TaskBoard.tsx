import { useState, useRef, useEffect } from "react";
import { useTasks, useUpdateTask } from "@/hooks/useTasks";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Task,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  BOARD_COLUMNS,
  BOARD_COLUMN_COLORS,
  BOARD_COLUMN_HEADER_COLORS,
} from "@/types/tasks";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";
import TaskDetailsDrawer from "./TaskDetailsDrawer";

const TaskBoard = () => {
  const { data, isLoading } = useTasks({ page: 1, pageSize: 200 });
  const updateTask = useUpdateTask();

  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const boardContentRef = useRef<HTMLDivElement>(null);
  const topScrollContentRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, column: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(column);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only clear if leaving the column container itself, not a child element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetColumn: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    setDragOverColumn(null);
    setDraggingTaskId(null);

    if (!taskId) return;

    const task = data?.tasks.find((t) => t.id === taskId);
    if (!task || (task.board_column || "General") === targetColumn) return;

    await updateTask.mutateAsync({ taskId, input: { board_column: targetColumn } });
  };

  const handleMainScroll = () => {
    if (mainScrollRef.current && topScrollRef.current) {
      topScrollRef.current.scrollLeft = mainScrollRef.current.scrollLeft;
    }
  };

  const handleTopScroll = () => {
    if (topScrollRef.current && mainScrollRef.current) {
      mainScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  // Sync the width of the board content to the top scrollbar
  useEffect(() => {
    const syncWidth = () => {
      if (boardContentRef.current && topScrollContentRef.current) {
        const width = boardContentRef.current.scrollWidth;
        topScrollContentRef.current.style.width = `${width}px`;
      }
    };

    syncWidth();
    window.addEventListener("resize", syncWidth);
    return () => window.removeEventListener("resize", syncWidth);
  }, [data?.tasks]);

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {BOARD_COLUMNS.slice(0, 4).map((col) => (
          <div key={col} className="w-64 flex-shrink-0 space-y-3">
            <Skeleton className="h-8 rounded-lg" />
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  const tasks = data?.tasks ?? [];

  return (
    <div className="space-y-2">
      {/* Top scrollbar */}
      <div
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className="overflow-x-auto overflow-y-hidden"
        style={{ height: "16px" }}
      >
        <div ref={topScrollContentRef} className="h-full" />
      </div>

      {/* Main board */}
      <div ref={mainScrollRef} onScroll={handleMainScroll} className="overflow-x-auto pb-4">
        <div ref={boardContentRef} className="flex gap-3 min-w-max">
          {BOARD_COLUMNS.map((column) => {
            const columnTasks = tasks.filter((t) => (t.board_column || "General") === column);
            const isDragOver = dragOverColumn === column;

            return (
              <div
                key={column}
                className={cn(
                  "w-64 flex-shrink-0 flex flex-col rounded-xl border-2 transition-colors",
                  BOARD_COLUMN_COLORS[column],
                  isDragOver && "ring-2 ring-primary ring-offset-1"
                )}
                onDragOver={(e) => handleDragOver(e, column)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column)}
              >
                {/* Column header */}
                <div
                  className={cn(
                    "px-3 py-2 rounded-t-lg flex items-center justify-between",
                    BOARD_COLUMN_HEADER_COLORS[column]
                  )}
                >
                  <h3 className="font-semibold text-xs leading-tight">{column}</h3>
                  <Badge variant="secondary" className="text-xs h-5 px-1.5">
                    {columnTasks.length}
                  </Badge>
                </div>

                {/* Drop zone */}
                <div
                  className={cn(
                    "flex-1 space-y-2 p-2 min-h-[420px] rounded-b-lg transition-colors",
                    isDragOver && "bg-primary/5"
                  )}
                >
                  {columnTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-10 select-none">
                      {isDragOver ? "Drop here" : "No tasks"}
                    </p>
                  ) : (
                    columnTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isDragging={draggingTaskId === task.id}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onOpenDetails={setSelectedTaskId}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TaskDetailsDrawer
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => {
          if (!open) setSelectedTaskId(null);
        }}
      />
    </div>
  );
};

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string) => void;
  onDragEnd: () => void;
  onOpenDetails: (taskId: string) => void;
}

const TaskCard = ({ task, isDragging, onDragStart, onDragEnd, onOpenDetails }: TaskCardProps) => (
  <Card
    className={cn(
      "p-2.5 space-y-1.5 cursor-grab active:cursor-grabbing hover:shadow-md",
      "transition-all select-none border",
      isDragging && "opacity-40 scale-95 shadow-lg",
      task.status === "completed" && "opacity-80"
    )}
    draggable
    onDragStart={(e) => onDragStart(e, task.id)}
    onDragEnd={onDragEnd}
    onClick={() => onOpenDetails(task.id)}
  >
    {/* Drag handle + title */}
    <div className="flex items-start gap-1.5">
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
      <h4
        className={cn(
          "font-medium text-xs leading-tight flex-1 line-clamp-2",
          task.status === "completed" && "line-through text-muted-foreground"
        )}
      >
        {task.title}
      </h4>
    </div>

    {task.description && (
      <p
        className={cn(
          "text-xs text-muted-foreground line-clamp-2 pl-5",
          task.status === "completed" && "line-through"
        )}
      >
        {task.description}
      </p>
    )}

    {/* Priority + due date */}
    <div className="flex items-center justify-between pl-5">
      <Badge className={cn("text-xs px-1.5 py-0", PRIORITY_COLORS[task.priority])}>
        {PRIORITY_LABELS[task.priority]}
      </Badge>
      {task.due_date && (
        <span className="text-xs text-muted-foreground">{format(new Date(task.due_date), "MMM d")}</span>
      )}
    </div>

    {/* Tags */}
    {task.tags && task.tags.length > 0 && (
      <div className="flex flex-wrap gap-1 pl-5">
        {task.tags.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="outline" className="text-xs px-1 py-0">
            {tag}
          </Badge>
        ))}
        {task.tags.length > 2 && (
          <Badge variant="outline" className="text-xs px-1 py-0">
            +{task.tags.length - 2}
          </Badge>
        )}
      </div>
    )}

    {/* Assignee avatars */}
    {task.assignees && task.assignees.length > 0 && (
      <div className="flex -space-x-1.5 pl-5">
        {task.assignees.slice(0, 3).map((assignee) => (
          <div
            key={assignee.id}
            className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center border border-background"
            title={assignee.user?.full_name}
          >
            {assignee.user?.full_name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </div>
        ))}
        {task.assignees.length > 3 && (
          <div className="h-5 w-5 rounded-full bg-muted text-muted-foreground text-[9px] flex items-center justify-center border border-background">
            +{task.assignees.length - 3}
          </div>
        )}
      </div>
    )}
  </Card>
);

export default TaskBoard;