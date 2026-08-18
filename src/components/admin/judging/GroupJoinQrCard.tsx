import { useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Check, Copy, Download, ExternalLink } from "lucide-react";

// Scannable code for a judging group's participant join link. Attendees scan
// it, sign in if needed, and land on that group's submission form.
//
// The code is derived from the live join URL rather than stored, so it can
// never go stale when an admin renames the group slug. Colors are pinned to
// black on white instead of theme tokens: a themed code would stop scanning in
// dark mode and in print.
export function GroupJoinQrCard({
  joinUrl,
  groupSlug,
}: {
  joinUrl: string;
  groupSlug: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable; the URL stays visible for manual copy
    }
  };

  const triggerDownload = (href: string, filename: string) => {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    anchor.click();
  };

  // PNG comes from the offscreen high-resolution canvas so printed signage
  // stays sharp at poster size.
  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    triggerDownload(canvas.toDataURL("image/png"), `${groupSlug}-join-qr.png`);
  };

  const handleDownloadSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const markup = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${groupSlug}-join-qr.svg`);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-3 flex flex-col sm:flex-row items-center sm:items-start gap-4 px-3 py-3.5 rounded-md border border-hairline bg-surface">
      <div className="flex-shrink-0 rounded-md bg-white p-2 border border-hairline">
        <QRCodeSVG
          ref={svgRef}
          value={joinUrl}
          size={148}
          level="M"
          marginSize={2}
          bgColor="#ffffff"
          fgColor="#000000"
          title={`Join QR code for ${groupSlug}`}
        />
      </div>

      {/* Offscreen, print-resolution copy used only for the PNG export */}
      <QRCodeCanvas
        ref={canvasRef}
        value={joinUrl}
        size={1024}
        level="M"
        marginSize={4}
        bgColor="#ffffff"
        fgColor="#000000"
        style={{ display: "none" }}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="text-[13px] font-medium text-ink">Participant QR code</p>
        <p className="text-xs text-faint mt-0.5">
          Put this on a screen, slide, or printed sign. Scanning opens the join
          page, which sends attendees to sign in if needed and then straight to
          this group's submission form.
        </p>
        <p className="text-xs text-soft font-mono break-all mt-2">{joinUrl}</p>

        <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-hairline text-copy hover:bg-surface-hover transition-colors"
            title="Copy the join link"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={handleDownloadPng}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-hairline text-copy hover:bg-surface-hover transition-colors"
            title="Download the QR code as a high-resolution PNG"
          >
            <Download className="w-3.5 h-3.5" />
            PNG
          </button>
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-hairline text-copy hover:bg-surface-hover transition-colors"
            title="Download the QR code as a vector SVG"
          >
            <Download className="w-3.5 h-3.5" />
            SVG
          </button>
          <a
            href={joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-hairline text-copy hover:bg-surface-hover transition-colors"
            title="Open the join page in a new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Preview
          </a>
        </div>
      </div>
    </div>
  );
}
