import { useState, useRef, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import mammoth from "mammoth";
import loadHTMLToDOCX from "@/utils/htmlToDocx";
import { supabase } from "@/integrations/supabase/client";

import PPDUEditor from "@/components/ppdu/PPDUEditor";
import PPDUToolbar from "@/components/ppdu/PPDUToolbar";
import {
  PPDU_BRIEF_TEMPLATE,
  generateDownloadHtml,
} from "@/components/ppdu/ppduTemplates";

const PPDUBrief = () => {
  const [documentTitle, setDocumentTitle] = useState("PPDU Brief");
  const [content, setContent] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [briefId, setBriefId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedRef = useRef(false);

  // Load saved content from Supabase on mount
  useEffect(() => {
    const loadBrief = async () => {
      try {
        const { data, error } = await supabase
          .from("ppdu_briefs")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("Error loading PPDU brief:", error);
          toast.error("Failed to load document from database");
          return;
        }

        if (data) {
          setBriefId(data.id);
          setDocumentTitle(data.title);
          setContent(data.content);
        }
      } catch (err) {
        console.error("Error loading PPDU brief:", err);
        toast.error("Failed to load document");
      } finally {
        setIsLoading(false);
        // Mark as loaded after a short delay so the auto-save
        // useEffect doesn't fire for the initial state set
        setTimeout(() => {
          hasLoadedRef.current = true;
        }, 500);
      }
    };

    loadBrief();
  }, []);

  // Auto-save to Supabase with 2-second debounce
  useEffect(() => {
    // Don't auto-save before initial load completes
    if (!hasLoadedRef.current) return;

    setSaveStatus("idle");

    const timer = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const { data: sessionData } =
          await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id || null;

        if (briefId) {
          // Update existing record
          const { error } = await supabase
            .from("ppdu_briefs")
            .update({
              title: documentTitle,
              content: content,
              updated_at: new Date().toISOString(),
              updated_by: userId,
            })
            .eq("id", briefId);

          if (error) throw error;
        } else {
          // Insert new record
          const { data, error } = await supabase
            .from("ppdu_briefs")
            .insert({
              title: documentTitle,
              content: content,
              created_by: userId,
              updated_by: userId,
            })
            .select("id")
            .single();

          if (error) throw error;
          if (data) setBriefId(data.id);
        }

        setSaveStatus("saved");
      } catch (error) {
        console.error("Error auto-saving PPDU brief:", error);
        setSaveStatus("error");
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [content, documentTitle]);

  const handleDownload = async () => {
    try {
      const htmlContent = generateDownloadHtml(
        documentTitle,
        content
      );
      const convert = await loadHTMLToDOCX();
      const docxBlob = await convert(htmlContent, undefined, {
        table: { row: { cantSplit: true } },
        font: "Calibri",
        fontSize: 22,
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
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".docx")) {
      toast.error("Please select a .docx file");
      return;
    }

    setIsImporting(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({
        arrayBuffer,
      });

      setContent(result.value);

      const fileName = file.name.replace(/\.docx$/i, "");
      setDocumentTitle(fileName);

      if (result.messages.length > 0) {
        console.log(
          "Mammoth conversion messages:",
          result.messages
        );
      }

      toast.success("Document imported successfully");
    } catch (error) {
      console.error("Error importing document:", error);
      toast.error("Failed to import document");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleNewDocument = () => {
    setDocumentTitle("PPDU Brief");
    setContent(PPDU_BRIEF_TEMPLATE);
    setBriefId(null); // Next auto-save will create a new record
    toast.success("New PPDU Brief template created");
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-64" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-28" />
            </div>
          </div>
          <Skeleton className="h-[600px] w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx"
          onChange={handleFileImport}
          className="hidden"
        />

        <PPDUToolbar
          documentTitle={documentTitle}
          onTitleChange={setDocumentTitle}
          onDownload={handleDownload}
          onImport={handleImportClick}
          onNewDocument={handleNewDocument}
          isImporting={isImporting}
          saveStatus={saveStatus}
        />

        <Card className="shadow-lg">
          <CardContent className="p-0">
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

export default PPDUBrief;
