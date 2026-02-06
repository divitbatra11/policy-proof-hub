import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Download,
  Upload,
  FileText,
  Loader2,
  FilePlus,
  Check,
  AlertCircle,
} from "lucide-react";

interface PPDUToolbarProps {
  documentTitle: string;
  onTitleChange: (title: string) => void;
  onDownload: () => void;
  onImport: () => void;
  onNewDocument: () => void;
  isImporting: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
}

const PPDUToolbar = ({
  documentTitle,
  onTitleChange,
  onDownload,
  onImport,
  onNewDocument,
  isImporting,
  saveStatus,
}: PPDUToolbarProps) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <Input
          value={documentTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          className="text-xl font-semibold border-none bg-transparent px-0 focus-visible:ring-0 w-auto"
          style={{
            width: `${Math.max(200, documentTitle.length * 12)}px`,
          }}
        />
        {/* Auto-save status indicator */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Saving...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="h-3.5 w-3.5 text-green-600" />
              <span className="text-green-600">Saved</span>
            </>
          )}
          {saveStatus === "error" && (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-red-600" />
              <span className="text-red-600">Error saving</span>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onNewDocument}>
          <FilePlus className="h-4 w-4 mr-2" />
          New PPDU Brief
        </Button>
        <Button
          variant="outline"
          onClick={onImport}
          disabled={isImporting}
        >
          {isImporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          Import .docx
        </Button>
        <Button variant="outline" onClick={onDownload}>
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
      </div>
    </div>
  );
};

export default PPDUToolbar;
