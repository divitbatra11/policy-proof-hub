// src/pages/UploadPolicyDocs.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import * as mammoth from "mammoth";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";

const sanitize = DOMPurify.sanitize;
const PDF_FOOTER_RESERVED_MM = 12; // reserve space for footer on every page
const HEADER_BRAND_COL_MM = 60;    // width of logo/brand column in header table
const FOOTER_TEXT = "Classification: Protected B";
const FOOTER_BLUE_RGB: [number, number, number] = [0, 135, 190]; // same blue you used in header text
const BRANCH_TEXT = "Community Corrections Branch";

function stripLegacyGovHeader(html: string) {
  let out = html;

  // Remove a header table that contains SECTION/NUMBER/SUBJECT/PAGE near the top
  out = out.replace(/<table[\s\S]*?<\/table>/gi, (tbl, _m, offset) => {
    if (offset > 6000) return tbl;
    const t = tbl.toLowerCase();
    if (t.includes("section") && t.includes("number") && t.includes("subject") && t.includes("page")) return "";
    return tbl;
  });

  // Remove common GoA header lines near the top
  out = out.replace(
    /<p[^>]*>\s*(alberta|government of alberta|public safety and emergency services)[\s\S]*?<\/p>/gi,
    (p, _g, offset) => (offset < 6000 ? "" : p)
  );

  // Remove an initial logo image if it’s part of the old header
  out = out.replace(/^\s*(?:<p[^>]*>\s*)?<img[^>]*>\s*(?:<\/p>)?/i, "");

  return out;
}

const ALBERTA_LOGO_URL = "/alberta-logo.png"; // put logo in /public
const DRAW_DEPARTMENT_TEXT = false;

const PDF_BASE_MARGIN_MM = 15;
const PDF_HEADER_RESERVED_MM = 30; // space at top of every page for the header
const META_TABLE_WIDTH_MM = 110;
const META_NARROW_COL_MM = 30;
const PDF_HEADER_GAP_MM = 8; // extra breathing room below the header on every page


