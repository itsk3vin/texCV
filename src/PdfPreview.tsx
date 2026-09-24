import { useEffect, useRef, useState } from "react";
import { TriangleAlertIcon, ZoomInIcon, ZoomOutIcon } from "@hugeicons/core-free-icons";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { IconButton } from "./components/IconButton";
import { Badge } from "./components/ui/badge";
import { Group, GroupSeparator } from "./components/ui/group";
import { Spinner } from "./components/ui/spinner";
import { AppIcon } from "./components/AppIcon";

GlobalWorkerOptions.workerSrc = pdfWorker;

type Props = { pdfUrl?: string; compiling: boolean; error?: string; pageCount?: number };

export function PdfPreview({ pdfUrl, compiling, error, pageCount }: Props) {
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
    <section className="preview-pane" aria-label="PDF preview">
      <div className="pane-header">
        <span>PREVIEW</span>
        <Group className="preview-tools" aria-label="Preview zoom">
          <IconButton onClick={() => setZoom((v) => Math.max(.6, v - .1))} label="Zoom out"><AppIcon icon={ZoomOutIcon} /></IconButton>
          <GroupSeparator />
          <span>{Math.round(zoom * 100)}%</span>
          <GroupSeparator />
          <IconButton onClick={() => setZoom((v) => Math.min(1.8, v + .1))} label="Zoom in"><AppIcon icon={ZoomInIcon} /></IconButton>
        </Group>
      </div>
      {pageCount && pageCount > 1 ? <div className="page-warning"><AppIcon icon={TriangleAlertIcon} /><Badge variant="warning">{pageCount} pages</Badge> showing page 1</div> : null}
      <div className="paper-stage" ref={container}>
        {pdfUrl ? <canvas ref={canvas} className="pdf-canvas" /> : (
          <div className="preview-empty">
            <div className="page-ghost"><span>8.5 × 11</span></div>
            <p>{error || "Your compiled resume will appear here."}</p>
          </div>
        )}
        {compiling ? <div className="compiling-pill"><Spinner /> Building preview</div> : null}
      </div>
      {renderError ? <div className="preview-error">{renderError}</div> : null}
    </section>
  );
}
