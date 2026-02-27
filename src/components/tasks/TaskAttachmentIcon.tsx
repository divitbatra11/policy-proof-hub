import { Paperclip } from "lucide-react";
import { isExternalAttachmentUrl } from "@/utils/taskAttachments";
import { cn } from "@/lib/utils";

type AttachmentType =
  | "word"
  | "excel"
  | "powerpoint"
  | "pdf"
  | "link"
  | "generic";

const getExtension = (name?: string | null, path?: string | null) => {
  const candidate = (name || path || "").toString();
  const cleaned = candidate.split("?")[0].split("#")[0];
  const last = cleaned.split("/").pop() || cleaned;
  const dot = last.lastIndexOf(".");
  if (dot === -1) return "";
  return last.slice(dot + 1).toLowerCase();
};

export const getAttachmentType = (
  name?: string | null,
  path?: string | null
): AttachmentType => {
  const ext = getExtension(name, path);

  // If the filename includes an extension, trust it first.
  if (ext === "doc" || ext === "docx") return "word";
  if (ext === "xls" || ext === "xlsx") return "excel";
  if (ext === "ppt" || ext === "pptx") return "powerpoint";
  if (ext === "pdf") return "pdf";

  // If it's an external URL, use heuristics (SharePoint/OneDrive share links).
  if (path && isExternalAttachmentUrl(path)) {
    const lower = path.toLowerCase();

    // Common SharePoint/OneDrive patterns:
    // - /:w:/ => Word, /:x:/ => Excel, /:p:/ => PowerPoint
    if (lower.includes("/:w:") || lower.includes(":w:")) return "word";
    if (lower.includes("/:x:") || lower.includes(":x:")) return "excel";
    if (lower.includes("/:p:") || lower.includes(":p:")) return "powerpoint";
    if (lower.includes(".pdf")) return "pdf";

    return "link";
  }

  return "generic";
};

const TYPE_STYLE: Record<
  Exclude<AttachmentType, "generic" | "link">,
  { bg: string; label: string }
> = {
  word: { bg: "bg-[#185ABD]", label: "W" },
  excel: { bg: "bg-[#107C41]", label: "X" },
  powerpoint: { bg: "bg-[#C43E1C]", label: "P" },
  pdf: { bg: "bg-[#B30B00]", label: "PDF" },
};

export function TaskAttachmentIcon({
  name,
  path,
  className,
  size = "md",
}: {
  name?: string | null;
  path?: string | null;
  className?: string;
  size?: "sm" | "md";
}) {
  const type = getAttachmentType(name, path);
  const dim = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const text = size === "sm" ? "text-[10px]" : "text-xs";

  if (type === "generic" || type === "link") {
    return (
      <div
        className={cn(
          "rounded flex items-center justify-center border bg-muted",
          dim,
          className
        )}
      >
        <Paperclip
          className={cn(
            size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
            "text-muted-foreground"
          )}
        />
      </div>
    );
  }

  const style = TYPE_STYLE[type];
  return (
    <div
      className={cn(
        "rounded flex items-center justify-center font-bold text-white",
        style.bg,
        dim,
        text,
        className
      )}
      aria-label={`${type} attachment`}
      title={`${type.toUpperCase()} file`}
    >
      {style.label}
    </div>
  );
}