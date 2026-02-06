import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Users, CheckCircle, AlertCircle, ListTodo, PlayCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import PendingAttestationsWidget from "./PendingAttestationsWidget";

// Status and Priority constants
const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
};

const DashboardOverview = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalPolicies: 0,
    pendingAttestations: 0,
    totalGroups: 0,
    recentActivity: 0,
    total: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
  });
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(profileData);

      const isAdminOrPublisher = profileData?.role === "admin" || profileData?.role === "publisher";

      // Fetch policies count
      let policiesQuery = supabase
        .from("policies")
        .select("*", { count: "exact", head: true });
      
      if (!isAdminOrPublisher) {
        policiesQuery = policiesQuery.eq("status", "published");
      }

      const { count: policiesCount } = await policiesQuery;

      // Fetch groups count
      const { count: groupsCount } = await supabase
        .from("groups")
        .select("*", { count: "exact", head: true });

      // Fetch pending attestations for the user
      const { count: pendingCount } = await supabase
        .from("policy_assignments")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Fetch tasks statistics
      const { data: allTasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("created_by", user.id)
        .limit(5);

      const tasks = allTasks || [];
      const totalTasks = tasks.length;
      const inProgressTasks = tasks.filter((t: any) => t.status === "in_progress").length;
      const completedTasks = tasks.filter((t: any) => t.status === "completed").length;
      const overdueTasks = tasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "completed").length;

      setRecentTasks(tasks);
      setStats({
        totalPolicies: policiesCount || 0,
        pendingAttestations: pendingCount || 0,
        totalGroups: groupsCount || 0,
        recentActivity: 0,
        total: totalTasks,
        inProgress: inProgressTasks,
        completed: completedTasks,
        overdue: overdueTasks,
      });
    } catch (error: any) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse">Loading dashboard...</div>;
  }

  const statCards = [
    {
      title: "Total Policies",
      value: stats.totalPolicies,
      icon: FileText,
      description: "Published and active policies"
    },
    {
      title: "Pending Attestations",
      value: stats.pendingAttestations,
      icon: AlertCircle,
      description: "Policies awaiting your signature"
    },
    {
      title: "Groups",
      value: stats.totalGroups,
      icon: Users,
      description: "Active organizational groups"
    },
    {
      title: "Compliance Rate",
      value: "98%",
      icon: CheckCircle,
      description: "Overall attestation rate"
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {profile?.full_name}</h1>
        <p className="text-muted-foreground">
          Role: <span className="capitalize font-medium">{profile?.role}</span>
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks for your role
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {profile?.role === "employee" && "View assigned policies and complete attestations"}
            {(profile?.role === "admin" || profile?.role === "publisher") && 
              "Create new policies, assign to groups, and track compliance"}
          </div>
        </CardContent>
      </Card>

      <PendingAttestationsWidget />
      <Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <ListTodo className="h-5 w-5 text-primary" />
        <div>
          <CardTitle>Tasks Overview</CardTitle>
          <CardDescription>Your recent and active tasks</CardDescription>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/tasks")}>
        View All Tasks
      </Button>
    </div>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Mini KPI row */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted">
        <ListTodo className="h-4 w-4" />
        <span className="text-sm">Total: <strong>{stats.total}</strong></span>
      </div>
      <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50">
        <PlayCircle className="h-4 w-4 text-blue-600" />
        <span className="text-sm">In Progress: <strong>{stats.inProgress}</strong></span>
      </div>
      <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <span className="text-sm">Completed: <strong>{stats.completed}</strong></span>
      </div>
      <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <span className="text-sm">Overdue: <strong>{stats.overdue}</strong></span>
      </div>
    </div>

    {/* Recent tasks list */}
    <div className="space-y-2">
      {recentTasks.map((task) => (
        <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{task.title}</p>
            {task.due_date && (
              <p className="text-xs text-muted-foreground">
                Due: {format(new Date(task.due_date), "MMM d, yyyy")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={STATUS_COLORS[task.status]}>{STATUS_LABELS[task.status]}</Badge>
            <Badge className={PRIORITY_COLORS[task.priority]}>{PRIORITY_LABELS[task.priority]}</Badge>
          </div>
        </div>
      ))}
    </div>
  </CardContent>
</Card>

    </div>
  );
};

export default DashboardOverview;