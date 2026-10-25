import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Papa from "papaparse";
import { FileUp, Loader2, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { SimpleSelect } from "../../ui/SimpleSelect";
import { GroupDetails, SectionCard } from "./groupSection";
import {
  CSV_TARGETS,
  CSV_TARGET_LABELS,
  buildImportRow,
  buildMapping,
  chunk,
  findHeader,
  isSingleTarget,
  previewRows,
  rowPassesFilters,
  type CsvMapping,
  type CsvRow,
  type CsvTarget,
} from "../../../lib/csvImport";

// Rows per mutation call; must not exceed the server cap in importCsvBatch
const BATCH_SIZE = 25;
// Largest file the browser parser accepts
const MAX_FILE_BYTES = 15 * 1024 * 1024;

type ParsedFile = {
  name: string;
  headers: Array<string>;
  rows: Array<CsvRow>;
};

type SkippedRow = { importKey: string; title: string; reason: string };

type ImportResult = {
  created: number;
  updated: number;
  skipped: Array<SkippedRow>;
  failedBatches: number;
};

const TARGET_OPTIONS = CSV_TARGETS.map((target) => ({
  value: target,
  label: CSV_TARGET_LABELS[target],
}));

// Upload a CSV (Devpost Projects export or similar) and turn each row into a
// submission in this group. No accounts are created. Rows stay out of the
// public directory unless the checkbox is turned on.
export function CsvImportCard({ group }: { group: GroupDetails }) {
  const importState = useQuery(api.judgingGroupImports.getImportState, {
    groupId: group._id,
  });
  const importCsvBatch = useMutation(api.judgingGroupImports.importCsvBatch);
  const saveImportMapping = useMutation(
    api.judgingGroupImports.saveImportMapping,
  );
  const createImportTag = useMutation(api.judgingGroupImports.createImportTag);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [parseError, setParseError] = useState("");
  const [mapping, setMapping] = useState<CsvMapping>({});
  const [prizeContains, setPrizeContains] = useState("Convex");
  const [submittedOnly, setSubmittedOnly] = useState(true);
  const [includeInDirectory, setIncludeInDirectory] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showAllMappings, setShowAllMappings] = useState(false);
  // Tag picker: null means "use the tag from the last import"
  const [tagChoice, setTagChoice] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagPrivate, setNewTagPrivate] = useState(true);
  const [creatingTag, setCreatingTag] = useState(false);

  // Judging only rows can only carry private tags, so public tags drop out
  // of the picker (and out of the selection) while the checkbox is off
  const tagOptionsSource = (importState?.tags ?? []).filter(
    (tag) => includeInDirectory || tag.isPrivate,
  );
  const rawChoice = tagChoice ?? importState?.lastTagId ?? "none";
  const tagValue =
    rawChoice === "new" ||
    tagOptionsSource.some((tag) => tag._id === rawChoice)
      ? rawChoice
      : "none";
  const selectedTag = tagOptionsSource.find((tag) => tag._id === tagValue);
  const tagOptions = [
    { value: "none", label: "No tag" },
    ...tagOptionsSource.map((tag) => ({
      value: tag._id,
      label: tag.isPrivate ? `${tag.name} (private)` : tag.name,
    })),
    { value: "new", label: "Create a new tag..." },
  ];
  const mustBePrivate =
    !includeInDirectory || importState?.canCreatePublicTag !== true;

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    setCreatingTag(true);
    try {
      const res = await createImportTag({
        groupId: group._id,
        name,
        isPrivate: mustBePrivate || newTagPrivate,
      });
      if (res.existed && !res.isPrivate && !includeInDirectory) {
        toast.error(
          `${res.name} already exists as a public tag. Pick another name or turn on Show in public directory.`,
        );
        return;
      }
      setTagChoice(res.tagId);
      setNewTagName("");
      toast.success(
        res.existed
          ? `Using the existing ${res.name} tag.`
          : `Created ${res.isPrivate ? "private " : ""}tag ${res.name}.`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message.replace(/^\[.*?\]\s*/, "")
          : "Could not create the tag",
      );
    } finally {
      setCreatingTag(false);
    }
  };

  const prizeHeader = parsed
    ? findHeader(parsed.headers, "opt-in prizes")
    : undefined;
  const statusHeader = parsed
    ? findHeader(parsed.headers, "project status")
    : undefined;

  // Rows after filters, mapped to mutation rows, with a create/update/skip
  // preview against what the group already holds
  const preview = useMemo(() => {
    if (!parsed || !importState) return null;
    const filtered = parsed.rows.filter((row) =>
      rowPassesFilters(row, {
        prizeHeader,
        prizeContains,
        statusHeader,
        submittedOnly,
      }),
    );
    const built = filtered.map((row) => buildImportRow(row, mapping));
    const rows = previewRows(
      built,
      new Set(importState.importedKeys),
      new Set(importState.existingUrls),
    );
    return {
      filteredOut: parsed.rows.length - filtered.length,
      rows,
      create: rows.filter((r) => r.status === "create").length,
      update: rows.filter((r) => r.status === "update").length,
      skip: rows.filter((r) => r.status === "skip"),
      withGithub: built.filter((r) => r.githubUrl).length,
      withVideo: built.filter((r) => r.videoUrl).length,
      withEmail: built.filter((r) => r.email || r.teamMembers?.length).length,
    };
  }, [
    parsed,
    importState,
    mapping,
    prizeHeader,
    prizeContains,
    statusHeader,
    submittedOnly,
  ]);

  const missingTitle =
    parsed !== null && !Object.values(mapping).includes("title");

  const reset = () => {
    setParsed(null);
    setParseError("");
    setMapping({});
    setResult(null);
    setProgress({ done: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFile = (file: File) => {
    setParseError("");
    setResult(null);
    if (file.size > MAX_FILE_BYTES) {
      setParseError("That file is larger than 15 MB. Split it and try again.");
      return;
    }
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
      complete: (results) => {
        const headers = (results.meta.fields ?? []).filter(
          (header) => header.length > 0,
        );
        if (headers.length === 0 || results.data.length === 0) {
          setParseError("No rows found. Check that the file has a header row.");
          return;
        }
        setParsed({ name: file.name, headers, rows: results.data });
        setMapping(buildMapping(headers, importState?.mapping));
      },
      error: (error) => {
        setParseError(`Could not read the file: ${error.message}`);
      },
    });
  };

  // One target per single value field: picking it moves it off any other header
  const setTarget = (header: string, target: CsvTarget) => {
    setMapping((prev) => {
      const next: CsvMapping = { ...prev };
      if (isSingleTarget(target)) {
        for (const [otherHeader, otherTarget] of Object.entries(next)) {
          if (otherHeader !== header && otherTarget === target) {
            next[otherHeader] = "extra";
          }
        }
      }
      next[header] = target;
      return next;
    });
  };

  const handleImport = async () => {
    if (!preview || !parsed) return;
    const toSend = preview.rows
      .filter((r) => r.status !== "skip")
      .map((r) => r.row);
    const batches = chunk(toSend, BATCH_SIZE);
    const totals: ImportResult = {
      created: 0,
      updated: 0,
      skipped: preview.skip.map((r) => ({
        importKey: r.row.importKey,
        title: r.row.title || r.row.importKey || "Untitled row",
        reason: r.reason ?? "Skipped",
      })),
      failedBatches: 0,
    };
    setImporting(true);
    setResult(null);
    setProgress({ done: 0, total: toSend.length });

    // Remember the mapping so the next upload of this export maps itself
    try {
      await saveImportMapping({
        groupId: group._id,
        mapping: Object.entries(mapping).map(([header, target]) => ({
          header,
          target,
        })),
      });
    } catch {
      // Mapping memory is a convenience; never block the import on it
    }

    let done = 0;
    for (const batch of batches) {
      try {
        const res = await importCsvBatch({
          groupId: group._id,
          includeInDirectory,
          tagId: selectedTag ? (selectedTag._id as Id<"tags">) : undefined,
          rows: batch,
        });
        totals.created += res.created;
        totals.updated += res.updated;
        totals.skipped.push(...res.skipped);
      } catch (err) {
        totals.failedBatches += 1;
        const message =
          err instanceof Error
            ? err.message.replace(/^\[.*?\]\s*/, "")
            : "Import failed";
        totals.skipped.push(
          ...batch.map((row) => ({
            importKey: row.importKey,
            title: row.title,
            reason: `Batch failed: ${message}`,
          })),
        );
      }
      done += batch.length;
      setProgress({ done, total: toSend.length });
    }

    setResult(totals);
    setImporting(false);
  };

  const visibleHeaders = parsed
    ? showAllMappings
      ? parsed.headers
      : parsed.headers.filter((header) => mapping[header] !== "teamMember")
    : [];
  const teamColumnCount = parsed
    ? parsed.headers.filter((header) => mapping[header] === "teamMember")
        .length
    : 0;
  const sendCount = preview ? preview.create + preview.update : 0;
  const percent =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <SectionCard
      title="Import from CSV"
      description="Upload a Devpost Projects export (or any CSV). Each row becomes a submission in this group with no account. Judges, the AI judge, and group emails all work with imported rows. Uploading the same export again updates rows instead of duplicating them."
      headerAction={
        parsed && !importing ? (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-hairline text-copy hover:bg-surface-hover transition-colors"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        ) : undefined
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label="Choose a CSV file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {!parsed && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          disabled={importState === undefined}
          className="w-full flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-hairline-strong px-4 py-6 text-[13px] text-soft hover:bg-surface-hover transition-colors disabled:opacity-50"
        >
          <FileUp className="w-5 h-5 text-faint" />
          <span className="text-copy font-medium">
            Choose a CSV file or drop it here
          </span>
          <span className="text-xs">
            From Devpost, export projects as CSV with submitter emails
            included so you can message teams
          </span>
        </button>
      )}

      {parseError && <p className="text-[13px] text-red-600">{parseError}</p>}

      {parsed && (
        <>
          <p className="text-[13px] text-copy">
            <span className="font-medium">{parsed.name}</span>
            <span className="text-soft">
              {" "}
              · {parsed.rows.length} rows · {parsed.headers.length} columns
            </span>
          </p>

          {/* Column mapping */}
          <div>
            <div className="flex items-center justify-between gap-3">
              <Label>Map columns</Label>
              {teamColumnCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllMappings((v) => !v)}
                  className="text-xs text-soft hover:text-copy"
                >
                  {showAllMappings
                    ? "Hide team member columns"
                    : `Show ${teamColumnCount} team member columns`}
                </button>
              )}
            </div>
            <div className="mt-1.5 max-h-72 overflow-y-auto rounded-md border border-hairline divide-y divide-hairline">
              {visibleHeaders.map((header) => (
                <div
                  key={header}
                  className="grid grid-cols-1 sm:grid-cols-2 items-center gap-2 px-3 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] text-copy truncate" title={header}>
                      {header}
                    </p>
                    <p className="text-xs text-faint truncate">
                      {parsed.rows[0]?.[header]?.slice(0, 80) || "empty"}
                    </p>
                  </div>
                  <SimpleSelect
                    value={mapping[header] ?? "extra"}
                    onChange={(value) => setTarget(header, value as CsvTarget)}
                    options={TARGET_OPTIONS}
                    disabled={importing}
                    aria-label={`Field for ${header}`}
                    className="h-8 text-[13px]"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-faint mt-1.5">
              Extra fields show to judges as additional answers and are read by
              the AI judge as self reported context. Team member columns are
              grouped into the team list used for group emails.
            </p>
            {missingTitle && (
              <p className="text-[13px] text-red-600 mt-1">
                Map one column to Title to continue.
              </p>
            )}
          </div>

          {/* Row filters, offered only when the export has these columns */}
          {(prizeHeader || statusHeader) && (
            <div className="space-y-2">
              <Label>Filter rows</Label>
              {prizeHeader && (
                <div className="flex items-center gap-2 flex-wrap text-[13px] text-copy">
                  <span>Only rows where {prizeHeader} contains</span>
                  <Input
                    value={prizeContains}
                    onChange={(e) => setPrizeContains(e.target.value)}
                    disabled={importing}
                    className="h-8 w-40"
                    aria-label="Prize filter text"
                  />
                  <span className="text-xs text-faint">
                    Leave empty to keep every row
                  </span>
                </div>
              )}
              {statusHeader && (
                <label className="flex items-center gap-2 text-[13px] text-copy cursor-pointer">
                  <input
                    type="checkbox"
                    checked={submittedOnly}
                    onChange={(e) => setSubmittedOnly(e.target.checked)}
                    disabled={importing}
                    className="rounded border-hairline-strong"
                  />
                  Only rows where {statusHeader} is Submitted (skip drafts)
                </label>
              )}
            </div>
          )}

          {/* Public directory switch, off by default */}
          <label className="flex items-start gap-2 text-[13px] text-copy cursor-pointer">
            <input
              type="checkbox"
              checked={includeInDirectory}
              onChange={(e) => setIncludeInDirectory(e.target.checked)}
              disabled={importing}
              className="mt-0.5 rounded border-hairline-strong"
            />
            <span>
              Show in public directory
              <span className="block text-xs text-soft">
                {includeInDirectory
                  ? `New rows publish to the site${
                      importState?.requiredTagName
                        ? ` with the ${importState.requiredTagName} tag`
                        : ""
                    }.`
                  : "Off: new rows are judging only. They never appear on the site, tag pages, search, or profiles, and they link to their source page instead."}
                {" "}Applies to new rows only; updated rows keep their current
                visibility.
              </span>
            </span>
          </label>

          {/* Optional tag for every imported row */}
          <div className="space-y-1.5">
            <Label htmlFor="csv-import-tag">Tag</Label>
            <SimpleSelect
              id="csv-import-tag"
              value={tagValue}
              onChange={(value) => setTagChoice(value)}
              options={tagOptions}
              disabled={importing}
              aria-label="Tag for imported rows"
              className="h-8 text-[13px] sm:w-80"
            />
            {tagValue === "new" && (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleCreateTag();
                    }
                  }}
                  maxLength={40}
                  disabled={creatingTag || importing}
                  className="h-8 w-56"
                  aria-label="New tag name"
                  autoComplete="off"
                />
                <label className="flex items-center gap-1.5 text-[13px] text-copy cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mustBePrivate || newTagPrivate}
                    onChange={(e) => setNewTagPrivate(e.target.checked)}
                    disabled={mustBePrivate || creatingTag || importing}
                    className="rounded border-hairline-strong"
                  />
                  Private
                </label>
                <button
                  type="button"
                  onClick={() => void handleCreateTag()}
                  disabled={!newTagName.trim() || creatingTag || importing}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-hairline text-copy hover:bg-surface-hover transition-colors disabled:opacity-50"
                >
                  {creatingTag ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}
                  Create tag
                </button>
              </div>
            )}
            <p className="text-xs text-soft">
              {selectedTag
                ? selectedTag.isPrivate
                  ? `Every row gets ${selectedTag.name}. Private tags never show on the site, tag pages, or app cards; use them to find and filter these rows in admin.`
                  : `Every row gets ${selectedTag.name}, shown publicly on app cards and its tag page.`
                : "Optional. Re uploads add the tag to existing rows and never remove one."}
              {!includeInDirectory &&
                " Rows kept off the public directory can only use private tags."}
              {includeInDirectory &&
                importState?.canCreatePublicTag !== true &&
                tagValue === "new" &&
                " New tags you create here are private; public tags need tag management access."}
            </p>
          </div>

          {/* Preview counts */}
          {preview && (
            <div className="rounded-md border border-hairline px-3 py-2.5 space-y-1.5">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] tabular-nums">
                <span className="text-copy">
                  <span className="font-semibold text-ink">
                    {preview.create}
                  </span>{" "}
                  new
                </span>
                <span className="text-copy">
                  <span className="font-semibold text-ink">
                    {preview.update}
                  </span>{" "}
                  update
                </span>
                <span className="text-copy">
                  <span className="font-semibold text-ink">
                    {preview.skip.length}
                  </span>{" "}
                  skip
                </span>
                {preview.filteredOut > 0 && (
                  <span className="text-soft">
                    {preview.filteredOut} filtered out
                  </span>
                )}
              </div>
              <p className="text-xs text-soft tabular-nums">
                {preview.withGithub} with a GitHub repo · {preview.withVideo}{" "}
                with a video · {preview.withEmail} with an email for group
                messages
              </p>
              {preview.skip.length > 0 && (
                <details className="text-xs text-soft">
                  <summary className="cursor-pointer hover:text-copy">
                    Why rows will be skipped
                  </summary>
                  <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                    {preview.skip.map((r, idx) => (
                      <li key={`${r.row.importKey}-${idx}`} className="truncate">
                        {r.row.title || r.row.importKey || "Untitled row"}:{" "}
                        {r.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {/* Progress */}
          {importing && (
            <div className="space-y-1">
              <div
                className="h-1.5 w-full rounded-full bg-surface-alt overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label="Import progress"
              >
                <div
                  className="h-full bg-cta transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-xs text-soft tabular-nums">
                Imported {progress.done} of {progress.total}
              </p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div
              className="rounded-md bg-surface-alt px-3 py-2.5 text-[13px] text-copy space-y-1"
              aria-live="polite"
            >
              <p>
                Done: {result.created} created, {result.updated} updated,{" "}
                {result.skipped.length} skipped.
                {result.failedBatches > 0 &&
                  ` ${result.failedBatches} batch${
                    result.failedBatches === 1 ? "" : "es"
                  } failed; run the import again to retry them.`}
              </p>
              {result.skipped.length > 0 && (
                <ul className="text-xs text-soft space-y-0.5 max-h-32 overflow-y-auto">
                  {result.skipped.map((r, idx) => (
                    <li key={`${r.importKey}-${idx}`} className="truncate">
                      {r.title}: {r.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={importing || missingTitle || sendCount === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium rounded-md bg-cta text-on-cta hover:bg-cta-hover transition-colors disabled:opacity-50"
            >
              {importing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              {importing
                ? "Importing..."
                : `Import ${sendCount} row${sendCount === 1 ? "" : "s"}`}
            </button>
          </div>
        </>
      )}
    </SectionCard>
  );
}
