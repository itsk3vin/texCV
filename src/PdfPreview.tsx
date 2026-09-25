import { useEffect, useRef, useState } from "react";
import { Download06Icon, TriangleAlertIcon, ZoomInIcon, ZoomOutIcon } from "@hugeicons/core-free-icons";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { IconButton } from "./components/IconButton";
import { Badge } from "./components/ui/badge";
import { Spinner } from "./components/ui/spinner";
import { AppIcon } from "./components/AppIcon";
import { Button } from "./components/ui/button";

GlobalWorkerOptions.workerSrc = pdfWorker;

type Props = { pdfUrl?: string; compiling: boolean; error?: string; pageCount?: number; actionsDisabled: boolean; onBuild: () => void; onDownload: () => void };

export function PdfPreview({ pdfUrl, compiling, error, pageCount, actionsDisabled, onBuild, onDownload }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [renderError, setRenderError] = useState<string>();

  useEffect(() => {
    if (!pdfUrl || !canvas.current || !container.current) return;
    let cancelled = false;
    const task = getDocument({ url: pdfUrl });
    task.promise.then(async (pdf) => {
      const page = await pdf.getPage(1);
      if (cancelled || !canvas.current || !container.current) return;
      const natural = page.getViewport({ scale: 1 });
      const available = Math.max(300, container.current.clientWidth - 72);
      const scale = Math.min(available / natural.width, 1.35) * zoom;
      const viewport = page.getViewport({ scale });
      const ratio = window.devicePixelRatio || 1;
      canvas.current.width = viewport.width * ratio;
      canvas.current.height = viewport.height * ratio;
      canvas.current.style.width = `${viewport.width}px`;
      canvas.current.style.height = `${viewport.height}px`;
      const context = canvas.current.getContext("2d");
      if (!context) return;
      await page.render({ canvas: canvas.current, canvasContext: context, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] }).promise;
      setRenderError(undefined);
    }).catch((reason) => setRenderError(reason instanceof Error ? reason.message : "Could not render the PDF."));
    return () => { cancelled = true; task.destroy(); };
  }, [pdfUrl, zoom]);

  return (
    <section className="flex min-h-0 min-w-0 flex-col bg-(--surface-preview)" aria-label="PDF preview">
      <div className="flex h-9.5 min-h-9.5 items-center justify-between border-b border-border px-3 text-[.67rem] font-semibold text-(--text-subtle) tracking-[.1em]">
        <div className="flex items-center gap-1 text-[.65rem] font-normal text-(--text-subtle) tracking-normal" aria-label="Preview zoom">
          <IconButton onClick={() => setZoom((v) => Math.max(.6, v - .1))} label="Zoom out"><AppIcon icon={ZoomOutIcon} /></IconButton>
          <span className="min-w-9 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <IconButton onClick={() => setZoom((v) => Math.min(1.8, v + .1))} label="Zoom in"><AppIcon icon={ZoomInIcon} /></IconButton>
        </div>
        <div className="flex items-center gap-2" aria-label="Document actions">
          <Button className="build-action" variant="outline" size="sm" onClick={onBuild} disabled={actionsDisabled}>Compile</Button>
          <Button className="download-action" size="sm" onClick={onDownload} disabled={actionsDisabled}><AppIcon icon={Download06Icon} /> Download PDF</Button>
        </div>
      </div>
      {pageCount && pageCount > 1 ? <div className="flex h-8.5 items-center justify-center gap-2 border-b border-(--warning-border) bg-(--warning-surface) text-[.75rem] text-(--warning-text)"><AppIcon icon={TriangleAlertIcon} /><Badge variant="warning">{pageCount} pages</Badge> showing page 1</div> : null}
      <div className="relative flex min-h-0 flex-1 items-start justify-center overflow-auto bg-(--surface-stage) bg-[radial-gradient(var(--grid-dot)_0.6px,transparent_0.6px)] bg-size-[12px_12px] px-9 pt-7 pb-12" ref={container}>
        {pdfUrl ? <canvas ref={canvas} className="block rounded-[3px] bg-(--paper) shadow-(--shadow-paper)" /> : (
          <div className="flex self-center flex-col items-center gap-4.5 text-center text-[.83rem] text-(--text-subtle)">
            <div className="grid w-42.5 aspect-[8.5/11] place-items-center rounded-[3px] bg-(--paper) text-[.7rem] text-(--text-faint) tracking-[.13em] shadow-(--shadow-paper)"><span>8.5 × 11</span></div>
            <p>{error || "Your compiled resume will appear here."}</p>
          </div>
        )}
        {compiling ? <div className="sticky top-2 ml-[-120px] flex h-7 items-center gap-2 rounded-md border border-border bg-(--surface-raised)/92 px-2.5 text-[.7rem] text-foreground shadow-(--shadow-elevated) backdrop-blur-lg"><Spinner /> Building preview</div> : null}
      </div>
      {renderError ? <div className="border-t border-(--danger-border) bg-(--danger-surface) px-3 py-2 text-[.75rem] text-(--danger-text)">{renderError}</div> : null}
    </section>
  );
}
