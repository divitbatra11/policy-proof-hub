import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Database, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";

const PopulateTestData = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>("");

  const handlePopulate = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('populate-test-data', {
        body: {}
      });

      if (error) throw error;

      setResult(data);
      toast.success('Users added successfully!');
    } catch (err: any) {
      setError(err.message);
      toast.error('Failed to add users');
      console.error('Population error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Add Users</h1>
          <p className="text-muted-foreground">
            Add 340 sample users and assign them to groups
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add Sample Users</CardTitle>
            <CardDescription>
              Create test users and assign them to existing groups
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Alert>
                <Database className="h-4 w-4" />
                <AlertDescription>
                  This will create 340 sample users and assign them to groups:
                  <ul className="mt-2 space-y-1 ml-4">
                    <li>• Directors: 15 users</li>
                    <li>• Executive Directors: 5 users</li>
                    <li>• Admin: 20 users</li>
                    <li>• SPO: 50 users</li>
                    <li>• PO: 250 users</li>
                  </ul>
                  <p className="mt-2">All users will have password: <strong>Demo123!</strong></p>
                </AlertDescription>
              </Alert>
            </div>

            <Button
              onClick={handlePopulate}
              disabled={loading}
              size="lg"
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Adding Users... This may take a minute
                </>
              ) : (
                <>
                  <Database className="h-5 w-5 mr-2" />
                  Add Users to Groups
                </>
              )}
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {result && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">Success! Users added:</p>
                    <ul className="text-sm space-y-1">
                      <li>• {result.stats.users} users created</li>
                    </ul>
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

export default PopulateTestData;
