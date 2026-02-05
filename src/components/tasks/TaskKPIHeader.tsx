import { useTaskStats } from "@/hooks/useTasks";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ListTodo, Clock, PlayCircle, CheckCircle2, AlertTriangle } from "lucide-react";

const TaskKPIHeader = () => {
  const { data: stats, isLoading } = useTaskStats();

  const kpis = [
    {
      label: "Total",
      value: stats?.total ?? 0,
      icon: ListTodo,
      color: "text-foreground",
      bgColor: "bg-muted",
    },
    {
      label: "Not Started",
      value: stats?.notStarted ?? 0,
      icon: Clock,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    },
    {
      label: "In Progress",
      value: stats?.inProgress ?? 0,
      icon: PlayCircle,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      label: "Completed",
      value: stats?.completed ?? 0,
      icon: CheckCircle2,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    {
      label: "Overdue",
      value: stats?.overdue ?? 0,
      icon: AlertTriangle,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-950",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-16 mb-2" />
            <Skeleton className="h-8 w-12" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className={`p-4 ${kpi.bgColor}`}>
          <div className="flex items-center gap-2 mb-1">
            <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            <span className="text-sm text-muted-foreground">{kpi.label}</span>
          </div>
          <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
        </Card>
      ))}
    </div>
  );
};

export default TaskKPIHeader;
