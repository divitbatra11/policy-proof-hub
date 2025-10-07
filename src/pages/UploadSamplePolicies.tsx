import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

const UploadSamplePolicies = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      // Sample PDF files to upload
      const samplePolicies = [
        { keyword: 'code of conduct', file: 'code_of_conduct.pdf' },
        { keyword: 'data', file: 'data_security.pdf' },
        { keyword: 'expense', file: 'expense_reimbursement.pdf' },
        { keyword: 'remote', file: 'remote_work.pdf' },
      ];

      let uploadedCount = 0;

      // Get all policies
      const { data: policies, error: policiesError } = await supabase
        .from('policies')
        .select('id, title, current_version_id');
      
      if (policiesError) throw policiesError;

      for (const policy of policies) {
        // Find matching sample file
        const matchingFile = samplePolicies.find(s => 
          policy.title.toLowerCase().includes(s.keyword)
        );
        
        if (!matchingFile) {
          console.log(`No matching sample file for: ${policy.title}`);
          continue;
        }

        // Fetch the PDF from the public folder
        const pdfUrl = `/temp/${matchingFile.file}`;
        console.log(`Fetching PDF from: ${pdfUrl}`);
        
        let pdfBlob;
        try {
          const response = await fetch(pdfUrl);
          if (!response.ok) {
            console.error(`Failed to fetch ${matchingFile.file}: ${response.status}`);
            continue;
          }
          pdfBlob = await response.blob();
        } catch (fetchError) {
          console.error(`Error fetching ${matchingFile.file}:`, fetchError);
          continue;
        }

        // Upload to storage
        const fileName = `${policy.id}/${matchingFile.file}`;
        const { error: uploadError } = await supabase.storage
          .from('policy-documents')
          .upload(fileName, pdfBlob, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (uploadError) {
          console.error(`Error uploading ${fileName}:`, uploadError);
          continue;
        }

        // Get the public URL
        const { data: urlData } = supabase.storage
          .from('policy-documents')
          .getPublicUrl(fileName);

        // Get current version or create new one
        let versionId = policy.current_version_id;
        
        if (!versionId) {
          // Create a new version
          const { data: newVersion, error: versionError } = await supabase
            .from('policy_versions')
            .insert({
              policy_id: policy.id,
              version_number: 1,
              file_url: urlData.publicUrl,
              file_name: matchingFile.file,
              file_size: pdfBlob.size,
              change_summary: 'Initial version uploaded with sample document'
            })
            .select()
            .single();

          if (versionError) {
            console.error('Error creating version:', versionError);
            continue;
          }

          versionId = newVersion.id;

          // Update policy with current_version_id
          await supabase
            .from('policies')
            .update({ current_version_id: versionId })
            .eq('id', policy.id);
        } else {
          // Update existing version
          await supabase
            .from('policy_versions')
            .update({
              file_url: urlData.publicUrl,
              file_name: matchingFile.file,
              file_size: pdfBlob.size
            })
            .eq('id', versionId);
        }

        uploadedCount++;
        console.log(`Uploaded ${matchingFile.file} for ${policy.title}`);
      }

      setResult({ uploadedCount, message: `Uploaded ${uploadedCount} policy documents` });
      toast.success(`Successfully uploaded ${uploadedCount} policy documents!`);
    } catch (err: any) {
      console.error('Error uploading policies:', err);
      setError(err.message || 'An error occurred while uploading policies');
      toast.error("Failed to upload policies");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Upload Sample Policy Documents
            </CardTitle>
            <CardDescription>
              Upload sample PDF documents for existing policies in the database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                This will upload sample policy documents (Code of Conduct, Data Security, Expense Reimbursement, Remote Work) 
                to the storage bucket and link them to matching policies.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleUpload}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading documents...
                </>
              ) : (
                'Upload Sample Policies'
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
                    <p className="font-semibold">{result.message}</p>
                    <p className="text-sm">
                      You can now view and download these policies from the Policies page.
                    </p>
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

export default UploadSamplePolicies;
