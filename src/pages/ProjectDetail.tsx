import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import mammoth from "mammoth";
import loadHTMLToDOCX from "@/utils/htmlToDocx";
import { generateIntakeFormHtml } from "@/components/intake/intakeFormTemplate";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Download, Save, Loader2 } from "lucide-react";
import PPDUEditor from "@/components/ppdu/PPDUEditor";
import { Input } from "@/components/ui/input";

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [documentTitle, setDocumentTitle] = useState("");
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [projectData, setProjectData] = useState<any>(null);

  // Load project from database
  useEffect(() => {
    const loadProject = async () => {
      if (!id) return;

      try {
        // Fetch project metadata
        const { data: project, error: projectError } = await supabase
          .from("project_intake_forms")
          .select("*")
          .eq("id", id)
          .single();

        if (projectError) throw projectError;
        if (!project) {
          toast.error("Project not found");
          navigate("/dashboard/project-library");
          return;
        }

        setProjectData(project);
        setDocumentTitle(project.project_name);

        console.log("Project data:", project);
        console.log("Has html_content:", !!(project as any).html_content);
        console.log("Has form_data:", !!project.form_data);

        // Priority order:
        // 1. Use html_content if available (preserves all formatting)
        // 2. Regenerate from form_data if available
        // 3. Show empty message
        if ((project as any).html_content) {
          console.log("Using saved html_content");
          setContent((project as any).html_content);
        } else if (project.form_data) {
          console.log("Regenerating HTML from form_data");
          const regeneratedHtml = generateIntakeFormHtml(project.form_data as any);
          setContent(regeneratedHtml);
          toast.info("Document loaded from form data");
        } else {
          console.log("No content available");
          setContent("<p>This project form is empty. You can start editing now.</p>");
          toast.warning("No content available for this project");
        }
      } catch (error) {
        console.error("Error loading project:", error);
        toast.error("Failed to load project");
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [id, navigate]);

  // Extract file path from signed URL
  const extractFilePathFromUrl = (url: string): string | null => {
    try {
      console.log("Extracting path from URL:", url);
      const urlObj = new URL(url);
      
      // Try different patterns for signed URLs
      // Pattern 1: /storage/v1/object/sign/policy-documents/path?token=...
      let pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/sign\/policy-documents\/(.+?)(?:\?|$)/);
      
      if (pathMatch && pathMatch[1]) {
        const decodedPath = decodeURIComponent(pathMatch[1]);
        console.log("Extracted path (pattern 1):", decodedPath);
        return decodedPath;
      }
      
      // Pattern 2: /object/sign/policy-documents/path?token=...
      pathMatch = urlObj.pathname.match(/\/object\/sign\/policy-documents\/(.+?)(?:\?|$)/);
      
      if (pathMatch && pathMatch[1]) {
        const decodedPath = decodeURIComponent(pathMatch[1]);
        console.log("Extracted path (pattern 2):", decodedPath);
        return decodedPath;
      }
      
      // Pattern 3: /sign/policy-documents/path?token=...
      pathMatch = urlObj.pathname.match(/\/sign\/policy-documents\/(.+?)(?:\?|$)/);
      
      if (pathMatch && pathMatch[1]) {
        const decodedPath = decodeURIComponent(pathMatch[1]);
        console.log("Extracted path (pattern 3):", decodedPath);
        return decodedPath;
      }
      
      console.log("No pattern matched");
      return null;
    } catch (error) {
      console.error("Error extracting file path:", error);
      return null;
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const convert = await loadHTMLToDOCX();
      
      const headerHtml = `<p style="text-align: center; font-family: Calibri, sans-serif; font-size: 13pt; margin: 0;">Alberta Public Safety and Emergency Services</p>`;

      const docxBlob = await convert(content, headerHtml, {
        table: { row: { cantSplit: true } },
        font: "Calibri",
        fontSize: 26,
        header: true,
        headerType: "default",
      });

      const url = URL.createObjectURL(docxBlob as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${documentTitle.replace(/\s+/g, "_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Document downloaded as DOCX");
    } catch (error) {
      console.error("Error generating DOCX:", error);
      toast.error("Failed to download document");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSave = async () => {
    if (!id || !projectData) return;

    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("You must be logged in to save");
        return;
      }

      const user = session.user;

      // Generate updated DOCX file
      const convert = await loadHTMLToDOCX();
      const headerHtml = `<p style="text-align: center; font-family: Calibri, sans-serif; font-size: 13pt; margin: 0;">Alberta Public Safety and Emergency Services</p>`;

      const docxBlob = await convert(content, headerHtml, {
        table: { row: { cantSplit: true } },
        font: "Calibri",
        fontSize: 26,
        header: true,
        headerType: "default",
      }) as Blob;

      // Upload new version to storage using the project ID
      const timestamp = Date.now();
      const sanitizedName = documentTitle.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
      const fileName = `${id}/${timestamp}-${sanitizedName}.docx`;
      
      const { error: uploadError } = await supabase.storage
        .from("policy-documents")
        .upload(fileName, docxBlob, {
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: false
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Get signed URL
      const { data: urlData, error: urlError } = await supabase.storage
        .from("policy-documents")
        .createSignedUrl(fileName, 31536000);

      if (urlError) {
        console.error("Error creating signed URL:", urlError);
        throw new Error(`Failed to create signed URL: ${urlError.message}`);
      }

      const fileUrl = urlData?.signedUrl || "";

      // Update database record (save edited HTML content)
      const { error: updateError } = await supabase
        .from("project_intake_forms")
        .update({
          title: documentTitle,
          project_name: documentTitle,
          file_url: fileUrl,
          file_path: fileName,
          file_name: `${documentTitle}.docx`,
          file_size: docxBlob.size,
          html_content: content,
          updated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq("id", id);

      if (updateError) {
        console.error("Database update error:", updateError);
        throw new Error(`Database update failed: ${updateError.message}`);
      }

      toast.success("Project saved successfully!");
    } catch (error: any) {
      console.error("Error saving project:", error);
      toast.error(error.message || "Failed to save project");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard/project-library")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Library
            </Button>
            <Input
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              className="text-lg font-semibold max-w-md"
              placeholder="Project Name"
            />
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isSaving} variant="secondary">
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
            <Button onClick={handleDownload} disabled={isDownloading}>
              {isDownloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download
            </Button>
          </div>
        </div>

        {/* Editor */}
        <Card className="shadow-lg w-full overflow-hidden">
          <CardContent className="p-0 w-full overflow-x-auto">
            <PPDUEditor
              content={content}
              onContentChange={setContent}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ProjectDetail;
