import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import CreateGroupDialog from "./CreateGroupDialog";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

const GroupList = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["currentProfile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: groups, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select(`
          *,
          group_members(count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const canManageGroups = profile?.role === "admin" || profile?.role === "publisher";

  if (isLoading) {
    return <div className="animate-pulse">Loading groups...</div>;
  }

  return (
    <div className="space-y-4">
      {canManageGroups && (
        <div className="flex justify-end">
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Group
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups?.map((group) => (
          <Card key={group.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {group.name}
              </CardTitle>
              {group.description && (
                <CardDescription>{group.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">
                {group.group_members?.[0]?.count || 0} members
              </Badge>
            </CardContent>
          </Card>
        ))}

        {groups?.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                No groups created yet
              </p>
              {canManageGroups && (
                <Button 
                  onClick={() => setCreateDialogOpen(true)} 
                  className="mt-4"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Group
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <CreateGroupDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
};

export default GroupList;
