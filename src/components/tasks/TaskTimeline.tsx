import { useRef, UIEvent } from "react";
import { useTasks } from "@/hooks/useTasks";
import { format, differenceInDays, startOfDay, addDays, startOfWeek } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const getAvatarColor = (name: string) => {
  const colors = [
    "bg-blue-600",
    "bg-purple-600",
    "bg-pink-600",
    "bg-orange-600",
    "bg-teal-600",
    "bg-indigo-600",
    "bg-rose-600",
    "bg-cyan-600",
  ];
  const index = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
};

const PIXELS_PER_DAY = 20;

const TaskTimeline = () => {
  const { data, isLoading } = useTasks({});
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const rightColumnRef = useRef<HTMLDivElement>(null);

  // Sync vertical scroll between left column and timeline
  const handleLeftScroll = (e: UIEvent<HTMLDivElement>) => {
    if (rightColumnRef.current) {
      rightColumnRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleRightScroll = (e: UIEvent<HTMLDivElement>) => {
    if (leftColumnRef.current) {
      leftColumnRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-1 bg-card border border-border p-4 rounded-lg">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-10 rounded" />
        ))}
      </div>
    );
  }

  const tasks = data?.tasks || [];
  const today = startOfDay(new Date());

  const sortedTasks = [...tasks].sort((a, b) => {
    const dateA = a.start_date ? new Date(a.start_date) : a.due_date ? new Date(a.due_date) : new Date(0);
    const dateB = b.start_date ? new Date(b.start_date) : b.due_date ? new Date(b.due_date) : new Date(0);
    return dateA.getTime() - dateB.getTime();
  });

  let minDate = startOfWeek(today);
  let maxDate = addDays(today, 90);

  sortedTasks.forEach((task) => {
    if (task.start_date) {
      const d = new Date(task.start_date);
      if (d < minDate) minDate = startOfWeek(d);
    }
    if (task.due_date) {
      const d = new Date(task.due_date);
      if (d > maxDate) maxDate = d;
    }
  });

  minDate = addDays(minDate, -7);
  maxDate = addDays(maxDate, 14);

  const totalDays = differenceInDays(maxDate, minDate) + 1;
  const timelineWidth = totalDays * PIXELS_PER_DAY;

  const weekMarkers: { date: Date; left: number }[] = [];
  let currentWeek = startOfWeek(minDate);
  while (currentWeek <= maxDate) {
    const offset = differenceInDays(currentWeek, minDate);
    weekMarkers.push({
      date: currentWeek,
      left: offset * PIXELS_PER_DAY,
    });
    currentWeek = addDays(currentWeek, 7);
  }

  const getTaskPosition = (taskStartDate: string | null, taskDueDate: string | null) => {
    const start = taskStartDate ? new Date(taskStartDate) : taskDueDate ? new Date(taskDueDate) : today;
    const end = taskDueDate ? new Date(taskDueDate) : start;

    const startOffset = differenceInDays(start, minDate);
    const duration = differenceInDays(end, start) + 1;

    return {
      left: startOffset * PIXELS_PER_DAY,
      width: Math.max(duration * PIXELS_PER_DAY, 4),
    };
  };

  const todayOffset = differenceInDays(today, minDate) * PIXELS_PER_DAY;

  return (
    <div className="bg-card border border-border rounded-lg w-full overflow-hidden">
      <div className="flex">
        {/* Fixed left column */}
        <div className="w-80 flex-shrink-0 border-r border-border">
          {/* Header */}
          <div className="bg-muted/50 h-10 flex items-center px-3 border-b border-border">
            <span className="text-sm font-medium text-muted-foreground">Task</span>
          </div>
          {/* Task rows - hidden scrollbar, synced with right */}
          <div
            ref={leftColumnRef}
            className="max-h-[500px] overflow-y-auto"
            onScroll={handleLeftScroll}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {sortedTasks.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No tasks</p>
            ) : (
              sortedTasks.map((task, index) => {
                const isCompleted = task.status === "completed";
                const assignees = task.assignees || [];
                const displayedAssignees = assignees.slice(0, 2);
                const remainingCount = assignees.length - 2;

                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 border-b border-border h-10",
                      index % 2 === 0 ? "bg-background" : "bg-muted/30"
                    )}
                  >
                    <span className="text-muted-foreground text-sm w-5 text-right flex-shrink-0">
                      {index + 1}
                    </span>
                    <button
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                        isCompleted
                          ? "bg-primary border-primary"
                          : "border-muted-foreground/50 hover:border-muted-foreground"
                      )}
                    >
                      {isCompleted && <Check className="w-3 h-3 text-primary-foreground" />}
                    </button>
                    <span
                      className={cn(
                        "text-sm truncate flex-1 min-w-0",
                        isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                      )}
                      title={task.title}
                    >
                      {task.title}
                    </span>
                    <div className="flex items-center -space-x-1 flex-shrink-0">
                      {displayedAssignees.map((assignee) => {
                        const name = assignee.user?.full_name || "Unknown";
                        return (
                          <div
                            key={assignee.id}
                            className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white border-2 border-background",
                              getAvatarColor(name)
                            )}
                            title={name}
                          >
                            {getInitials(name)}
                          </div>
                        );
                      })}
                      {remainingCount > 0 && (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-muted-foreground bg-muted border-2 border-background">
                          +{remainingCount}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Scrollable timeline area - SINGLE scrollable container for header + body */}
        <div
          ref={rightColumnRef}
          className="flex-1 min-w-0 overflow-x-auto overflow-y-auto max-h-[540px]"
          onScroll={handleRightScroll}
        >
          {/* Timeline content wrapper - fixed width for horizontal scroll */}
          <div style={{ width: `${timelineWidth}px` }}>
            {/* Timeline header - scrolls with content */}
            <div className="sticky top-0 z-10 bg-muted/50 border-b border-border h-10 relative">
              {weekMarkers.map((marker, idx) => (
                <div
                  key={idx}
                  className="absolute top-0 bottom-0 flex items-center"
                  style={{ left: `${marker.left}px` }}
                >
                  <div className="border-l border-border h-full" />
                  <span className="ml-2 text-xs text-muted-foreground whitespace-nowrap">
                    {format(marker.date, "MMM d")}
                  </span>
                </div>
              ))}
              {todayOffset >= 0 && todayOffset <= timelineWidth && (
                <div
                  className="absolute top-3 w-2.5 h-2.5 bg-destructive rounded-full -translate-x-1 z-10"
                  style={{ left: `${todayOffset}px` }}
                />
              )}
            </div>

            {/* Timeline rows */}
            {sortedTasks.length === 0 ? (
              <div style={{ height: 80 }} />
            ) : (
              sortedTasks.map((task, index) => {
                const position = getTaskPosition(task.start_date, task.due_date);

                return (
                  <div
                    key={task.id}
                    className={cn(
                      "relative h-10 border-b border-border",
                      index % 2 === 0 ? "bg-background" : "bg-muted/30"
                    )}
                  >
                    {weekMarkers.map((marker, idx) => (
                      <div
                        key={idx}
                        className="absolute top-0 bottom-0 border-l border-border"
                        style={{ left: `${marker.left}px` }}
                      />
                    ))}
                    {(task.start_date || task.due_date) && (
                      <div
                        className="absolute top-2 h-6 bg-sky-500 rounded-sm cursor-pointer hover:bg-sky-400 transition-colors shadow-sm"
                        style={{
                          left: `${position.left}px`,
                          width: `${position.width}px`,
                          minWidth: "4px",
                        }}
                        title={`${task.start_date ? format(new Date(task.start_date), "MMM d") : "No start"} - ${task.due_date ? format(new Date(task.due_date), "MMM d") : "No end"}`}
                      />
                    )}
                    {todayOffset >= 0 && todayOffset <= timelineWidth && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-destructive z-10"
                        style={{ left: `${todayOffset}px` }}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskTimeline;
