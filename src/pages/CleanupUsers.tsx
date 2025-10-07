import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

const CleanupUsers = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCleanup = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const { data, error: invokeError } = await supabase.functions.invoke('cleanup-users');

      if (invokeError) {
        throw invokeError;
      }

      setResult(data);
      toast.success("Users cleaned up successfully!");
    } catch (err: any) {
      console.error('Error cleaning up users:', err);
      setError(err.message || 'An error occurred during cleanup');
      toast.error("Failed to clean up users");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Cleanup Users</CardTitle>
            <CardDescription>
              Delete all users except the admin account (divitbatra1102@gmail.com)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Warning: This action will permanently delete all users and their associated data except for divitbatra1102@gmail.com. This cannot be undone.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleCleanup}
              disabled={loading}
              variant="destructive"
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cleaning up...
                </>
              ) : (
                'Delete All Users Except Admin'
              )}
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {result && (
              <Alert>
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">Cleanup completed!</p>
                    <p>Deleted users: {result.deletedUsers}</p>
                    <p>Kept user: {result.keptUser}</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CleanupUsers;
