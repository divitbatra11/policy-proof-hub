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
      const { data, error } = await supabase.functions.invoke('cleanup-and-populate', {
        body: {}
      });

      if (error) throw error;

      setResult(data);
      toast.success('Database cleaned and populated successfully!');
    } catch (err: any) {
      setError(err.message);
      toast.error('Failed to clean and populate database');
      console.error('Population error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Populate Test Data</h1>
          <p className="text-muted-foreground">
            Generate sample users, groups, and policies for testing
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Database Cleanup & Population</CardTitle>
            <CardDescription>
              This will delete all users (except yours) and policies, then create 798 sample policies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> This will delete all users (except divitbatra1102@gmail.com) and all policies from the database.
                  <br />
                  <br />
                  Then it will create 798 sample policies with actual policy content covering:
                  <ul className="mt-2 space-y-1 ml-4">
                    <li>• Code of Conduct</li>
                    <li>• Data Security & Privacy</li>
                    <li>• Remote Work Guidelines</li>
                    <li>• Expense Reimbursement</li>
                    <li>• Paid Time Off</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>

            <Button
              onClick={handlePopulate}
              disabled={loading}
              size="lg"
              className="w-full"
              variant="destructive"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Cleaning and Populating... This may take a minute
                </>
              ) : (
                <>
                  <Database className="h-5 w-5 mr-2" />
                  Clean & Populate Database
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
                    <p className="font-semibold">Success! Database cleaned and populated:</p>
                    <ul className="text-sm space-y-1">
                      <li>• {result.stats.usersDeleted} users deleted</li>
                      <li>• {result.stats.policiesCreated} policies created</li>
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
