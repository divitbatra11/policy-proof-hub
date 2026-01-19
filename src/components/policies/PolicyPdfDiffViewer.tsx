import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// pdfjs-dist import: adjust if your project uses a different pdfjs entry.
// If your app already configures the worker globally elsewhere (e.g. PolicyViewer),
// you can remove the workerSrc lines below.
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

type PolicyVersion = {
  id: string;
  version_number: number;
  file_url: string;
  file_name: string;
  published_at?: string | null;
};

type Props = {
  versions: PolicyVersion[];
  currentVersionId?: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function extractStoragePathFromPublicUrl(fileUrl: string) {
  // supports:
  // .../storage/v1/object/public/policy-documents/<PATH>
  // .../storage/v1/object/sign/policy-documents/<PATH>?token=...
  const publicMarker = "/storage/v1/object/public/policy-documents/";
  const signMarker = "/storage/v1/object/sign/policy-documents/";

  let i = fileUrl.indexOf(publicMarker);
  if (i !== -1) return decodeURIComponent(fileUrl.slice(i + publicMarker.length));

  i = fileUrl.indexOf(signMarker);
  if (i !== -1) {
    const tail = fileUrl.slice(i + signMarker.length);
    return decodeURIComponent(tail.split("?")[0]);
  }

  return null;
}

async function loadPdfDoc(fileUrl: string) {
  // Prefer authenticated download (works for private buckets)
  const path = extractStoragePathFromPublicUrl(fileUrl);

  if (path) {
    const { data, error } = await supabase.storage.from("policy-documents").download(path);
    if (error) throw error;

    const buf = await data.arrayBuffer();
    const task = (pdfjsLib as any).getDocument({
      data: new Uint8Array(buf),
      disableRange: true,
      disableStream: true,
      disableAutoFetch: true,
    });
    return await task.promise;
  }

  // Fallback: fetch by URL
  const res = await fetch(fileUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch PDF (${res.status})`);
  const buf = await res.arrayBuffer();
  const task = (pdfjsLib as any).getDocument({
    data: new Uint8Array(buf),
    disableRange: true,
    disableStream: true,
    disableAutoFetch: true,
  });
  return await task.promise;
}

async function renderPageToCanvas(doc: any, pageNum: number, canvas: HTMLCanvasElement, scale: number) {
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  return { page, viewport };
}

function drawVisualDiffOverlay(
  oldCanvas: HTMLCanvasElement,
  newCanvas: HTMLCanvasElement,
  hlCanvas: HTMLCanvasElement,
  opts?: { blockSize?: number; threshold?: number }
) {
  const blockSize = opts?.blockSize ?? 5;
  const threshold = opts?.threshold ?? 18; // luma-diff threshold (per sampled pixel), higher = fewer highlights

  const w = Math.min(oldCanvas.width, newCanvas.width);
  const h = Math.min(oldCanvas.height, newCanvas.height);

  const oldCtx = oldCanvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
const newCtx = newCanvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
const hlCtx = hlCanvas.getContext("2d") as CanvasRenderingContext2D | null;


  if (!oldCtx || !newCtx || !hlCtx) return;

  // Match overlay canvas to NEW canvas
  hlCanvas.width = newCanvas.width;
  hlCanvas.height = newCanvas.height;
  hlCtx.clearRect(0, 0, hlCanvas.width, hlCanvas.height);

  const oldData = oldCtx.getImageData(0, 0, w, h).data;
  const newData = newCtx.getImageData(0, 0, w, h).data;

  const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

  hlCtx.fillStyle = "rgba(255, 235, 59, 0.38)"; // yellow highlight

  const points = [
    [0, 0],
    [blockSize - 1, 0],
    [0, blockSize - 1],
    [blockSize - 1, blockSize - 1],
    [Math.floor(blockSize / 2), Math.floor(blockSize / 2)],
  ];

  for (let y = 0; y < h; y += blockSize) {
    for (let x = 0; x < w; x += blockSize) {
      let score = 0;
      let samples = 0;

      for (const [dx, dy] of points) {
        const px = x + dx;
        const py = y + dy;
        if (px >= w || py >= h) continue;

        const idx = (py * w + px) * 4;

        const r0 = oldData[idx];
        const g0 = oldData[idx + 1];
        const b0 = oldData[idx + 2];

        const r1 = newData[idx];
        const g1 = newData[idx + 1];
        const b1 = newData[idx + 2];

        const l0 = luma(r0, g0, b0);
        const l1 = luma(r1, g1, b1);

        // Ignore near-white background-to-background noise
        if (l0 > 245 && l1 > 245) continue;

        score += Math.abs(l1 - l0);
        samples++;
      }

      if (samples === 0) continue;

      const avg = score / samples;
      if (avg >= threshold) {
        hlCtx.fillRect(x, y, blockSize, blockSize);
      }
    }
  }
}

export default function PolicyPdfDiffViewer({ versions, currentVersionId }: Props) {
  const sorted = useMemo(
    () => [...versions].sort((a, b) => (a.version_number ?? 0) - (b.version_number ?? 0)),
    [versions]
  );

  const current = useMemo(
    () => sorted.find((v) => v.id === currentVersionId) ?? sorted[sorted.length - 1],
    [sorted, currentVersionId]
  );

  const previous = useMemo(() => {
    if (!current) return sorted[0];
    const idx = sorted.findIndex((v) => v.id === current.id);
    return idx > 0 ? sorted[idx - 1] : sorted[0];
  }, [sorted, current]);

  const [oldId, setOldId] = useState<string>(previous?.id ?? "");
  const [newId, setNewId] = useState<string>(current?.id ?? "");
  const [pageNum, setPageNum] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.35);

  const [oldDoc, setOldDoc] = useState<any>(null);
  const [newDoc, setNewDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);

  const oldCanvasRef = useRef<HTMLCanvasElement>(null);
  const newCanvasRef = useRef<HTMLCanvasElement>(null);
  const hlCanvasRef = useRef<HTMLCanvasElement>(null);

  const oldVersion = useMemo(() => sorted.find((v) => v.id === oldId) ?? null, [sorted, oldId]);
  const newVersion = useMemo(() => sorted.find((v) => v.id === newId) ?? null, [sorted, newId]);

  // Load PDFs when selection changes
  useEffect(() => {
    (async () => {
      if (!oldVersion?.file_url || !newVersion?.file_url) return;

      try {
        setLoading(true);

        const [od, nd] = await Promise.all([loadPdfDoc(oldVersion.file_url), loadPdfDoc(newVersion.file_url)]);

        setOldDoc(od);
        setNewDoc(nd);

        const pages = Math.max(1, Math.min(od.numPages || 1, nd.numPages || 1));
        setNumPages(pages);
        setPageNum(1);
      } catch (e: any) {
        console.error(e);
        toast.error("Failed to load PDFs for comparison.");
      } finally {
        setLoading(false);
      }
    })();
  }, [oldVersion?.file_url, newVersion?.file_url]);

  // Render + visual diff overlay for current page
  useEffect(() => {
    (async () => {
      if (!oldDoc || !newDoc) return;
      const oldCanvas = oldCanvasRef.current;
      const newCanvas = newCanvasRef.current;
      const hlCanvas = hlCanvasRef.current;
      if (!oldCanvas || !newCanvas || !hlCanvas) return;

      const p = clamp(pageNum, 1, numPages);

      try {
        setLoading(true);

        await Promise.all([
          renderPageToCanvas(oldDoc, p, oldCanvas, scale),
          renderPageToCanvas(newDoc, p, newCanvas, scale),
        ]);

        // Draw pixel-diff overlay onto the NEW page
        drawVisualDiffOverlay(oldCanvas, newCanvas, hlCanvas, {
          blockSize: 5,
          threshold: 18,
        });
      } catch (e: any) {
        console.error(e);
        toast.error("Failed to render diff for this page.");
      } finally {
        setLoading(false);
      }
    })();
  }, [oldDoc, newDoc, pageNum, numPages, scale]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="space-y-1">
            <div className="text-sm font-medium">Old Version</div>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={oldId}
              onChange={(e) => setOldId(e.target.value)}
            >
              {sorted.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_number} — {v.file_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">New Version</div>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
            >
              {sorted.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_number} — {v.file_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button variant="outline" onClick={() => setScale((s) => Math.max(0.75, s - 0.15))}>
              -
            </Button>
            <div className="text-sm tabular-nums w-14 text-center">{Math.round(scale * 100)}%</div>
            <Button variant="outline" onClick={() => setScale((s) => Math.min(2.25, s + 0.15))}>
              +
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setPageNum((p) => Math.max(1, p - 1))}>
            Prev
          </Button>
          <div className="text-sm tabular-nums">
            Page {pageNum} / {numPages}
          </div>
          <Button variant="outline" onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}>
            Next
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Highlighted areas on the right show visual differences between the selected PDFs (pixel-based).
        Your current PDFs are image-based, so character-by-character text diff isn’t possible without changing the PDF generation method.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white dark:bg-zinc-900 p-2 overflow-auto">
          <div className="text-sm font-medium mb-2">Old</div>
          <canvas ref={oldCanvasRef} className="max-w-full h-auto block" />
        </div>

        <div className="rounded-lg border bg-white dark:bg-zinc-900 p-2 overflow-auto">
          <div className="text-sm font-medium mb-2">New (changes highlighted)</div>
          <div className="relative inline-block">
            <canvas ref={newCanvasRef} className="max-w-full h-auto block" />
            <canvas
              ref={hlCanvasRef}
              className="absolute left-0 top-0 pointer-events-none"
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Rendering…</div>}
    </div>
  );
}
