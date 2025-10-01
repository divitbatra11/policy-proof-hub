import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const DashboardOverview = () => {
  const [stats, setStats] = useState({
    totalPolicies: 0,
    pendingAttestations: 0,
    totalGroups: 0,
    recentActivity: 0
  });
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

      setStats({
        totalPolicies: policiesCount || 0,
        pendingAttestations: pendingCount || 0,
        totalGroups: groupsCount || 0,
        recentActivity: 0
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
    </div>
  );
};

export default DashboardOverview;