const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
async function waitForIframeAssets(iframe: HTMLIFrameElement) {
  const doc = iframe.contentDocument;
  if (!doc) return;

  // Wait for fonts (if supported)
  // @ts-ignore
  if (doc.fonts?.ready) {
    try {
      // @ts-ignore
      await doc.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  // Wait for images
  const imgs = Array.from(doc.images || []);
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );
}

async function getImageAspect(dataUrl: string): Promise<number> {
  return await new Promise<number>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight || 3);
    img.onerror = () => resolve(3);
    img.src = dataUrl;
  });
}
function ensureBlankLineAfterPolicyStatement(html: string) {
  const re = /<h2>\s*Policy Statement\s*<\/h2>/i;
  const m = html.match(re);
  if (!m) return html;

  const start = html.search(re);
  if (start < 0) return html;

  const end = start + m[0].length;
  const after = html.slice(end);
  const afterTrim = after.replace(/^\s+/, "");

  // If the very next thing is already a blank paragraph, do nothing
  const blankP = /^<p[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/i;
  if (blankP.test(afterTrim)) return html;

  // Otherwise insert a single blank line
  return html.slice(0, end) + "<p>&nbsp;</p>" + after;
}

function normalizeListTypes(html: string) {
  let out = html;

  // Ensure all <ol> that look numbered or lettered stay as <ol>
  out = out.replace(/<ol\b[^>]*>/gi, (match) => {
    if (/type\s*=\s*["']?[1aAiI]["']?/i.test(match)) return match; // already typed
    if (/list-style-type\s*:\s*(decimal|lower-alpha|upper-alpha|lower-roman|upper-roman)/i.test(match)) return match;
    return match.replace(/<ol/i, '<ol type="1"'); // default numeric type
  });

  // Only convert <ol> to <ul> if it has no numbering or markers
  out = out.replace(/<ol\b([^>]*)>/gi, (m, attrs) => {
    if (/list-style-type|type\s*=/i.test(attrs)) return `<ol${attrs}>`;
    return `<ul${attrs}>`;
  });

  // Clean up double-empty list items
  out = out.replace(/<li>\s*<\/li>/g, '');

  return out;
}

function applyIndentBasedLists(html: string) {
  return html.replace(
    /<p([^>]*)style="([^"]*)"([^>]*)>(.*?)<\/p>/gi,
    (full, pre, style, post, content) => {
      const marginMatch = style.match(/margin-left:\s*([\d.]+)(px|pt|in|cm|mm)/i);
      if (!marginMatch) return full;

      const value = parseFloat(marginMatch[1]);

      let level = 0;
      if (value >= 80) level = 2;
      else if (value >= 40) level = 1;

      return `<p class="policy-li level-${level}">${content}</p>`;
    }
  );
}

/**
 * Extract the line starting with "Effective Date" from the body HTML.
 * Handles:
 *  - Entire <p> whose text starts with "Effective Date"
 *  - A <br>-separated line inside a <p>
 *  - Text wrapped in inline tags like <strong>, <span>, <em>
 * Returns { cleaned, effectiveDate } with that line removed from the HTML.
 */
function extractEffectiveDate(html: string): { cleaned: string; effectiveDate: string } {
  let effectiveDate = "";

  // Helper: strip HTML tags to get plain text
  const stripTags = (s: string) => s.replace(/<[^>]*>/g, "").trim();

  let cleaned = html;

  // 1) Try: entire <p> whose visible text starts with "Effective Date"
  cleaned = cleaned.replace(
    /<p[^>]*>([\s\S]*?)<\/p>/gi,
    (match, inner) => {
      const plain = stripTags(inner);
      if (/^Effective\s+Date/i.test(plain) && !effectiveDate) {
        effectiveDate = plain;
        return "";
      }
      return match;
    }
  );

  if (effectiveDate) return { cleaned, effectiveDate };

  // 2) Try: a <br>-separated line inside a <p>
  cleaned = html; // reset
  cleaned = cleaned.replace(
    /<p[^>]*>([\s\S]*?)<\/p>/gi,
    (match, inner: string) => {
      // Split on <br> variants
      const lines = inner.split(/<br\s*\/?>/i);
      const idx = lines.findIndex((ln: string) => /Effective\s+Date/i.test(stripTags(ln)));
      if (idx !== -1 && !effectiveDate) {
        effectiveDate = stripTags(lines[idx]);
        lines.splice(idx, 1);
        const remaining = lines.filter((l: string) => stripTags(l)).join("<br/>");
        return remaining ? `<p>${remaining}</p>` : "";
      }
      return match;
    }
  );

  return { cleaned, effectiveDate };
}

function drawAlbertaFooter(pdf: any, text: string, effectiveDateText?: string) {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const marginX = PDF_BASE_MARGIN_MM;

  // top of reserved footer area
  const footerTopY = pageH - (PDF_BASE_MARGIN_MM + PDF_FOOTER_RESERVED_MM);

  const yLine = footerTopY + 2.2;

  pdf.setDrawColor(...FOOTER_BLUE_RGB);
  pdf.setLineWidth(0.6);
  pdf.line(marginX, yLine, pageW - marginX, yLine);

  let yText = yLine + 5.5;

  // If this is the last page and we have an effective date, render it bolded above classification
  if (effectiveDateText) {
    pdf.setFont("times", "bold");
    pdf.setFontSize(10.5);
    pdf.setTextColor(20, 20, 20);
    pdf.text(effectiveDateText, marginX, yText);
    yText += 4.5;
  }

  pdf.setFont("times", "normal");
  pdf.setFontSize(10.5);
  pdf.setTextColor(20, 20, 20);
  pdf.text(text, marginX, yText);
}

function drawAlbertaHeader(
  pdf: any,
  pageNum: number,
  total: number,
  meta: { section: string; number: string; subject: string },
  logo?: { dataUrl: string; aspect: number } | null
) {
  const pageW = pdf.internal.pageSize.getWidth();

  const marginX = PDF_BASE_MARGIN_MM;
  const topY = PDF_BASE_MARGIN_MM;

  // Total usable content width (matches your 180mm "doc" width on A4 with 15mm margins)
  const contentW = pageW - marginX * 2;

  // Keep your existing meta sizing
  const narrowW = META_NARROW_COL_MM;     // right-most column (NUMBER / PAGE)
  const metaW = META_TABLE_WIDTH_MM;      // middle+right combined width (SECTION + NUMBER)
  const midW = metaW - narrowW;           // SECTION column width
  const brandW = Math.max(35, contentW - metaW); // left logo/brand column width

  const rowH = 15;
  const tableH = rowH * 2;

  const tableX = marginX;
  const tableY = topY + 2;

  // Column boundaries
  const xBrandEnd = tableX + brandW;
  const xNarrowStart = tableX + brandW + midW; // start of NUMBER/PAGE col

  // ---- Borders (full-width header table) ----
    // ---- Borders (full-width header table) ----
  pdf.setDrawColor(120, 120, 120);
  pdf.setLineWidth(0.2);

  const x0 = tableX;
  const x1 = tableX + contentW;
  const y0 = tableY;
  const y1 = tableY + tableH;

  // ✅ TOP border: start at SECTION cell (not above logo)
  pdf.line(xBrandEnd, y0, x1, y0);

  // ✅ RIGHT border: full height
  pdf.line(x1, y0, x1, y1);

  // ✅ BOTTOM border: full width (keeps SUBJECT row boxed at bottom)
  pdf.line(x0, y1, x1, y1);

  // ✅ Row divider (between top row and SUBJECT row): full width
  pdf.line(x0, y0 + rowH, x1, y0 + rowH);

  // ✅ Divider before NUMBER/PAGE column: full height
  pdf.line(xNarrowStart, y0, xNarrowStart, y1);

  // ✅ Divider between logo col and SECTION col: ONLY top row
  // (SUBJECT spans under logo)
  pdf.line(xBrandEnd, y0, xBrandEnd, y0 + rowH);
  // ✅ Left border ONLY for the SUBJECT row (do NOT draw beside the logo in top row)
  pdf.line(x0, y0 + rowH, x0, y1);



  // ---- Logo + Dept text in TOP-LEFT cell ----
  const cellPad = 2;

  let logoH = 12.5;
  let logoW = 0;

  if (logo?.dataUrl) {
    const aspect = logo.aspect || 3;
    logoW = logoH * aspect;

    // Reserve some space for dept text in the brand cell (tuned for this layout)
    const deptBlockW = DRAW_DEPARTMENT_TEXT ? 34 : 0;
    const gapAfterLogo = DRAW_DEPARTMENT_TEXT ? 2.5 : 0;

    const maxLogoW = Math.max(16, brandW - cellPad * 2 - deptBlockW - gapAfterLogo);
    if (logoW > maxLogoW) {
      const s = maxLogoW / logoW;
      logoW = maxLogoW;
      logoH = logoH * s;
    }

    const logoX = tableX + cellPad;
    const logoY = tableY + (rowH - logoH) / 2;

    try {
      pdf.addImage(logo.dataUrl, "PNG", logoX, logoY, logoW, logoH);
    } catch {
      // ignore
    }

    if (DRAW_DEPARTMENT_TEXT) {
      const deptX = logoX + logoW + 2.5;

      // baseline inside the cell (keep within rowH=15)
      const deptY = tableY + 6.2;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(0, 135, 190);
      pdf.text("Public Safety and", deptX, deptY);
      pdf.text("Emergency Services", deptX, deptY + 4.1);

      // Branch line (grey)
      pdf.setFontSize(7.5);
      pdf.setTextColor(140, 140, 140);
      pdf.text("Community Corrections Branch", deptX, deptY + 8.1);
    }
  }

  // ---- Labels ----
  const labelY = 4.2;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(60, 60, 60);

  // SECTION label in middle cell (top row)
  pdf.text("SECTION", xBrandEnd + 2, tableY + labelY);

  // NUMBER label in narrow cell (top row)
  pdf.text("NUMBER", xNarrowStart + narrowW / 2, tableY + labelY, { align: "center" });

  // SUBJECT label spans under logo (bottom row, left+middle)
  pdf.text("SUBJECT", tableX + 2, tableY + rowH + labelY);

  // PAGE label in narrow cell (bottom row)
  pdf.text("PAGE", xNarrowStart + narrowW / 2, tableY + rowH + labelY, { align: "center" });

  // ---- Values (pushed down so they never overlap labels) ----
  const valueY = 10.6;
  const lineGap = 4.3;

  const sectionText = (meta.section || "").trim();
  const numberText = (meta.number || "").trim();
  const subjectText = (meta.subject || "").trim();

  // Section / Subject in grey
  pdf.setFont("times", "bold");
  pdf.setFontSize(10.5);
  pdf.setTextColor(110, 110, 110);

  const sectionLines = pdf.splitTextToSize(sectionText, midW - 4).slice(0, 2);
  sectionLines.forEach((ln: string, idx: number) => {
    pdf.text(ln, xBrandEnd + 2, tableY + valueY + idx * lineGap);
  });

  const subjectSpanW = brandW + midW;
  const subjectLines = pdf.splitTextToSize(subjectText, subjectSpanW - 4).slice(0, 2);
  subjectLines.forEach((ln: string, idx: number) => {
    pdf.text(ln, tableX + 2, tableY + rowH + valueY + idx * lineGap);
  });

  // Number in black (top-right cell)
  pdf.setFont("times", "bold");
  pdf.setFontSize(10.5);
  pdf.setTextColor(20, 20, 20);
  pdf.text(numberText, xNarrowStart + narrowW / 2, tableY + valueY, { align: "center" });

  // Page X of Y in black (bottom-right cell)
  pdf.setFont("times", "normal");
  pdf.setFontSize(10.5);
  pdf.setTextColor(20, 20, 20);
  pdf.text(`${pageNum} of ${total}`, xNarrowStart + narrowW / 2, tableY + rowH + valueY, { align: "center" });
}


// ------------------------------
// Helpers
// Helpers
// ------------------------------
function toTitleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]!)
  );
}

function extractPolicyMeta(rawText: string) {
  const grab = (label: string) => {
    const re = new RegExp(`^\\s*${label}\\s*\\n?\\s*(.+)$`, "im");
    const m = rawText.match(re);
    return m?.[1]?.trim() ?? "";
  };
  const section = grab("SECTION");
  const number = grab("NUMBER");
  const subject = grab("SUBJECT");
  return { section, number, subject };
}

/**
 * When Mammoth splits a numbered list around non-list content (e.g. a "Note:"
 * paragraph), each new <ol> restarts at 1.  This function physically merges
 * consecutive top-level <ol> blocks into a single <ol>, embedding the
 * interrupting content (like "Note:") as a non-counted <li> so the counter
 * keeps running uninterrupted.
 *
 * Resets happen when:
 *  - A heading (<h1>–<h6>) appears between lists (new section)
 */
function continueOlNumbering(html: string): string {
  // Tokenise: split the HTML into top-level <ol>…</ol> blocks and everything else.
  // Must handle nested <ol> correctly by counting open/close tags.
  const parts: { type: "ol" | "other"; text: string }[] = [];

  // Find all top-level <ol>…</ol> blocks, respecting nesting
  let cursor = 0;
  const openRe = /<ol\b[^>]*>/gi;
  let om: RegExpExecArray | null;

  while ((om = openRe.exec(html)) !== null) {
    const olStart = om.index;

    // Find the matching </ol> by counting nesting depth
    let depth = 1;
    let pos = olStart + om[0].length;
    while (depth > 0 && pos < html.length) {
      const nextOpen = html.indexOf("<ol", pos);
      const nextClose = html.indexOf("</ol>", pos);

      if (nextClose === -1) break; // malformed, stop

      if (nextOpen !== -1 && nextOpen < nextClose) {
        // Check it's actually an <ol tag (not e.g. <olive)
        const afterTag = html[nextOpen + 3];
        if (afterTag === ">" || afterTag === " " || afterTag === "\t" || afterTag === "\n") {
          depth++;
          pos = nextOpen + 3;
        } else {
          pos = nextOpen + 3;
        }
      } else {
        depth--;
        if (depth === 0) {
          const olEnd = nextClose + 5; // length of "</ol>"

          // Push any content before this <ol> as "other"
          if (olStart > cursor) {
            parts.push({ type: "other", text: html.slice(cursor, olStart) });
          }
          parts.push({ type: "ol", text: html.slice(olStart, olEnd) });
          cursor = olEnd;
          openRe.lastIndex = olEnd; // resume regex after this block
          break;
        } else {
          pos = nextClose + 5;
        }
      }
    }
  }
  if (cursor < html.length) {
    parts.push({ type: "other", text: html.slice(cursor) });
  }

  // Extract the inner content of an <ol>…</ol> (the <li> items)
  function olInner(ol: string): string {
    return ol.replace(/^<ol\b[^>]*>/i, "").replace(/<\/ol>\s*$/i, "");
  }

  // Build merged output by grouping consecutive <ol> runs
  const result: string[] = [];
  let i = 0;

  while (i < parts.length) {
    if (parts[i].type !== "ol") {
      result.push(parts[i].text);
      i++;
      continue;
    }

    // Start of a run: collect the first <ol>'s opening tag and inner items
    const openTag = parts[i].text.match(/^<ol\b[^>]*>/i)?.[0] ?? "<ol>";
    const runParts: string[] = [olInner(parts[i].text)];
    i++;

    // Absorb subsequent <ol> blocks separated by non-heading content
    while (i < parts.length) {
      if (parts[i].type === "other") {
        const sep = parts[i].text.trim();
        // If it's a heading or empty, break the run
        if (!sep || /<h[1-6]\b/i.test(sep)) break;

        // Check if the next part after this separator is another <ol>
        if (i + 1 < parts.length && parts[i + 1].type === "ol") {
          // Embed the separator as a non-counted item inside the list
          runParts.push(
            `<li style="display:block; list-style:none; padding-left:0; counter-increment:none">${sep}</li>`
          );
          i++; // skip the "other"
          // Now absorb the next <ol>'s items
          runParts.push(olInner(parts[i].text));
          i++;
        } else {
          break;
        }
      } else {
        // Another <ol> immediately adjacent (no separator)
        runParts.push(olInner(parts[i].text));
        i++;
      }
    }

    result.push(openTag + runParts.join("") + "</ol>");
  }

  return result.join("");
}

function normalizePolicyHtml(html: string) {
  let clean = html;

  clean = stripLegacyGovHeader(clean);

  // ✅ keep real <ul>/<ol>/<li> from Mammoth (and normalize ordered list types)
  clean = normalizeListTypes(clean);

  // ✅ Continue <ol> numbering across interruptions (e.g. "Note:" paragraphs)
  clean = continueOlNumbering(clean);

  clean = clean.replace(/Classification:\s*Protected\s+[AB]\s*/gi, "");
  clean = clean.replace(/(<p>\s*<\/p>){2,}/g, "<p>&nbsp;</p>");
  clean = clean.replace(
    /<p>(POLICY STATEMENT|DEFINITIONS|STANDARDS|PROCEDURES|SCOPE|PURPOSE|BACKGROUND|RESPONSIBILITIES):?\s*<\/p>/gi,
    (_, cap: string) => `<h2>${toTitleCase(cap)}</h2>`
  );
  clean = ensureBlankLineAfterPolicyStatement(clean);
  clean = clean.replace(/<ul>([\s\S]*?)<\/ul>/g, (m) => m.replace(/<p>\s*<\/p>/g, ""));
  clean = sanitize(clean, { USE_PROFILES: { html: true }, ADD_ATTR: ["start", "style"] });
  return clean;
}





