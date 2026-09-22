import { useState } from "react";
import { useConvex } from "convex/react";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import {
  buildSubmissionCsv,
  buildSubmissionJson,
  buildSubmissionMarkdownZip,
  safeFilename,
} from "../../../lib/submissionDownloads";
import type { GroupDetails } from "./groupSection";

type ExportFormat = "csv" | "json" | "markdown";

// Format options shown in the Download dropdown
const EXPORT_FORMATS = [
  { value: "csv", label: "Download CSV", description: "Spreadsheet file" },
  {
    value: "json",
    label: "Download JSON",
    description: "Structured data file",
  },
  {
    value: "markdown",
    label: "Download Markdown",
    description: "ZIP with one file per submission plus a README index",
  },
] as const;

const FORMAT_NOUN: Record<ExportFormat, string> = {
  csv: "CSV",
  json: "JSON",
  markdown: "Markdown",
};

// Trigger a browser download for an in-memory blob
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Download dropdown for the View submissions toolbar. Fetches the export rows
// on demand (judging.results gated server side) and builds the file client side.
export function SubmissionDownloadControl({ group }: { group: GroupDetails }) {
  const convex = useConvex();
  const [isOpen, setIsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (format: ExportFormat) => {
    setIsOpen(false);
    setIsDownloading(true);
    try {
      const rows = await convex.query(
        api.judgingGroupSubmissions.exportGroupSubmissions,
        { groupId: group._id },
      );
      if (rows.length === 0) {
        toast.error("No submissions to download");
        return;
      }

      const exportedAt = new Date().toISOString();
      const timestamp = exportedAt.split("T")[0];
      const baseFilename = `judging-${safeFilename(group.name)}-submissions-${timestamp}`;

      if (format === "json") {
        downloadBlob(
          new Blob([buildSubmissionJson(group, rows, exportedAt)], {
            type: "application/json;charset=utf-8;",
          }),
          `${baseFilename}.json`,
        );
      } else if (format === "markdown") {
        downloadBlob(
          await buildSubmissionMarkdownZip(group, rows, {
            siteOrigin: window.location.origin,
            exportedAt,
          }),
          `${baseFilename}-markdown.zip`,
        );
      } else {
        downloadBlob(
          new Blob([buildSubmissionCsv(rows)], {
            type: "text/csv;charset=utf-8;",
          }),
          `${baseFilename}.csv`,
        );
      }

      toast.success(
        `Downloaded ${rows.length} ${rows.length === 1 ? "submission" : "submissions"} as ${FORMAT_NOUN[format]}`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not download submissions. Please try again.",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={isDownloading}
            className="h-10 inline-flex items-center gap-1.5 px-3 text-[13px] font-medium rounded-md border border-hairline text-copy hover:bg-surface-hover transition-colors disabled:opacity-50"
            aria-label={
              isDownloading
                ? "Preparing submission download"
                : "Download submissions"
            }
            aria-busy={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="w-3.5 h-3.5" aria-hidden />
            )}
            {isDownloading ? "Preparing..." : "Download"}
            {!isDownloading && (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-60 p-1">
          {EXPORT_FORMATS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => void handleDownload(option.value)}
              className="w-full px-3 py-2 text-left rounded-sm hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none transition-colors"
            >
              <span className="block text-[13px] font-medium text-ink">
                {option.label}
              </span>
              <span className="block text-xs text-soft mt-0.5">
                {option.description}
              </span>
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
