import DashboardLayout from "@/components/dashboard/DashboardLayout";
import PolicyList from "@/components/policies/PolicyList";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import CreatePolicyDialog from "@/components/policies/CreatePolicyDialog";

const Policies = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Policies</h1>
            <p className="text-muted-foreground">Manage your organization's policies</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Policy
          </Button>
        </div>

        <PolicyList />
        <CreatePolicyDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      </div>
    </DashboardLayout>
  );
};

export default Policies;