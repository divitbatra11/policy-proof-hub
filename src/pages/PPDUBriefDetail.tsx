import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import loadHTMLToDOCX from "@/utils/htmlToDocx";
import PPDUEditor from "@/components/ppdu/PPDUEditor";

interface LibraryEntry {
  id: string;
  title: string;
  content: string | null;
  notes: string | null;
  saved_by: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
}

const PPDUBriefDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<LibraryEntry | null>(null);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from("ppdu_brief_library")
          .select("*, profiles:saved_by(full_name)")
          .eq("id", id)
          .single();

        if (error) throw error;
        if (!data) {
          toast.error("Library entry not found");
          navigate("/dashboard/ppdu-brief-library");
          return;
        }

        setEntry(data as LibraryEntry);
        setContent(data.content ?? "");
      } catch (err) {
        console.error("Error loading library entry:", err);
        toast.error("Failed to load brief");
        navigate("/dashboard/ppdu-brief-library");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [id, navigate]);

  const handleDownload = async () => {
    if (!entry) return;
    setIsDownloading(true);
    try {
      const convert = await loadHTMLToDOCX();
      const docxBlob = await convert(content, undefined, {
        table: { row: { cantSplit: true } },
        font: "Calibri",
        fontSize: 22,
      });
      const url = URL.createObjectURL(docxBlob as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entry.title.replace(/\s+/g, "_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Document downloaded as DOCX");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download document");
    } finally {
      setIsDownloading(false);
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

  if (!entry) return null;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard/ppdu-brief-library")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Library
            </Button>
            <div>
              <h1 className="text-xl font-bold">{entry.title}</h1>
              <p className="text-xs text-muted-foreground">
                Saved by {entry.profiles?.full_name ?? "Unknown"} on{" "}
                {format(new Date(entry.created_at), "PPP p")}
              </p>
            </div>
          </div>

          <Button onClick={handleDownload} disabled={isDownloading} variant="outline">
            {isDownloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download DOCX
          </Button>
        </div>

        {/* Read-only editor (passes setContent but title/content are snapshot) */}
        <Card className="shadow-lg w-full overflow-hidden">
          <CardContent className="p-0 w-full overflow-x-auto">
            <PPDUEditor content={content} onContentChange={setContent} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PPDUBriefDetail;
