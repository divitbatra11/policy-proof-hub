import { useState, useRef, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Undo,
  Redo,
  Save,
  Download,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Upload,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import mammoth from "mammoth";

const PPDUBrief = () => {
  const [documentTitle, setDocumentTitle] = useState("Untitled Document");
  const [isImporting, setIsImporting] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }, []);

  const handleFontSize = (size: string) => {
    execCommand("fontSize", size);
  };

  const handleFontFamily = (font: string) => {
    execCommand("fontName", font);
  };

  const handleSave = () => {
    const content = editorRef.current?.innerHTML || "";
    localStorage.setItem("ppdu-brief-content", content);
    localStorage.setItem("ppdu-brief-title", documentTitle);
    toast.success("Document saved locally");
  };

  const handleDownload = () => {
    const content = editorRef.current?.innerHTML || "";
    const blob = new Blob(
      [
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${documentTitle}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
  </style>
</head>
<body>
  <h1>${documentTitle}</h1>
  ${content}
</body>
</html>`,
      ],
      { type: "text/html" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${documentTitle.replace(/\s+/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Document downloaded");
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".docx")) {
      toast.error("Please select a .docx file");
      return;
    }

    setIsImporting(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });

      if (editorRef.current) {
        editorRef.current.innerHTML = result.value;
      }

      // Set document title from filename (without extension)
      const fileName = file.name.replace(/\.docx$/i, "");
      setDocumentTitle(fileName);

      if (result.messages.length > 0) {
        console.log("Mammoth conversion messages:", result.messages);
      }

      toast.success("Document imported successfully");
    } catch (error) {
      console.error("Error importing document:", error);
      toast.error("Failed to import document");
    } finally {
      setIsImporting(false);
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Load saved content on mount
  useState(() => {
    const savedContent = localStorage.getItem("ppdu-brief-content");
    const savedTitle = localStorage.getItem("ppdu-brief-title");
    if (savedContent && editorRef.current) {
      editorRef.current.innerHTML = savedContent;
    }
    if (savedTitle) {
      setDocumentTitle(savedTitle);
    }
  });

  const ToolbarButton = ({
    onClick,
    icon: Icon,
    title,
    disabled,
  }: {
    onClick: () => void;
    icon: React.ElementType;
    title: string;
    disabled?: boolean;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="h-8 w-8 p-0"
    >
      <Icon className="h-4 w-4" />
    </Button>
  );

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <Input
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              className="text-xl font-semibold border-none bg-transparent px-0 focus-visible:ring-0 w-auto"
              style={{ width: `${Math.max(200, documentTitle.length * 12)}px` }}
            />
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              onChange={handleFileImport}
              className="hidden"
            />
            <Button variant="outline" onClick={handleImportClick} disabled={isImporting}>
              {isImporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Import .docx
            </Button>
            <Button variant="outline" onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="pb-2">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 bg-muted/50 rounded-lg p-2">
              {/* Font Family */}
              <Select onValueChange={handleFontFamily} defaultValue="Arial">
                <SelectTrigger className="w-32 h-8">
                  <SelectValue placeholder="Font" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Arial">Arial</SelectItem>
                  <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                  <SelectItem value="Georgia">Georgia</SelectItem>
                  <SelectItem value="Verdana">Verdana</SelectItem>
                  <SelectItem value="Courier New">Courier New</SelectItem>
                </SelectContent>
              </Select>

              {/* Font Size */}
              <Select onValueChange={handleFontSize} defaultValue="3">
                <SelectTrigger className="w-20 h-8">
                  <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">8</SelectItem>
                  <SelectItem value="2">10</SelectItem>
                  <SelectItem value="3">12</SelectItem>
                  <SelectItem value="4">14</SelectItem>
                  <SelectItem value="5">18</SelectItem>
                  <SelectItem value="6">24</SelectItem>
                  <SelectItem value="7">36</SelectItem>
                </SelectContent>
              </Select>

              <Separator orientation="vertical" className="h-6 mx-1" />

              {/* Headings */}
              <ToolbarButton
                onClick={() => execCommand("formatBlock", "h1")}
                icon={Heading1}
                title="Heading 1"
              />
              <ToolbarButton
                onClick={() => execCommand("formatBlock", "h2")}
                icon={Heading2}
                title="Heading 2"
              />
              <ToolbarButton
                onClick={() => execCommand("formatBlock", "h3")}
                icon={Heading3}
                title="Heading 3"
              />

              <Separator orientation="vertical" className="h-6 mx-1" />

              {/* Text Formatting */}
              <ToolbarButton
                onClick={() => execCommand("bold")}
                icon={Bold}
                title="Bold (Ctrl+B)"
              />
              <ToolbarButton
                onClick={() => execCommand("italic")}
                icon={Italic}
                title="Italic (Ctrl+I)"
              />
              <ToolbarButton
                onClick={() => execCommand("underline")}
                icon={Underline}
                title="Underline (Ctrl+U)"
              />

              <Separator orientation="vertical" className="h-6 mx-1" />

              {/* Alignment */}
              <ToolbarButton
                onClick={() => execCommand("justifyLeft")}
                icon={AlignLeft}
                title="Align Left"
              />
              <ToolbarButton
                onClick={() => execCommand("justifyCenter")}
                icon={AlignCenter}
                title="Align Center"
              />
              <ToolbarButton
                onClick={() => execCommand("justifyRight")}
                icon={AlignRight}
                title="Align Right"
              />
              <ToolbarButton
                onClick={() => execCommand("justifyFull")}
                icon={AlignJustify}
                title="Justify"
              />

              <Separator orientation="vertical" className="h-6 mx-1" />

              {/* Lists */}
              <ToolbarButton
                onClick={() => execCommand("insertUnorderedList")}
                icon={List}
                title="Bullet List"
              />
              <ToolbarButton
                onClick={() => execCommand("insertOrderedList")}
                icon={ListOrdered}
                title="Numbered List"
              />

              <Separator orientation="vertical" className="h-6 mx-1" />

              {/* Undo/Redo */}
              <ToolbarButton
                onClick={() => execCommand("undo")}
                icon={Undo}
                title="Undo (Ctrl+Z)"
              />
              <ToolbarButton
                onClick={() => execCommand("redo")}
                icon={Redo}
                title="Redo (Ctrl+Y)"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Editor Area */}
            <div
              ref={editorRef}
              contentEditable
              className="min-h-[600px] p-8 focus:outline-none prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-card border-t"
              style={{
                fontFamily: "Arial, sans-serif",
                lineHeight: "1.6",
              }}
              onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData.getData("text/plain");
                document.execCommand("insertText", false, text);
              }}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PPDUBrief;
