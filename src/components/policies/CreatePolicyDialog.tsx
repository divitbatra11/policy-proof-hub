import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface CreatePolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreatePolicyDialog = ({ open, onOpenChange }: CreatePolicyDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create policy
      const { data: policy, error: policyError } = await supabase
        .from("policies")
        .insert({
          title,
          description,
          category,
          status: "draft",
          created_by: user.id
        })
        .select()
        .single();

      if (policyError) throw policyError;

      // Upload file if provided
      if (file && policy) {
        const fileName = `${policy.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("policy-documents")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("policy-documents")
          .getPublicUrl(fileName);

        // Create policy version
        const { error: versionError } = await supabase
          .from("policy_versions")
          .insert({
            policy_id: policy.id,
            version_number: 1,
            file_url: publicUrl,
            file_name: file.name,
            file_size: file.size
          });

        if (versionError) throw versionError;
      }

      toast.success("Policy created successfully");
      onOpenChange(false);
      resetForm();
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("");
    setFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Create New Policy</DialogTitle>
          <DialogDescription>
            Create a new policy document. You can add versions and assign it to groups later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="safety">Safety</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">Document File</Label>
              <Input
                id="file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                accept=".pdf,.doc,.docx"
              />
              <p className="text-xs text-muted-foreground">
                Upload the policy document (PDF, DOC, DOCX)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Policy"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePolicyDialog;