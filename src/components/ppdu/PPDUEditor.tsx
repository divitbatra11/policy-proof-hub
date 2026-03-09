import { useRef, useCallback, useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Undo,
  Redo,
  Table,
  Plus,
  Heading1,
  Heading2,
  Heading3,
  IndentDecrease,
  IndentIncrease,
  Link,
  Unlink,
  Quote,
  Minus,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PPDUEditorProps {
  content: string;
  onContentChange: (content: string) => void;
}

const HEADER_BG_COLOR = "#B4C6E7"; // Blue header background
const ALT_HEADER_BG_COLOR = "#D9E2F3"; // Lighter blue for alternate headers
const GREEN_BG_COLOR = "#E2EFDA"; // Green background
const YELLOW_BG_COLOR = "#FFF2CC"; // Yellow background
const RED_BG_COLOR = "#FCE4D6"; // Red/Orange background

const TEXT_COLORS = [
  { name: "Black", value: "#000000" },
  { name: "Dark Red", value: "#C00000" },
  { name: "Red", value: "#FF0000" },
  { name: "Orange", value: "#ED7D31" },
  { name: "Dark Yellow", value: "#C09100" },
  { name: "Green", value: "#00B050" },
  { name: "Dark Green", value: "#375623" },
  { name: "Teal", value: "#00B0F0" },
  { name: "Blue", value: "#0070C0" },
  { name: "Dark Blue", value: "#002060" },
  { name: "Purple", value: "#7030A0" },
];

const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#FFFF00" },
  { name: "Bright Green", value: "#00FF00" },
  { name: "Cyan", value: "#00FFFF" },
  { name: "Pink", value: "#FF00FF" },
  { name: "Light Blue", value: "#ADD8E6" },
  { name: "Light Green", value: "#90EE90" },
  { name: "Light Yellow", value: "#FFFACD" },
  { name: "None", value: "transparent" },
];

const PPDUEditor = ({ content, onContentChange }: PPDUEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  const [tableSections, setTableSections] = useState<
    { top: number; tableIndex: number; label: string }[]
  >([]);
  const savedSelectionRef = useRef<Range | null>(null);

  const normalizeUrl = useCallback((rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return "";

    // Allow common schemes and relative anchors.
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("mailto:") ||
      trimmed.startsWith("tel:") ||
      trimmed.startsWith("#")
    ) {
      return trimmed;
    }

    // If user types something like "example.com", treat it as https.
    return `https://${trimmed}`;
  }, []);

  const ensureLinkAttributes = useCallback(() => {
    if (!editorRef.current) return;
    const links =
      editorRef.current.querySelectorAll<HTMLAnchorElement>("a[href]");
    links.forEach((a) => {
      // Keep mailto/tel/# links as-is; for everything else, open in a new tab.
      const href = a.getAttribute("href") ?? "";
      if (
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("#")
      )
        return;
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });
  }, []);

  // Scan for h1/h2 headings followed by tables to position add-row buttons
  const updateTableButtons = useCallback(() => {
    if (!editorRef.current || !wrapperRef.current) return;
    const headings = editorRef.current.querySelectorAll("h1, h2");
    const editorRect = editorRef.current.getBoundingClientRect();
    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const sections: { top: number; tableIndex: number; label: string }[] = [];
    let tableIdx = 0;

    headings.forEach((heading) => {
      // Find the next sibling that is a table
      let sibling = heading.nextElementSibling;
      while (
        sibling &&
        sibling.tagName !== "TABLE" &&
        sibling.tagName !== "H1" &&
        sibling.tagName !== "H2"
      ) {
        sibling = sibling.nextElementSibling;
      }
      if (sibling?.tagName === "TABLE") {
        const headingRect = heading.getBoundingClientRect();
        sections.push({
          top: headingRect.top - wrapperRect.top + headingRect.height / 2 - 12,
          tableIndex: Array.from(
            editorRef.current!.querySelectorAll("table")
          ).indexOf(sibling as HTMLTableElement),
          label: heading.textContent || "Table",
        });
      }
    });

    setTableSections(sections);
  }, []);

  // Update button positions on content changes and scroll
  useEffect(() => {
    const timer = setTimeout(updateTableButtons, 100);
    return () => clearTimeout(timer);
  }, [content, updateTableButtons]);

  const addRowToTable = useCallback(
    (tableIndex: number) => {
      if (!editorRef.current) return;
      const tables = editorRef.current.querySelectorAll("table");
      const table = tables[tableIndex];
      if (!table) return;

      const lastRow = table.querySelector("tr:last-child");
      if (!lastRow) return;

      const newRow = document.createElement("tr");
      const cells = lastRow.querySelectorAll("td, th");
      cells.forEach((cell) => {
        const newCell = document.createElement("td");
        newCell.setAttribute(
          "style",
          (cell as HTMLElement).style.cssText.replace(
            /font-weight:\s*bold;?/gi,
            ""
          )
        );
        newCell.innerHTML = "&nbsp;";
        newRow.appendChild(newCell);
      });

      // Append to tbody or table directly
      const tbody = table.querySelector("tbody") || table;
      tbody.appendChild(newRow);

      isInternalChange.current = true;
      onContentChange(editorRef.current.innerHTML);
      setTimeout(updateTableButtons, 50);
    },
    [onContentChange, updateTableButtons]
  );

  const deleteLastRowFromTable = useCallback(
    (tableIndex: number) => {
      if (!editorRef.current) return;
      const tables = editorRef.current.querySelectorAll("table");
      const table = tables[tableIndex];
      if (!table) return;

      const rows = table.querySelectorAll("tr");
      if (rows.length <= 1) return;

      const lastRow = rows[rows.length - 1];
      lastRow.remove();

      isInternalChange.current = true;
      onContentChange(editorRef.current.innerHTML);
      setTimeout(updateTableButtons, 50);
    },
    [onContentChange, updateTableButtons]
  );

  // Only sync content from parent when it changes externally (template load, import, etc.)
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      // Strip out HTML document wrapper if present (from intake forms)
      let cleanContent = content;

      // If content contains full HTML document structure, extract only the body content
      if (content.includes("<!DOCTYPE html>") || content.includes("<html>")) {
        const bodyMatch = content.match(
          /<body[^>]*>([\s\S]*)<\/body>/i
        );
        if (bodyMatch && bodyMatch[1]) {
          cleanContent = bodyMatch[1];
        }
      }

      // Also strip out any <style> tags that might affect the parent layout
      cleanContent = cleanContent.replace(
        /<style[^>]*>[\s\S]*?<\/style>/gi,
        ""
      );

      // Strip out any embedded <button> elements (e.g. old "Add Row" buttons saved in content)
      cleanContent = cleanContent.replace(
        /<button[^>]*>[\s\S]*?<\/button>/gi,
        ""
      );

      editorRef.current.innerHTML = DOMPurify.sanitize(cleanContent, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ["style", "class", "colspan", "rowspan"],
      });
    }
  }, [content]);

  const execCommand = useCallback(
    (command: string, value?: string) => {
      document.execCommand(command, false, value);
      editorRef.current?.focus();
      if (editorRef.current) {
        isInternalChange.current = true;
        onContentChange(editorRef.current.innerHTML);
      }
    },
    [onContentChange]
  );

  const handleInput = () => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onContentChange(editorRef.current.innerHTML);
    }
  };

  const handleTableTabNavigation = useCallback(
    (backward: boolean) => {
      if (!editorRef.current) return false;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return false;

      let currentNode: Node | null = selection.anchorNode;
      if (!currentNode) return false;

      const currentElement =
        currentNode.nodeType === Node.ELEMENT_NODE
          ? (currentNode as Element)
          : currentNode.parentElement;

      const currentCell = currentElement?.closest(
        "td, th"
      ) as HTMLTableCellElement | null;
      if (!currentCell || !editorRef.current.contains(currentCell)) return false;

      const currentRow = currentCell.closest(
        "tr"
      ) as HTMLTableRowElement | null;
      const table = currentCell.closest("table") as HTMLTableElement | null;
      if (!currentRow || !table) return true;

      const rows = Array.from(table.querySelectorAll("tr"));
      const rowIndex = rows.indexOf(currentRow);
      const cellIndex = Array.from(currentRow.cells).indexOf(currentCell);
      if (rowIndex === -1 || cellIndex === -1) return true;

      let targetCell: HTMLTableCellElement | null = null;

      if (backward) {
        for (let r = rowIndex; r >= 0; r--) {
          const row = rows[r] as HTMLTableRowElement;
          if (row.cells.length === 0) continue;

          if (r === rowIndex) {
            const prevIndex = cellIndex - 1;
            if (prevIndex >= 0 && prevIndex < row.cells.length) {
              targetCell = row.cells[prevIndex] as HTMLTableCellElement;
              break;
            }
          } else {
            targetCell = row.cells[
              row.cells.length - 1
            ] as HTMLTableCellElement;
            break;
          }
        }
      } else {
        for (let r = rowIndex; r < rows.length; r++) {
          const row = rows[r] as HTMLTableRowElement;
          if (row.cells.length === 0) continue;

          if (r === rowIndex) {
            const nextIndex = cellIndex + 1;
            if (nextIndex < row.cells.length) {
              targetCell = row.cells[nextIndex] as HTMLTableCellElement;
              break;
            }
          } else {
            targetCell = row.cells[0] as HTMLTableCellElement;
            break;
          }
        }
      }

      if (!targetCell) return true;

      // Move caret to the start of the target cell
      const range = document.createRange();
      range.selectNodeContents(targetCell);
      range.collapse(true);

      selection.removeAllRanges();
      selection.addRange(range);

      return true;
    },
    []
  );

  // Ensure tables have proper styling and are editable
  const initializeEditor = useCallback(() => {
    if (!editorRef.current) return;

    // Make sure tables are properly styled
    const tables = editorRef.current.querySelectorAll("table");
    tables.forEach((table) => {
      table.style.borderCollapse = "collapse";
      table.style.width = "100%";
      table.style.margin = "16px 0";

      // Ensure cells have borders and padding
      const cells = table.querySelectorAll("td, th");
      cells.forEach((cell) => {
        (cell as HTMLElement).style.border = "1px solid #000";
        (cell as HTMLElement).style.padding = "8px";
        (cell as HTMLElement).style.verticalAlign = "top";
      });
    });

    // Ensure headings have proper styling
    const h1s = editorRef.current.querySelectorAll("h1");
    h1s.forEach((h1) => {
      (h1 as HTMLElement).style.fontSize = "24px";
      (h1 as HTMLElement).style.fontWeight = "bold";
      (h1 as HTMLElement).style.margin = "24px 0 16px 0";
    });

    const h2s = editorRef.current.querySelectorAll("h2");
    h2s.forEach((h2) => {
      (h2 as HTMLElement).style.fontSize = "18px";
      (h2 as HTMLElement).style.fontWeight = "bold";
      (h2 as HTMLElement).style.margin = "20px 0 12px 0";
    });

    const h3s = editorRef.current.querySelectorAll("h3");
    h3s.forEach((h3) => {
      (h3 as HTMLElement).style.fontSize = "14px";
      (h3 as HTMLElement).style.fontWeight = "bold";
      (h3 as HTMLElement).style.margin = "16px 0 8px 0";
    });

    // Ensure lists have proper styling
    const uls = editorRef.current.querySelectorAll("ul");
    uls.forEach((ul) => {
      (ul as HTMLElement).style.paddingLeft = "24px";
      (ul as HTMLElement).style.margin = "8px 0";
      (ul as HTMLElement).style.listStyleType = "disc";
    });

    const ols = editorRef.current.querySelectorAll("ol");
    ols.forEach((ol) => {
      (ol as HTMLElement).style.paddingLeft = "24px";
      (ol as HTMLElement).style.margin = "8px 0";
      (ol as HTMLElement).style.listStyleType = "decimal";
    });

    // Ensure blockquotes have proper styling
    const blockquotes = editorRef.current.querySelectorAll("blockquote");
    blockquotes.forEach((bq) => {
      (bq as HTMLElement).style.borderLeft = "4px solid #ccc";
      (bq as HTMLElement).style.paddingLeft = "16px";
      (bq as HTMLElement).style.margin = "16px 0";
      (bq as HTMLElement).style.fontStyle = "italic";
      (bq as HTMLElement).style.color = "#666";
    });
  }, []);

  useEffect(() => {
    initializeEditor();
    updateTableButtons();
  }, [initializeEditor, updateTableButtons]);

  const insertTable = (rows: number, cols: number) => {
    let tableHtml = '<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">';

    // Header row
    tableHtml += "<tr>";
    for (let c = 0; c < cols; c++) {
      tableHtml += `<th style="background-color: ${HEADER_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center;">Header ${c + 1}</th>`;
    }
    tableHtml += "</tr>";

    // Data rows
    for (let r = 0; r < rows - 1; r++) {
      tableHtml += "<tr>";
      for (let c = 0; c < cols; c++) {
        tableHtml += '<td style="border: 1px solid #000; padding: 8px; vertical-align: top;">&nbsp;</td>';
      }
      tableHtml += "</tr>";
    }

    tableHtml += "</table><p><br></p>";
    execCommand("insertHTML", tableHtml);
    setTimeout(updateTableButtons, 50);
  };

  const insertPPDUTable = () => {
    const tableHtml = `
      <h1 style="font-weight: bold; font-size: 24px; margin: 24px 0 16px 0;">Executive Summary</h1>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <th style="background-color: ${HEADER_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; width: 25%;">Project</th>
          <td style="border: 1px solid #000; padding: 8px;">&nbsp;</td>
        </tr>
        <tr>
          <th style="background-color: ${HEADER_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center;">Sponsor</th>
          <td style="border: 1px solid #000; padding: 8px;">&nbsp;</td>
        </tr>
        <tr>
          <th style="background-color: ${HEADER_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center;">Project Lead</th>
          <td style="border: 1px solid #000; padding: 8px;">&nbsp;</td>
        </tr>
        <tr>
          <th style="background-color: ${HEADER_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center;">Purpose</th>
          <td style="border: 1px solid #000; padding: 8px;">&nbsp;</td>
        </tr>
        <tr>
          <th style="background-color: ${HEADER_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center;">Description</th>
          <td style="border: 1px solid #000; padding: 8px;">&nbsp;</td>
        </tr>
        <tr>
          <th style="background-color: ${HEADER_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center;">Status</th>
          <td style="border: 1px solid #000; padding: 8px;">&nbsp;</td>
        </tr>
      </table>
      <p><br></p>
    `;
    execCommand("insertHTML", tableHtml);
    setTimeout(updateTableButtons, 50);
  };

  const insertExecutiveQueueTable = () => {
    const tableHtml = `
      <h1 style="font-weight: bold; font-size: 24px; margin: 24px 0 16px 0;">Executive Queue</h1>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <th style="background-color: ${HEADER_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; width: 50%;">Date</th>
          <th style="background-color: ${HEADER_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; width: 50%;">Committee / Meeting</th>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 8px; text-align: center;">&nbsp;</td>
          <td style="border: 1px solid #000; padding: 8px; text-align: center;">&nbsp;</td>
        </tr>
      </table>
      <p><br></p>
    `;
    execCommand("insertHTML", tableHtml);
    setTimeout(updateTableButtons, 50);
  };

  const insertKeyDatesTable = () => {
    const tableHtml = `
      <h2 style="font-weight: bold; font-size: 18px; margin: 24px 0 16px 0;">Key Dates</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <th style="background-color: ${HEADER_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; width: 33%;">Milestone</th>
          <th style="background-color: ${HEADER_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; width: 33%;">Target Date</th>
          <th style="background-color: ${HEADER_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; width: 34%;">Notes</th>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 8px;">&nbsp;</td>
          <td style="border: 1px solid #000; padding: 8px; text-align: center;">&nbsp;</td>
          <td style="border: 1px solid #000; padding: 8px;">&nbsp;</td>
        </tr>
      </table>
      <p><br></p>
    `;
    execCommand("insertHTML", tableHtml);
    setTimeout(updateTableButtons, 50);
  };

  const insertRisksTable = () => {
    const tableHtml = `
      <h2 style="font-weight: bold; font-size: 18px; margin: 24px 0 16px 0;">Risks and Issues</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <th style="background-color: ${RED_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; width: 10%;">#</th>
          <th style="background-color: ${RED_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; width: 50%;">Risk/Issue</th>
          <th style="background-color: ${RED_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; width: 20%;">Owner</th>
          <th style="background-color: ${RED_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; width: 20%;">Mitigation</th>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 8px; vertical-align: top; text-align: center;">1</td>
          <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">&nbsp;</td>
          <td style="border: 1px solid #000; padding: 8px; vertical-align: top; text-align: center;">&nbsp;</td>
          <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">&nbsp;</td>
        </tr>
      </table>
      <p><br></p>
    `;
    execCommand("insertHTML", tableHtml);
    setTimeout(updateTableButtons, 50);
  };

  const insertDecisionsTable = () => {
    const tableHtml = `
      <h2 style="font-weight: bold; font-size: 18px; margin: 24px 0 16px 0;">Decisions Required</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <th style="background-color: ${YELLOW_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; width: 10%;">#</th>
          <th style="background-color: ${YELLOW_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; width: 60%;">Decision</th>
          <th style="background-color: ${YELLOW_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; width: 30%;">Required By</th>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 8px; vertical-align: top; text-align: center;">1</td>
          <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">&nbsp;</td>
          <td style="border: 1px solid #000; padding: 8px; vertical-align: top; text-align: center;">&nbsp;</td>
        </tr>
      </table>
      <p><br></p>
    `;
    execCommand("insertHTML", tableHtml);
    setTimeout(updateTableButtons, 50);
  };

  const insertActionItemsTable = () => {
    const tableHtml = `
      <h2 style="font-weight: bold; font-size: 18px; margin: 24px 0 16px 0;">Action Items</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <th style="background-color: ${HEADER_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; width: 10%;">#</th>
          <th style="background-color: ${HEADER_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; width: 40%;">Action</th>
          <th style="background-color: ${HEADER_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; width: 20%;">Owner</th>
          <th style="background-color: ${HEADER_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; width: 15%;">Due Date</th>
          <th style="background-color: ${HEADER_BG_COLOR}; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; width: 15%;">Status</th>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 8px; vertical-align: top; text-align: center;">1</td>
          <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">&nbsp;</td>
          <td style="border: 1px solid #000; padding: 8px; vertical-align: top; text-align: center;">&nbsp;</td>
          <td style="border: 1px solid #000; padding: 8px; vertical-align: top; text-align: center;">&nbsp;</td>
          <td style="border: 1px solid #000; padding: 8px; vertical-align: top; text-align: center;">&nbsp;</td>
        </tr>
      </table>
      <p><br></p>
    `;
    execCommand("insertHTML", tableHtml);
  };

  const setTextColor = (color: string) => {
    execCommand("foreColor", color);
  };

  const setHighlight = (color: string) => {
    execCommand("hiliteColor", color);
  };

  const formatHeading = (level: string) => {
    execCommand("formatBlock", level);
  };

  const insertHorizontalRule = () => {
    execCommand(
      "insertHTML",
      '<hr style="border: none; border-top: 2px solid #000; margin: 16px 0;"><p><br></p>'
    );
  };

  const insertLink = () => {
    // Save current selection (prompt will typically steal focus and clear it)
    const selection = window.getSelection();
    savedSelectionRef.current =
      selection && selection.rangeCount > 0
        ? selection.getRangeAt(0).cloneRange()
        : null;

    const rawUrl = prompt("Enter URL:", "https://");
    const url = rawUrl ? normalizeUrl(rawUrl) : "";
    if (!url) return;

    // Restore selection
    const sel = window.getSelection();
    if (sel && savedSelectionRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
    }

    // If nothing was selected, insert the URL as linked text (Word-like behavior)
    const rangeIsCollapsed = savedSelectionRef.current?.collapsed ?? true;
    if (rangeIsCollapsed) {
      const safeText = url.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      execCommand(
        "insertHTML",
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${safeText}</a>`
      );
    } else {
      execCommand("createLink", url);
    }

    // Ensure links look & behave like links after insertion
    ensureLinkAttributes();

    // Persist any attribute tweaks we made above.
    if (editorRef.current) {
      isInternalChange.current = true;
      onContentChange(editorRef.current.innerHTML);
    }
  };

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
      onMouseDown={(e) => {
        // Prevent toolbar buttons from stealing focus and clearing the editor selection.
        // This is especially important for link creation.
        e.preventDefault();
      }}
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="h-8 w-8 p-0"
    >
      <Icon className="h-4 w-4" />
    </Button>
  );

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Toolbar Row 1 */}
      <div className="border-b p-2 flex flex-wrap gap-1 bg-gray-50">
        {/* Font Size */}
        <Select onValueChange={(value) => execCommand("fontSize", value)}>
          <SelectTrigger className="w-20 h-8">
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">8pt</SelectItem>
            <SelectItem value="2">10pt</SelectItem>
            <SelectItem value="3">12pt</SelectItem>
            <SelectItem value="4">14pt</SelectItem>
            <SelectItem value="5">18pt</SelectItem>
            <SelectItem value="6">24pt</SelectItem>
            <SelectItem value="7">36pt</SelectItem>
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Headings */}
        <ToolbarButton
          onClick={() => formatHeading("h1")}
          icon={Heading1}
          title="Heading 1"
        />
        <ToolbarButton
          onClick={() => formatHeading("h2")}
          icon={Heading2}
          title="Heading 2"
        />
        <ToolbarButton
          onClick={() => formatHeading("h3")}
          icon={Heading3}
          title="Heading 3"
        />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Basic Formatting */}
        <ToolbarButton onClick={() => execCommand("bold")} icon={Bold} title="Bold (Ctrl+B)" />
        <ToolbarButton onClick={() => execCommand("italic")} icon={Italic} title="Italic (Ctrl+I)" />
        <ToolbarButton onClick={() => execCommand("underline")} icon={Underline} title="Underline (Ctrl+U)" />
        <ToolbarButton onClick={() => execCommand("strikeThrough")} icon={Strikethrough} title="Strikethrough" />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Text Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Text Color">
              <span className="text-sm font-bold">A</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <p className="text-xs text-muted-foreground mb-2">Text Color</p>
            <div className="grid grid-cols-6 gap-1">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setTextColor(color.value)}
                  className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Highlight Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Highlight">
              <span className="text-sm font-bold px-1 bg-yellow-300">ab</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <p className="text-xs text-muted-foreground mb-2">Highlight Color</p>
            <div className="grid grid-cols-4 gap-1">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setHighlight(color.value)}
                  className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                  style={{
                    backgroundColor:
                      color.value === "transparent" ? "#fff" : color.value,
                  }}
                  title={color.name}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Alignment */}
        <ToolbarButton onClick={() => execCommand("justifyLeft")} icon={AlignLeft} title="Align Left" />
        <ToolbarButton onClick={() => execCommand("justifyCenter")} icon={AlignCenter} title="Center" />
        <ToolbarButton onClick={() => execCommand("justifyRight")} icon={AlignRight} title="Right" />
        <ToolbarButton onClick={() => execCommand("justifyFull")} icon={AlignJustify} title="Justify" />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Lists */}
        <ToolbarButton onClick={() => execCommand("insertUnorderedList")} icon={List} title="Bullet List" />
        <ToolbarButton onClick={() => execCommand("insertOrderedList")} icon={ListOrdered} title="Numbered List" />
        <ToolbarButton onClick={() => execCommand("indent")} icon={IndentIncrease} title="Increase Indent" />
        <ToolbarButton onClick={() => execCommand("outdent")} icon={IndentDecrease} title="Decrease Indent" />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Links & Quote */}
        <ToolbarButton onClick={insertLink} icon={Link} title="Insert Link" />
        <ToolbarButton onClick={() => execCommand("unlink")} icon={Unlink} title="Remove Link" />
        <ToolbarButton onClick={() => formatHeading("blockquote")} icon={Quote} title="Block Quote" />
        <ToolbarButton onClick={insertHorizontalRule} icon={Minus} title="Horizontal Line" />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Table Insert */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2" title="Insert Table">
              <Table className="h-4 w-4 mr-1" />
              <span className="text-xs">Tables</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuItem onClick={() => insertPPDUTable()}>
              <Plus className="h-4 w-4 mr-2" />
              Executive Summary Table
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => insertExecutiveQueueTable()}>
              <Plus className="h-4 w-4 mr-2" />
              Executive Queue Table
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => insertKeyDatesTable()}>
              <Plus className="h-4 w-4 mr-2" />
              Key Dates Table
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => insertRisksTable()}>
              <Plus className="h-4 w-4 mr-2" />
              Risks and Issues Table
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => insertDecisionsTable()}>
              <Plus className="h-4 w-4 mr-2" />
              Decisions Required Table
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => insertActionItemsTable()}>
              <Plus className="h-4 w-4 mr-2" />
              Action Items Table
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <p className="px-2 py-1 text-xs text-muted-foreground">Custom Tables</p>
            <div className="grid grid-cols-4 gap-1 p-2">
              {[2, 3, 4, 5].map((rows) => (
                <Button
                  key={rows}
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => insertTable(rows, 4)}
                >
                  {rows}×4
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1 px-2 pb-2">
              {[2, 3, 4, 5].map((rows) => (
                <Button
                  key={`3col-${rows}`}
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => insertTable(rows, 3)}
                >
                  {rows}×3
                </Button>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Undo/Redo */}
        <ToolbarButton onClick={() => execCommand("undo")} icon={Undo} title="Undo (Ctrl+Z)" />
        <ToolbarButton onClick={() => execCommand("redo")} icon={Redo} title="Redo (Ctrl+Y)" />
      </div>

      {/* Editor Area with floating add-row buttons */}
      <div ref={wrapperRef} className="relative">
        <div
          ref={editorRef}
          contentEditable
          className="min-h-[600px] max-w-full p-8 focus:outline-none overflow-x-auto [&_table]:max-w-full [&_table]:table-auto [&_a]:text-blue-600 [&_a]:underline [&_a]:cursor-pointer"
          style={{
            fontFamily: "Calibri, Arial, sans-serif",
            fontSize: "11pt",
            lineHeight: "1.5",
            width: "100%",
          }}
          onInput={handleInput}
          onClick={(e) => {
            // Word-like: Ctrl/Cmd + click opens the link; normal click keeps editing behavior.
            const target = e.target as HTMLElement | null;
            const link = target?.closest?.("a") as HTMLAnchorElement | null;
            if (!link) return;
            if (!link.getAttribute("href")) return;

            // React synthetic event doesn't type ctrlKey/metaKey on the generic Event type here.
            const mouseEvent = e as unknown as MouseEvent;
            if (mouseEvent.ctrlKey || mouseEvent.metaKey) {
              e.preventDefault();
              e.stopPropagation();
              window.open(link.href, "_blank", "noopener,noreferrer");
            }
          }}
          onPaste={(e) => {
            // Allow rich paste for tables and formatting
            const html = e.clipboardData.getData("text/html");
            if (html) {
              e.preventDefault();
              document.execCommand("insertHTML", false, html);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
              const handled = handleTableTabNavigation(e.shiftKey);
              if (handled) {
                e.preventDefault();
                return;
              }
            }

            // Handle keyboard shortcuts
            if (e.ctrlKey || e.metaKey) {
              switch (e.key.toLowerCase()) {
                case "b":
                  e.preventDefault();
                  execCommand("bold");
                  break;
                case "i":
                  e.preventDefault();
                  execCommand("italic");
                  break;
                case "u":
                  e.preventDefault();
                  execCommand("underline");
                  break;
              }
            }
          }}
        />
        {/* Floating row action buttons next to each table heading */}
        {tableSections.map((section, i) => (
          <div
            key={`${section.tableIndex}-${i}`}
            className="absolute right-3 flex items-center gap-2 z-10"
            style={{ top: section.top }}
          >
            <button
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                addRowToTable(section.tableIndex);
              }}
              title={`Add row to ${section.label}`}
            >
              <Plus className="h-3 w-3" />
              Add Row
            </button>
            <button
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors border border-destructive/20"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                deleteLastRowFromTable(section.tableIndex);
              }}
              title={`Delete last row from ${section.label}`}
            >
              <Minus className="h-3 w-3" />
              Delete Row
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PPDUEditor;