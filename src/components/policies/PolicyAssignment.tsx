import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, User, CalendarIcon, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface PolicyAssignmentProps {
  policyId: string;
}

const PolicyAssignment = ({ policyId }: PolicyAssignmentProps) => {
  const [groups, setGroups] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<Date>();
  const [existingAssignments, setExistingAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [policyId]);

  const fetchData = async () => {
    try {
      // Fetch groups
      const { data: groupsData } = await supabase
        .from("groups")
        .select("*")
        .order("name");
      setGroups(groupsData || []);

      // Fetch users
      const { data: usersData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      setUsers(usersData || []);

      // Fetch existing assignments
      const { data: assignmentsData } = await supabase
        .from("policy_assignments")
        .select(`
          *,
          groups(name),
          profiles(full_name)
        `)
        .eq("policy_id", policyId);
      setExistingAssignments(assignmentsData || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  const handleAssign = async () => {
    if (selectedGroups.length === 0 && selectedUsers.length === 0) {
      toast.error("Please select at least one group or user");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const assignments = [
        ...selectedGroups.map(groupId => ({
          policy_id: policyId,
          group_id: groupId,
          assigned_by: user.id,
          due_date: dueDate?.toISOString()
        })),
        ...selectedUsers.map(userId => ({
          policy_id: policyId,
          user_id: userId,
          assigned_by: user.id,
          due_date: dueDate?.toISOString()
        }))
      ];

      const { error } = await supabase
        .from("policy_assignments")
        .insert(assignments);

      if (error) throw error;

      toast.success("Policy assigned successfully");
      setSelectedGroups([]);
      setSelectedUsers([]);
      setDueDate(undefined);
      fetchData();
    } catch (error: any) {
      toast.error("Failed to assign policy");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Assign Policy</CardTitle>
          <CardDescription>
            Assign this policy to groups or individual users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs defaultValue="groups">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="groups">
                <Users className="h-4 w-4 mr-2" />
                Groups
              </TabsTrigger>
              <TabsTrigger value="users">
                <User className="h-4 w-4 mr-2" />
                Individual Users
              </TabsTrigger>
            </TabsList>

            <TabsContent value="groups" className="space-y-4">
              <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-3">
                {groups.map((group) => (
                  <div key={group.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`group-${group.id}`}
                      checked={selectedGroups.includes(group.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedGroups([...selectedGroups, group.id]);
                        } else {
                          setSelectedGroups(selectedGroups.filter(id => id !== group.id));
                        }
                      }}
                    />
                    <Label htmlFor={`group-${group.id}`} className="flex-1 cursor-pointer">
                      <div>
                        <p className="font-medium">{group.name}</p>
                        {group.description && (
                          <p className="text-sm text-muted-foreground">{group.description}</p>
                        )}
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="users" className="space-y-4">
              <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`user-${user.id}`}
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedUsers([...selectedUsers, user.id]);
                        } else {
                          setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                        }
                      }}
                    />
                    <Label htmlFor={`user-${user.id}`} className="flex-1 cursor-pointer">
                      <div>
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label>Due Date (Optional)</Label>
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
                  {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button onClick={handleAssign} disabled={loading} className="w-full">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {loading ? "Assigning..." : "Assign Policy"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Assignments</CardTitle>
          <CardDescription>
            Groups and users currently assigned to this policy
          </CardDescription>
        </CardHeader>
        <CardContent>
          {existingAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No assignments yet
            </p>
          ) : (
            <div className="space-y-2">
              {existingAssignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    {assignment.group_id ? (
                      <>
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{assignment.groups?.name}</span>
                      </>
                    ) : (
                      <>
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{assignment.profiles?.full_name}</span>
                      </>
                    )}
                  </div>
                  {assignment.due_date && (
                    <span className="text-sm text-muted-foreground">
                      Due: {format(new Date(assignment.due_date), "PP")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PolicyAssignment;
