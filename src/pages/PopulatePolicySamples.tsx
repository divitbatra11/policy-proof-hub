import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { populatePolicySamples } from "@/utils/populatePolicySamples";
import { FileText, Loader2 } from "lucide-react";

const PopulatePolicySamples = () => {
  const [isPopulating, setIsPopulating] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handlePopulate = async () => {
    setIsPopulating(true);
    setResults([]);
    
    try {
      const populationResults = await populatePolicySamples();
      setResults(populationResults);
      toast.success("Successfully populated policies with sample documents!");
    } catch (error: any) {
      console.error('Error populating policies:', error);
      toast.error(error.message || "Failed to populate policies");
    } finally {
      setIsPopulating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Populate Policies with Sample Documents</CardTitle>
            <CardDescription>
              Upload sample PDF documents to all policies so they can be viewed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                This will upload sample PDF documents to all existing policies and create version 1 for each policy.
              </AlertDescription>
            </Alert>

            <Button 
              onClick={handlePopulate} 
              disabled={isPopulating}
              className="w-full"
            >
              {isPopulating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Populating...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Populate Policies
                </>
              )}
            </Button>

            {results.length > 0 && (
              <Alert>
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Results:</p>
                    {results.map((result, idx) => (
                      <p key={idx} className={result.success ? "text-green-600" : "text-red-600"}>
                        {result.success ? "✓" : "✗"} {result.policy}
                      </p>
                    ))}
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

export default PopulatePolicySamples;