function wrapWithPolicyTemplate(opts: {
  section?: string;
  number?: string;
  subject?: string;
  bodyHtml: string;
  mode?: "pdf" | "preview";
  drawDepartmentText?: boolean;
}) {
  const drawDept = opts.drawDepartmentText ?? true;
  const { section, number, subject, bodyHtml } = opts;
  const mode = opts.mode ?? "pdf";

  // In PDF mode, we use a fixed header and reserve space for it via html2pdf top margin.
  // The header is "pulled up" into the reserved margin using a negative top offset.
  const headerPositionCss =
    mode === "pdf"
      ? `position: fixed; top: -${PDF_HEADER_RESERVED_MM}mm; left: 50%; transform: translateX(-50%); width: 180mm; z-index: 50;`
      : `position: sticky; top: 0; width: 100%; z-index: 50; background: white;`;

  const css = `
    <style>
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: "Times New Roman", Times, serif;
        color: #111827;
        background: white;
      }
      /* A4 width is 210mm; we render to 180mm content (with 15mm margins). */
      .doc { width: 180mm; margin: 0 auto; }

      /* Header (Alberta-style) */
      .gov-brand { display: flex; align-items: flex-start; gap: 4mm; }
      .gov-brand img { height: 16mm; width: auto; display: block; }

      .gov-brand .dept {
        font-size: 11px;
        line-height: 1.12;
        color: #0ea5e9;
        font-weight: 500;
        white-space: nowrap;
      }
      .gov-brand .branch {
        margin-top: 1.2mm;
        font-size: 9px;
        color: #6b7280;
        font-weight: 500;
      }

      .gov-meta { flex: 0 0 auto; }
      table.meta-table {
        width: ${META_TABLE_WIDTH_MM}mm;
        border-collapse: collapse;
        border: 1px solid #6b7280;
        font-family: "Times New Roman", Times, serif;
        background: white;
      }
      table.meta-table td {
        border: 1px solid #6b7280;
        padding: 1.6mm 2.4mm;
        vertical-align: top;
      }
      td.wide { width: ${META_TABLE_WIDTH_MM - META_NARROW_COL_MM}mm; }
      td.narrow { width: ${META_NARROW_COL_MM}mm; text-align: center; }
      table.header-table {
        width: 180mm;
        border-collapse: collapse;
        border: 1px solid #6b7280;
        font-family: "Times New Roman", Times, serif;
        background: white;
      }
      table.header-table td {
        border: 1px solid #6b7280;
        padding: 1.6mm 2.4mm;
        vertical-align: top;
      }
      td.brand-td { padding: 1.8mm 2.4mm; }

      .cell-label {
        font-family: "Times New Roman", Times, serif;
        font-size: 9px;
        font-weight: 700;
        color: #374151;
        letter-spacing: 0.02em;
      }
      .cell-value {
        margin-top: 1.2mm;
        font-size: 12px;
        font-weight: 700;
        color: #6b7280; /* grey like your screenshot */
        line-height: 1.15;
      }
      .cell-value.number { color: #111827; font-weight: 600; }
      .cell-value.page { color: #111827; font-weight: 500; min-height: 4mm; }

      /* Give the preview a little breathing room */
      body.preview .doc { padding: 8mm 0; }

      /* Main content typography */
      h1, h2, h3 { color: #0f172a; }
      h1 { font-size: 22px; margin: 18px 0 10px; }
      h2 { font-size: 18px; margin: 16px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
      h3 { font-size: 16px; margin: 12px 0 6px; }
      p { line-height: 1.5; margin: 8px 0; }
      /* ===== PDF-SAFE LIST MARKERS (html2canvas drops native ::marker) ===== */
      ul, ol {
        margin: 8px 0 8px 22px;
        padding-left: 0;
        list-style: none;              /* prevent double markers in browser */
        list-style-position: outside;
      }

      li {
        margin: 3px 0;
        position: relative;
        padding-left: 1.45em;          /* room for our marker */
        line-height: 1.5;
      }

      /* Bullets */
      ul > li::before {
        content: "•";
        position: absolute;
        left: 0;
        top: 0;
      }

      /* Ordered lists: level 1 = 1., 2., 3. */
      ol { counter-reset: ol1; }
      ol > li { counter-increment: ol1; }
      ol > li::before {
        content: counter(ol1) ". ";
        position: absolute;
        left: 0;
        top: 0;
        font-weight: 600;
      }

      /* Non-counted items embedded in merged lists (e.g. Note: paragraphs) */
      li[style*="counter-increment"] {
        counter-increment: none !important;
        padding-left: 0;
        margin-left: -22px;
      }
      li[style*="counter-increment"]::before {
        content: none !important;
      }

      /* Ordered lists: level 2 = a., b., c. */
      ol ol { counter-reset: ol2; margin-left: 22px; }
      ol ol > li { counter-increment: ol2; }
      ol ol > li::before {
        content: counter(ol2, lower-alpha) ". ";
        position: absolute;
        left: 0;
        top: 0;
        font-weight: 400;
      }

      /* Ordered lists: level 3 = i., ii., iii. */
      ol ol ol { counter-reset: ol3; margin-left: 22px; }
      ol ol ol > li { counter-increment: ol3; }
      ol ol ol > li::before {
        content: counter(ol3, lower-roman) ". ";
        position: absolute;
        left: 0;
        top: 0;
        font-weight: 400;
      }

      /* If Mammoth ever sets explicit types, respect them at top level */
      ol[type="a"] { counter-reset: ola; }
      ol[type="a"] > li { counter-increment: ola; }
      ol[type="a"] > li::before { content: counter(ola, lower-alpha) ". "; }

      ol[type="A"] { counter-reset: olA; }
      ol[type="A"] > li { counter-increment: olA; }
      ol[type="A"] > li::before { content: counter(olA, upper-alpha) ". "; }

      ol[type="i"] { counter-reset: oli; }
      ol[type="i"] > li { counter-increment: oli; }
      ol[type="i"] > li::before { content: counter(oli, lower-roman) ". "; }

      ol[type="I"] { counter-reset: olI; }
      ol[type="I"] > li { counter-increment: olI; }
      ol[type="I"] > li::before { content: counter(olI, upper-roman) ". "; }


      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
      img { max-width: 100%; height: auto; }

      /* Pagination controls */
      /* Pagination controls: allow flowing text/lists; protect headings + table rows */
      h2, h3, table, thead, tbody, tr, td, th {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      /* Allow lists to split across pages */
      ul, ol {
        break-inside: auto;
        page-break-inside: auto;
      }

      /* But avoid splitting a single list item across pages */
      li {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .page-break {
        break-before: page;
        page-break-before: always;
        height: 0; border: 0; margin: 0; padding: 0;
      }
    </style>
  `;

    const headerHtml = `
    <div class="gov-header">
      <div class="doc">
        <table class="header-table" role="presentation" aria-hidden="true">
          <colgroup>
            <col style="width:${HEADER_BRAND_COL_MM}mm;" />
            <col style="width:${180 - HEADER_BRAND_COL_MM - META_NARROW_COL_MM}mm;" />
            <col style="width:${META_NARROW_COL_MM}mm;" />
          </colgroup>

          <tr>
            <td class="brand-td">
              <div class="gov-brand">
                <img src="${escapeHtml(ALBERTA_LOGO_URL)}" alt="Alberta" crossorigin="anonymous" />
                ${
                  drawDept
                    ? `<div class="dept">
                        Public Safety and<br/>Emergency Services
                        <div class="branch">${escapeHtml(BRANCH_TEXT)}</div>
                      </div>`
                    : ``
                }
              </div>
            </td>

            <td class="wide">
              <div class="cell-label">SECTION</div>
              <div class="cell-value">${escapeHtml(section || "")}</div>
            </td>

            <td class="narrow">
              <div class="cell-label">NUMBER</div>
              <div class="cell-value number">${escapeHtml(number || "")}</div>
            </td>
          </tr>

          <tr>
            <!-- ✅ SUBJECT spans under logo by using colspan=2 -->
            <td class="wide" colspan="2">
              <div class="cell-label">SUBJECT</div>
              <div class="cell-value">${escapeHtml(subject || "")}</div>
            </td>

            <td class="narrow">
              <div class="cell-label">PAGE</div>
              <div class="cell-value page">&nbsp;</div>
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;


  const showHeader = mode === "preview";

  return `<!doctype html>
<html>
  <head><meta charset="utf-8" />${css}</head>
  <body class="${mode}">
    ${showHeader ? headerHtml : ""}   <!-- IMPORTANT -->
    <div class="doc policy-content">
      ${bodyHtml}
    </div>
  </body>
</html>`;
}

function makePdfName(originalName: string, number?: string, subject?: string) {
  const base = (subject?.trim() || originalName.replace(/\.docx$/i, "")).replace(/[^\w\s-]+/g, "");
  const num = (number || "").replace(/[^\w.-]+/g, "");
  const safe = `${num ? num + "_" : ""}${base}`.trim().replace(/\s+/g, "_");
  return `${safe || "policy"}.pdf`;
}

// ------------------------------
// Component
// ------------------------------
const UploadPolicyDocs = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const policyIdFromUrl = (searchParams.get("policyId") || "").trim();
  const lockedToPolicy = !!policyIdFromUrl;
  const isPdfMode = searchParams.get("mode") === "pdf";

  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docHtml, setDocHtml] = useState<string>("");
  const [section, setSection] = useState("");
  const [number, setNumber] = useState("");
  const [subject, setSubject] = useState("");

  // Optional: attach to existing policy; if empty we auto-create one
  const [policyId, setPolicyId] = useState<string>("");
  const [versionNumber, setVersionNumber] = useState<number>(1);
  const [effectiveDate, setEffectiveDate] = useState<string>("");

  const previewRef = useRef<HTMLDivElement>(null);
  

  useEffect(() => {
    if (!policyIdFromUrl) return;

    if (!isUuid(policyIdFromUrl)) {
      toast.error("Invalid policyId in URL");
      return;
    }

    (async () => {
      // Verify policy exists, then prepopulate Policy ID
      const { data: pol, error: polErr } = await supabase
        .from("policies")
        .select("id")
        .eq("id", policyIdFromUrl)
        .maybeSingle();

      if (polErr || !pol) {
        toast.error("Target policy not found.");
        return;
      }

      setPolicyId(pol.id);

      // Set next version number
      const { data, error } = await supabase
        .from("policy_versions")
        .select("version_number")
        .eq("policy_id", pol.id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error) setVersionNumber((data?.version_number ?? 0) + 1);
    })();
  }, [policyIdFromUrl]);

  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;

    if (isPdfMode) {
      if (!f.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Please select a .pdf file");
        return;
      }
      setFile(f);
      setUploadComplete(false);
      toast.success("PDF selected. Fill in header fields, then click Upload PDF.");
      return;
    }

    if (!f.name.toLowerCase().endsWith(".docx")) {
      toast.error("Please select a .docx file");
      return;
    }
    setFile(f);
    setUploadComplete(false);

    try {
      console.log("[UploadPolicyDocs] Reading .docx…");
      const arrayBuffer = await f.arrayBuffer();

      const { value: html, messages } = await mammoth.convertToHtml(
        { arrayBuffer },
        { includeDefaultStyleMap: true }
      );
      const { value: rawText } = await mammoth.extractRawText({ arrayBuffer });
      const meta = extractPolicyMeta(rawText);
      setSection(meta.section);
      setNumber(meta.number);
      setSubject(meta.subject);

      const normalized = normalizePolicyHtml(html);
      const { cleaned, effectiveDate: ed } = extractEffectiveDate(normalized);
      setEffectiveDate(ed);
      setDocHtml(cleaned);

      if (messages?.length) console.info("[UploadPolicyDocs] Mammoth messages:", messages);
      toast.success("Document parsed. Review header fields, then Convert & Upload.");
    } catch (err) {
      console.error("[UploadPolicyDocs] DOCX parse error:", err);
      toast.error("Failed to read the .docx file");
    }
  };

  const buildPdfHtml = () =>
    wrapWithPolicyTemplate({
      section,
      number,
      subject,
      bodyHtml: docHtml || "<p>(No content parsed)</p>",
      mode: "pdf",
    });

  const generatePdfBlob = async (): Promise<Blob> => {
    console.log("[UploadPolicyDocs] Generating PDF…");

    // Parse the body HTML into a temporary container to walk the DOM
    const container = document.createElement("div");
    container.innerHTML = docHtml || "<p>(No content parsed)</p>";

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();   // 210
    const pageH = pdf.internal.pageSize.getHeight();   // 297

    const marginTop = PDF_BASE_MARGIN_MM + PDF_HEADER_RESERVED_MM + PDF_HEADER_GAP_MM; // ~51
    const marginBottom = PDF_BASE_MARGIN_MM + PDF_FOOTER_RESERVED_MM + PDF_HEADER_GAP_MM; // ~33 (includes gap above footer)
    const marginSide = PDF_BASE_MARGIN_MM;                                              // 15
    const contentW = pageW - marginSide * 2;                                            // 180
    const maxY = pageH - marginBottom;

    let curY = marginTop;
    let pageNum = 1;

    /** Add a new page and reset Y cursor */
    function newPage() {
      pdf.addPage();
      pageNum++;
      curY = marginTop;
    }

    /** Ensure there's at least `need` mm left; if not, start a new page */
    function ensureSpace(need: number) {
      if (curY + need > maxY) newPage();
    }

    /** Write a block of text with word-wrap, returns final Y */
    function writeBlock(
      text: string,
      x: number,
      maxW: number,
      opts: {
        fontFamily?: string;
        fontStyle?: string;
        fontSize?: number;
        textColor?: [number, number, number];
        lineHeight?: number;
        prefix?: string;
      } = {}
    ) {
      const family = opts.fontFamily ?? "times";
      const style = opts.fontStyle ?? "normal";
      const size = opts.fontSize ?? 11;
      const color = opts.textColor ?? [17, 24, 39];
      const lh = opts.lineHeight ?? 5.8;

      pdf.setFont(family, style);
      pdf.setFontSize(size);
      pdf.setTextColor(...color);

      // If there's a prefix (like "1. " or "a. "), measure it and adjust
      let prefixW = 0;
      if (opts.prefix) {
        prefixW = pdf.getTextWidth(opts.prefix);
      }

      const wrapW = maxW - prefixW;
      const lines: string[] = pdf.splitTextToSize(text, wrapW);

      for (let i = 0; i < lines.length; i++) {
        ensureSpace(lh);
        if (i === 0 && opts.prefix) {
          pdf.text(opts.prefix, x, curY);
          pdf.text(lines[i], x + prefixW, curY);
        } else {
          pdf.text(lines[i], x + prefixW, curY);
        }
        curY += lh;
      }
    }

    /** Recursively walk DOM nodes and render to PDF */
    function walkNodes(parent: Element | DocumentFragment, indentLevel: number, olCounters: number[]) {
      const children = parent.childNodes;
      for (let i = 0; i < children.length; i++) {
        const node = children[i];

        if (node.nodeType === Node.TEXT_NODE) {
          const txt = (node.textContent || "").replace(/\s+/g, " ").trim();
          if (!txt) continue;
          const x = marginSide + indentLevel * 8;
          const w = contentW - indentLevel * 8;
          writeBlock(txt, x, w);
          continue;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        // Skip images (they'd need addImage separately)
        if (tag === "img") continue;

        // Headings
        if (/^h[1-6]$/.test(tag)) {
          const level = parseInt(tag[1]);
          const txt = (el.textContent || "").trim();
          if (!txt) continue;

          curY += level <= 2 ? 4 : 3; // space before heading
          ensureSpace(12);

          // Draw heading underline for h2
          if (level === 2) {
            writeBlock(txt, marginSide, contentW, {
              fontStyle: "bold",
              fontSize: 14,
              textColor: [15, 23, 42],
              lineHeight: 6.4,
            });
            pdf.setDrawColor(229, 231, 235);
            pdf.setLineWidth(0.3);
            pdf.line(marginSide, curY, pageW - marginSide, curY);
            curY += 2;
          } else {
            writeBlock(txt, marginSide, contentW, {
              fontStyle: "bold",
              fontSize: level === 1 ? 16 : level === 3 ? 12 : 11,
              textColor: [15, 23, 42],
              lineHeight: 6.4,
            });
          }
          curY += 2; // space after heading
          continue;
        }

        // Paragraphs
        if (tag === "p") {
          const txt = (el.textContent || "").trim();
          if (!txt) {
            curY += 3; // blank paragraph = gap (matches old CSS `margin: 8px 0`)
            continue;
          }

          // Check if it has a policy-li class (indent-based list from applyIndentBasedLists)
          if (el.classList.contains("policy-li")) {
            const level = el.classList.contains("level-3") ? 3
              : el.classList.contains("level-2") ? 2
              : el.classList.contains("level-1") ? 1 : 0;
            const x = marginSide + (level + 1) * 6;
            const w = contentW - (level + 1) * 6;
            const bullets = ["•", "◦", "▪", "–"];
            writeBlock(txt, x, w, { prefix: bullets[level] + " " });
            continue;
          }

          // Check for strong/bold wrapping
          const isBold = el.querySelector("strong, b") !== null &&
            el.querySelector("strong, b")?.textContent?.trim() === txt;

          const x = marginSide + indentLevel * 8;
          const w = contentW - indentLevel * 8;
          writeBlock(txt, x, w, { fontStyle: isBold ? "bold" : "normal" });
          curY += 3; // paragraph spacing (matches old CSS `p { margin: 8px 0; }`)
          continue;
        }

        // Ordered lists
        if (tag === "ol") {
          const parentIsLi = (el.parentElement?.tagName || "").toLowerCase() === "li";
          const parentIsList = ["ol", "ul", "li"].includes((el.parentElement?.tagName || "").toLowerCase());
          // Increment indent when nested inside another list element
          const nestedIndent = parentIsList ? indentLevel + 1 : indentLevel;
          if (!parentIsLi) curY += 2;
          const startAttr = el.getAttribute("start");
          const startVal = startAttr ? parseInt(startAttr) - 1 : 0;
          const newCounters = parentIsList ? [...olCounters, startVal] : [...olCounters, startVal];
          walkNodes(el, nestedIndent, newCounters);
          if (!parentIsLi) curY += 2;
          continue;
        }

        // Unordered lists
        if (tag === "ul") {
          const parentIsLi = (el.parentElement?.tagName || "").toLowerCase() === "li";
          const parentIsList = ["ol", "ul", "li"].includes((el.parentElement?.tagName || "").toLowerCase());
          const nestedIndent = parentIsList ? indentLevel + 1 : indentLevel;
          if (!parentIsLi) curY += 2;
          walkNodes(el, nestedIndent, olCounters);
          if (!parentIsLi) curY += 2;
          continue;
        }

        // List items
        if (tag === "li") {
          // Check for non-counted items (embedded Note: paragraphs)
          const style = el.getAttribute("style") || "";
          if (/counter-increment\s*:\s*none/i.test(style)) {
            // Render as regular content at current indent
            walkNodes(el, indentLevel, olCounters);
            continue;
          }

          const parentTag = (el.parentElement?.tagName || "").toLowerCase();
          const txt = (el.textContent || "").trim();
          if (!txt) continue;

          // Detect effective indent from margin-left style (Mammoth often uses flat <ol> with margin-left)
          let effectiveIndent = indentLevel;
          const marginMatch = style.match(/margin-left\s*:\s*([\d.]+)\s*(px|pt|mm|cm|in)/i);
          if (marginMatch) {
            const val = parseFloat(marginMatch[1]);
            const unit = marginMatch[2].toLowerCase();
            // Convert to approximate indent levels (~36pt or ~48px per level)
            let px = val;
            if (unit === "pt") px = val * 1.333;
            else if (unit === "mm") px = val * 3.78;
            else if (unit === "cm") px = val * 37.8;
            else if (unit === "in") px = val * 96;
            const extraLevels = Math.round(px / 48);
            effectiveIndent = indentLevel + extraLevels;
          }
          // Also check parent <ol>/<ul> for margin-left
          if (!marginMatch && el.parentElement) {
            const parentStyle = el.parentElement.getAttribute("style") || "";
            const parentMarginMatch = parentStyle.match(/margin-left\s*:\s*([\d.]+)\s*(px|pt|mm|cm|in)/i);
            if (parentMarginMatch) {
              const val = parseFloat(parentMarginMatch[1]);
              const unit = parentMarginMatch[2].toLowerCase();
              let px = val;
              if (unit === "pt") px = val * 1.333;
              else if (unit === "mm") px = val * 3.78;
              else if (unit === "cm") px = val * 37.8;
              else if (unit === "in") px = val * 96;
              const extraLevels = Math.round(px / 48);
              effectiveIndent = indentLevel + extraLevels;
            }
          }

          const x = marginSide + effectiveIndent * 8 + 6;
          const w = contentW - effectiveIndent * 8 - 6;

          // Determine prefix based on effective indent level
          let prefix: string;
          if (parentTag === "ol") {
            // Use the deeper of DOM nesting level or margin-based indent for prefix style
            const prefixLevel = Math.max(olCounters.length - 1, effectiveIndent);
            const level = olCounters.length - 1;
            if (level >= 0) {
              olCounters[level]++;
              const num = olCounters[level];
              if (prefixLevel === 0) {
                prefix = `${num}. `;
              } else if (prefixLevel === 1) {
                prefix = `${String.fromCharCode(96 + ((num - 1) % 26) + 1)}. `;
              } else {
                const roman = ["i","ii","iii","iv","v","vi","vii","viii","ix","x"];
                prefix = `${roman[num - 1] || num}. `;
              }
            } else {
              prefix = "• ";
            }
          } else {
            // Unordered list bullet
            const bullets = ["•", "◦", "▪", "–"];
            const bIdx = Math.min(indentLevel, bullets.length - 1);
            prefix = bullets[bIdx] + " ";
          }

          // Check if <li> has nested <ol> or <ul> — render direct text then recurse into nested lists only
          const nestedList = el.querySelector(":scope > ol, :scope > ul");
          if (nestedList) {
            // Get direct text (before nested list)
            let directText = "";
            el.childNodes.forEach(c => {
              if (c.nodeType === Node.TEXT_NODE) directText += c.textContent;
              else if (c.nodeType === Node.ELEMENT_NODE && (c as Element).tagName.toLowerCase() !== "ol" && (c as Element).tagName.toLowerCase() !== "ul") {
                directText += c.textContent;
              }
            });
            directText = directText.replace(/\s+/g, " ").trim();
            if (directText) {
              writeBlock(directText, x, w, { prefix });
            }
            // Only recurse into nested <ol>/<ul> children (skip already-rendered text)
            for (let ci = 0; ci < el.children.length; ci++) {
              const child = el.children[ci] as HTMLElement;
              const childTag = child.tagName.toLowerCase();
              if (childTag === "ol") {
                const startAttr = child.getAttribute("start");
                const startVal = startAttr ? parseInt(startAttr) - 1 : 0;
                const nestedCounters = [...olCounters, startVal];
                walkNodes(child, indentLevel + 1, nestedCounters);
              } else if (childTag === "ul") {
                walkNodes(child, indentLevel + 1, olCounters);
              }
            }
          } else {
            writeBlock(txt, x, w, { prefix });
          }
          curY += 1.5; // inter-item spacing (matches old CSS `li { margin: 3px 0; }`)
          continue;
        }

        // Tables
        if (tag === "table") {
          curY += 2;
          const rows = el.querySelectorAll("tr");
          rows.forEach((row) => {
            const cells = row.querySelectorAll("td, th");
            const isHeader = row.querySelector("th") !== null;
            const colW = contentW / Math.max(cells.length, 1);
            let rowMaxH = 0;
            const cellTexts: string[][] = [];

            cells.forEach((cell, ci) => {
              const txt = (cell.textContent || "").trim();
              pdf.setFont("times", isHeader ? "bold" : "normal");
              pdf.setFontSize(10);
              const lines = pdf.splitTextToSize(txt, colW - 4);
              cellTexts.push(lines);
              rowMaxH = Math.max(rowMaxH, lines.length * 4.5 + 3);
            });

            ensureSpace(rowMaxH);

            // Draw cell borders and text
            cells.forEach((_, ci) => {
              const cx = marginSide + ci * colW;
              pdf.setDrawColor(229, 231, 235);
              pdf.setLineWidth(0.2);
              pdf.rect(cx, curY, colW, rowMaxH);

              pdf.setFont("times", isHeader ? "bold" : "normal");
              pdf.setFontSize(10);
              pdf.setTextColor(17, 24, 39);
              cellTexts[ci]?.forEach((line, li) => {
                pdf.text(line, cx + 2, curY + 4 + li * 4.5);
              });
            });

            curY += rowMaxH;
          });
          curY += 2;
          continue;
        }

        // Generic block elements: recurse
        if (["div", "section", "article", "main", "span", "strong", "b", "em", "i", "u", "a"].includes(tag)) {
          walkNodes(el, indentLevel, olCounters);
          continue;
        }

        // Horizontal rule
        if (tag === "hr") {
          ensureSpace(4);
          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.3);
          pdf.line(marginSide, curY, pageW - marginSide, curY);
          curY += 3;
          continue;
        }

        // Line break
        if (tag === "br") {
          curY += 3;
          continue;
        }

        // Fallback: try to render any text content
        const fallbackTxt = (el.textContent || "").trim();
        if (fallbackTxt) {
          writeBlock(fallbackTxt, marginSide + indentLevel * 8, contentW - indentLevel * 8);
        }
      }
    }

    // Walk the parsed HTML body
    walkNodes(container, 0, []);

    const totalPages = pdf.getNumberOfPages();

    // Load logo once and draw headers/footers
    const logoDataUrl = await fetchAsDataUrl(ALBERTA_LOGO_URL);
    const logoAspect = logoDataUrl ? await getImageAspect(logoDataUrl) : 3;
    const logo = logoDataUrl ? { dataUrl: logoDataUrl, aspect: logoAspect } : null;

    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      drawAlbertaHeader(pdf, i, totalPages, { section: section || "", number: number || "", subject: subject || "" }, logo);
      const isLastPage = i === totalPages;
      drawAlbertaFooter(pdf, "Classification: Protected B", isLastPage ? effectiveDate : undefined);
    }

    const pdfBlob = pdf.output("blob");
    if (!pdfBlob || !pdfBlob.size) throw new Error("PDF generation produced an empty blob");
    return pdfBlob;
  };

  const handleConvertAndUpload = async () => {
    if (!file) { toast.error(isPdfMode ? "Please select a PDF file first" : "Please select a .docx file first"); return; }
    if (!isPdfMode && !docHtml) { toast.error("Nothing to convert (failed to parse?)"); return; }

    setIsUploading(true);
    setUploadComplete(false);

    try {
      console.log("[UploadPolicyDocs] Begin convert & upload flow");
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error("You must be signed in to upload.");

      // 0) Decide which policy to attach to
      let ensuredPolicyId = (policyIdFromUrl || policyId || "").trim();

      if (lockedToPolicy) {
        // In locked mode, do NOT create a new policy.
        if (!ensuredPolicyId) throw new Error("Missing policyId in URL.");
        if (!isUuid(ensuredPolicyId)) throw new Error("Invalid Policy ID");

        const { data: existing, error: exErr } = await supabase
          .from("policies")
          .select("id")
          .eq("id", ensuredPolicyId)
          .maybeSingle();

        if (exErr) throw exErr;
        if (!existing) throw new Error("Target policy not found.");
      } else {
        if (ensuredPolicyId) {
          if (!isUuid(ensuredPolicyId)) throw new Error("Invalid Policy ID");

          const { data: existing, error: exErr } = await supabase
            .from("policies")
            .select("id")
            .eq("id", ensuredPolicyId)
            .maybeSingle();

          if (exErr) throw exErr;
          if (!existing) throw new Error("Target policy not found.");
        } else {
          // Only create a new policy when there is truly no policyId
          const title = (subject?.trim() || file.name.replace(/\.docx$/i, "").trim()).slice(0, 200);
          const description = section?.trim() || null;
          const category = "General";

          const { data: created, error: cErr } = await supabase
            .from("policies")
            .insert({
              title,
              description,
              category,
              status: "draft",
              created_by: user.id,
            })
            .select("id")
            .single();

          if (cErr) throw new Error(`Failed to create policy: ${cErr.message}`);
          ensuredPolicyId = created!.id;
        }
      }

      // 1) Generate or use PDF
      let pdfBlob: Blob;
      let pdfName: string;

      if (isPdfMode) {
        pdfBlob = file;
        pdfName = file.name;
      } else {
        pdfBlob = await generatePdfBlob();
        pdfName = makePdfName(file.name, number, subject);
      }

      // 2) Upload PDF to Storage
      const path = `formatted/${Date.now()}_${pdfName}`;
      console.log("[UploadPolicyDocs] Uploading to Storage path:", path);
      const { error: upErr } = await supabase.storage
        .from("policy-documents")
        .upload(path, pdfBlob, { contentType: "application/pdf", upsert: false });
      if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

      // 3) Public URL
      const { data: pub } = supabase.storage.from("policy-documents").getPublicUrl(path);
      const publicUrl = pub?.publicUrl ?? null;
      console.log("[UploadPolicyDocs] Public URL:", publicUrl);
      if (!publicUrl) throw new Error("Could not obtain a public URL for the uploaded PDF. Is the bucket public?");

      // 4) Insert policy_versions
      const { data: inserted, error: insErr } = await supabase
        .from("policy_versions")
        .insert({
          policy_id: ensuredPolicyId,
          version_number: versionNumber,
          file_name: pdfName,
          file_size: pdfBlob.size,
          file_url: publicUrl,
        } as any)
        .select("id")
        .single();
      
      if (insErr) throw new Error(`Failed to create policy version: ${insErr.message}`);
      const versionId = inserted!.id;

      // 5) Update policies.current_version_id (+ publish if allowed)
      const { error: updErr } = await supabase
        .from("policies")
        .update({ current_version_id: versionId, status: "published" })
        .eq("id", ensuredPolicyId);
      if (updErr) {
        const { error: fallback } = await supabase
          .from("policies")
          .update({ current_version_id: versionId })
          .eq("id", ensuredPolicyId);
        if (fallback) throw new Error(`Failed to set current version on policy: ${fallback.message}`);
      }

      setUploadComplete(true);
      toast.success(isPdfMode ? "PDF uploaded and linked!" : "Policy created, converted to PDF, and linked!");
      console.log("[UploadPolicyDocs] All done → redirect to detail");
      navigate(`/dashboard/policies/${ensuredPolicyId}`);
    } catch (error: any) {
      console.error("[UploadPolicyDocs] Convert/Upload error:", error);
      toast.error(error?.message ?? "Failed to convert and upload");
      console.error("[UploadPolicyDocs] Convert/Upload error:", error);
      toast.error(error?.message ?? "Failed to convert and upload");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8 flex items-center justify-center">
      <Card className="max-w-4xl w-full">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Upload className="h-6 w-6" />
            {isPdfMode ? "Upload Policy (PDF)" : "Upload & Format Policy (.docx → PDF)"}
          </CardTitle>
          <CardDescription>
            {isPdfMode
              ? "Select a PDF file. Fill in the header fields (Section/Number/Subject), then upload directly to storage. If no Policy ID is provided, we'll create a new policy automatically."
              : "Select a Word document. We'll clean the layout, standardize the header (Section/Number/Subject), render a preview, convert to PDF, and upload it to Supabase Storage. If no Policy ID is provided, we'll create a new policy automatically, attach this file as a version, and publish it."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fileInput">{isPdfMode ? "PDF Document (.pdf)" : "Word Document (.docx)"}</Label>
              <Input id="fileInput" type="file" accept={isPdfMode ? ".pdf" : ".docx"} onChange={onPickFile} />
              <p className="text-xs text-muted-foreground">
                {isPdfMode
                  ? "The PDF will be uploaded directly without conversion."
                  : "We'll normalize headings, lists, spacing, and apply a consistent header."}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Policy ID {lockedToPolicy ? "" : "(optional)"}</Label>
              <Input
                placeholder={lockedToPolicy ? "" : "Leave blank to auto-create a Policy"}
                value={policyId}
                disabled={lockedToPolicy}
                onChange={(e) => setPolicyId(e.target.value)}
              />
              {lockedToPolicy && <p className="text-xs text-muted-foreground">Uploading a new version for this policy.</p>}

              <Label className="mt-2">Version Number</Label>
              <Input
                type="number"
                min={1}
                value={versionNumber}
                onChange={(e) => setVersionNumber(parseInt(e.target.value || "1", 10))}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Section</Label>
              <Input
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g., Electronic Supervision – Mobile Monitoring Unit"
              />
            </div>
            <div className="space-y-2">
              <Label>Number</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="e.g., 8.01.01" />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g., Reporting and Supervision Standards" />
            </div>
          </div>

          {uploadComplete && (
            <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Upload completed successfully!</span>
            </div>
          )}

          <div className="flex items-start gap-2 p-4 bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100 rounded-lg">
            <AlertCircle className="h-5 w-5 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Note:</p>
              <p>{isPdfMode ? "Upload your existing PDF policy documents directly." : "You can remove this page later; it's a one-time utility for converting legacy Word files."}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={handleConvertAndUpload}
              disabled={!file || (!isPdfMode && !docHtml) || isUploading}
              size="lg"
              className="w-full sm:w-auto"
            >
              {isUploading
                ? (isPdfMode ? "Uploading..." : "Converting & Uploading...")
                : (isPdfMode ? "Upload PDF" : "Convert to PDF & Upload")}
            </Button>
            {!isPdfMode && (
              <Button
                variant="outline"
                onClick={() => {
                  const w = window.open();
                  if (!w) return;
                  w.document.open();
                  w.document.write(buildPdfHtml());
                  w.document.close();
                }}
                disabled={!docHtml}
                className="w-full sm:w-auto"
              >
                <FileText className="h-4 w-4 mr-2" />
                Preview PDF (print view)
              </Button>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              {isPdfMode ? "PDF Preview" : "Formatted Preview"}
            </h3>
            {isPdfMode ? (
              file ? (
                <object
                  data={URL.createObjectURL(file)}
                  type="application/pdf"
                  className="w-full h-[60vh] border rounded-lg"
                >
                  <p className="p-4 text-muted-foreground">Unable to display PDF preview. Your browser may not support inline PDF viewing.</p>
                </object>
              ) : (
                <div className="border rounded-lg p-5 text-muted-foreground">Select a PDF file to preview.</div>
              )
            ) : (
              <div
                ref={previewRef}
                className="border rounded-lg p-5 max-h-[60vh] overflow-auto bg-white dark:bg-zinc-900"
                dangerouslySetInnerHTML={{
                  __html: wrapWithPolicyTemplate({
                    section,
                    number,
                    subject,
                    bodyHtml: docHtml || "<p>(No content parsed)</p>",
                    mode: "preview",
                    drawDepartmentText: DRAW_DEPARTMENT_TEXT,
                  }),
                }}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UploadPolicyDocs;
