import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PolicyEditProps {
  policy: any;
  onSave: () => void;
}

const PolicyEdit = ({ policy, onSave }: PolicyEditProps) => {
  const [title, setTitle] = useState(policy.title);
  const [description, setDescription] = useState(policy.description || "");
  const [category, setCategory] = useState(policy.category || "");
  const [status, setStatus] = useState(policy.status);
  const [file, setFile] = useState<File | null>(null);
  const [changeSummary, setChangeSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string>("");

  const currentVersion = policy.policy_versions?.find((v: any) => v.id === policy.current_version_id);

  useEffect(() => {
    const getSignedUrl = async () => {
      if (!currentVersion?.file_url) return;
      
      // Extract the file path from the full URL
      const urlParts = currentVersion.file_url.split('/policy-documents/');
      if (urlParts.length < 2) return;
      
      const filePath = urlParts[1];
      
      const { data, error } = await supabase.storage
        .from('policy-documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiry
      
      if (error) {
        console.error('Error getting signed URL:', error);
        toast.error('Failed to load policy document');
        return;
      }
      
      if (data?.signedUrl) {
        setFileUrl(data.signedUrl);
      }
    };
    
    getSignedUrl();
  }, [currentVersion]);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Update policy
      const { error: updateError } = await supabase
        .from("policies")
        .update({
          title,
          description,
          category,
          status
        })
        .eq("id", policy.id);

      if (updateError) throw updateError;

      // If new file is uploaded, create new version
      if (file) {
        const fileName = `${policy.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("policy-documents")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = await supabase.storage
          .from("policy-documents")
          .createSignedUrl(fileName, 31536000); // 1 year expiry for stored URLs
        
        const publicUrl = urlData?.signedUrl || "";

        // Get current max version number
        const { data: versions } = await supabase
          .from("policy_versions")
          .select("version_number")
          .eq("policy_id", policy.id)
          .order("version_number", { ascending: false })
          .limit(1);

        const nextVersion = (versions?.[0]?.version_number || 0) + 1;

        // Create new version
        const { data: newVersion, error: versionError } = await supabase
          .from("policy_versions")
          .insert({
            policy_id: policy.id,
            version_number: nextVersion,
            file_url: publicUrl,
            file_name: file.name,
            file_size: file.size,
            change_summary: changeSummary
          })
          .select()
          .single();

        if (versionError) throw versionError;

        // Update current version
        const { error: currentVersionError } = await supabase
          .from("policies")
          .update({ current_version_id: newVersion.id })
          .eq("id", policy.id);

        if (currentVersionError) throw currentVersionError;
      }

      toast.success("Policy updated successfully");
      onSave();
    } catch (error: any) {
      toast.error("Failed to update policy");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: updateError } = await supabase
        .from("policies")
        .update({ status: "published" })
        .eq("id", policy.id);

      if (updateError) throw updateError;

      // Update current version to mark as published
      if (policy.current_version_id) {
        const { error: versionError } = await supabase
          .from("policy_versions")
          .update({
            published_at: new Date().toISOString(),
            published_by: user.id
          })
          .eq("id", policy.current_version_id);

        if (versionError) throw versionError;
      }

      toast.success("Policy published successfully");
      onSave();
    } catch (error: any) {
      toast.error("Failed to publish policy");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Policy</CardTitle>
        <CardDescription>
          Update policy details and upload new versions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="edit-title">Title</Label>
          <Input
            id="edit-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-description">Description</Label>
          <Textarea
            id="edit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="edit-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HR">HR</SelectItem>
                <SelectItem value="Security">Security</SelectItem>
                <SelectItem value="Compliance">Compliance</SelectItem>
                <SelectItem value="Finance">Finance</SelectItem>
                <SelectItem value="Operations">Operations</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Document Editor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fileUrl ? (
              <div className="border rounded-lg overflow-hidden bg-background">
                <iframe
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`}
                  className="w-full h-[700px]"
                  title="Document Editor"
                />
              </div>
            ) : currentVersion ? (
              <div className="w-full h-[700px] flex items-center justify-center border rounded-lg">
                <p className="text-muted-foreground">Loading document...</p>
              </div>
            ) : null}
            
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium">Upload New Version</h4>
              <div className="space-y-2">
                <Label htmlFor="edit-file">Document File</Label>
                <Input
                  id="edit-file"
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx"
                />
              </div>

              {file && (
                <div className="space-y-2">
                  <Label htmlFor="change-summary">Change Summary</Label>
                  <Textarea
                    id="change-summary"
                    value={changeSummary}
                    onChange={(e) => setChangeSummary(e.target.value)}
                    placeholder="Describe what changed in this version..."
                    rows={2}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={loading} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Saving..." : "Save Changes"}
          </Button>
          {status === "draft" && (
            <Button onClick={handlePublish} disabled={loading} variant="default">
              <Upload className="h-4 w-4 mr-2" />
              Publish
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PolicyEdit;
