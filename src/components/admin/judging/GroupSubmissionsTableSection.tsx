import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Github,
  Linkedin,
  Search,
  Twitter,
} from "lucide-react";
import {
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { api } from "../../../../convex/_generated/api";
import { Input } from "../../ui/input";
import { SimpleSelect } from "../../ui/SimpleSelect";
import { useAdminAccess } from "../useAdminAccess";
import type { GroupDetails } from "./groupSection";
import { SubmissionDownloadControl } from "./SubmissionDownloadControl";

type SubmissionRow = FunctionReturnType<
  typeof api.judgingGroupSubmissions.listSubmissionsTable
>[number];

// Only sorting and pagination come from TanStack. Search is a plain filter
// below so it can span tag names, which no single column owns.
const submissionTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    text: sortFn_text,
  },
});

type SubmissionTableFeatures = typeof submissionTableFeatures;

const PAGE_SIZE_OPTIONS = [
  { value: "25", label: "25 per page" },
  { value: "50", label: "50 per page" },
  { value: "100", label: "100 per page" },
];

// Shorten a profile/repo URL to the part an organizer actually reads:
// github.com/acme/app -> acme/app, x.com/someone -> someone.
function shortLinkLabel(raw: string): string {
  try {
    const url = new URL(raw);
    const path = url.pathname.replace(/^\/+|\/+$/g, "");
    const trimmed = path.replace(/^(in|company|pub)\//, "");
    return trimmed || url.hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");
  }
}

// Copy-to-clipboard icon button. Flips to a green check for two seconds,
// matching the UrlRow feedback used elsewhere in the judging workspace.
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable; the link text stays selectable for manual copy
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      title={copied ? "Copied" : `Copy ${label}`}
      aria-label={`Copy ${label}`}
      className="p-1 rounded text-faint hover:text-copy hover:bg-surface-hover transition-colors flex-shrink-0"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-600" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

// One external link plus its copy action. Renders an em dash when the
// submitter never provided that link, so columns stay visually aligned.
function LinkCell({
  url,
  icon: Icon,
  label,
}: {
  url?: string;
  icon: typeof Github;
  label: string;
}) {
  if (!url) {
    return <span className="text-faint">&mdash;</span>;
  }

  return (
    <div className="flex items-center gap-0.5 min-w-0">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={url}
        className="inline-flex items-center gap-1.5 min-w-0 text-copy hover:text-ink transition-colors"
      >
        <Icon className="w-3.5 h-3.5 text-soft flex-shrink-0" />
        <span className="truncate max-w-[9rem]">{shortLinkLabel(url)}</span>
      </a>
      <CopyButton value={url} label={`${label} link`} />
    </div>
  );
}

// Read-only roster of everything in the group. List, copy, and open only:
// no mutation is wired into this section by design.
export function GroupSubmissionsTableSection({
  group,
}: {
  group: GroupDetails;
}) {
  const { can } = useAdminAccess();
  const rows = useQuery(api.judgingGroupSubmissions.listSubmissionsTable, {
    groupId: group._id,
  });

  const [sorting, setSorting] = useState<SortingState>([
    { id: "submittedAt", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [search, setSearch] = useState("");

  // Search spans title, slug, submitter, and tag names in one box
  const filteredRows = useMemo(() => {
    if (!rows) return [];
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [
        row.title,
        row.slug,
        row.submitterName ?? "",
        row.submitterUsername ?? "",
        ...row.tags.map((tag) => tag.name),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [rows, search]);

  const columns = useMemo<ColumnDef<SubmissionTableFeatures, SubmissionRow>[]>(
    () => [
      {
        id: "title",
        accessorKey: "title",
        header: "Submission",
        sortFn: "text",
        cell: ({ row }) => {
          const { title, slug } = row.original;
          const submissionPath = `/s/${slug}`;
          return (
            <div className="flex items-start gap-1 min-w-0">
              <div className="min-w-0">
                <Link
                  to={submissionPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="app-title-sm text-ink hover:underline inline-flex items-center gap-1 max-w-full"
                  title={`View ${title}`}
                >
                  <span className="truncate">{title}</span>
                  <ExternalLink className="w-3 h-3 text-faint flex-shrink-0" />
                </Link>
                <p className="text-xs text-soft font-mono truncate">
                  {submissionPath}
                </p>
              </div>
              <CopyButton
                value={`${window.location.origin}${submissionPath}`}
                label="submission link"
              />
            </div>
          );
        },
      },
      {
        id: "submittedAt",
        accessorKey: "submittedAt",
        header: "Submitted",
        sortFn: "basic",
        cell: ({ row }) => (
          <span
            className="text-copy tabular-nums whitespace-nowrap"
            title={format(new Date(row.original.submittedAt), "PPpp")}
          >
            {format(new Date(row.original.submittedAt), "MMM d, yyyy")}
          </span>
        ),
      },
      {
        id: "tags",
        header: "Tags",
        enableSorting: false,
        cell: ({ row }) => {
          const { tags } = row.original;
          if (tags.length === 0) {
            return <span className="text-faint">&mdash;</span>;
          }
          const shown = tags.slice(0, 3);
          const overflow = tags.length - shown.length;
          return (
            <div className="flex flex-wrap items-center gap-1 max-w-[14rem]">
              {shown.map((tag) => (
                <span
                  key={tag._id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                  style={{
                    backgroundColor:
                      tag.backgroundColor || "var(--th-surface-alt)",
                    color: tag.textColor || "var(--th-copy)",
                    border: `1px solid ${tag.backgroundColor ? "transparent" : "var(--th-hairline-strong)"}`,
                  }}
                >
                  {tag.emoji && <span>{tag.emoji}</span>}
                  {tag.name}
                </span>
              ))}
              {overflow > 0 && (
                <span
                  className="text-xs text-soft"
                  title={tags.map((tag) => tag.name).join(", ")}
                >
                  +{overflow}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "submitter",
        accessorFn: (row) => row.submitterName ?? row.submitterUsername ?? "",
        header: "Submitted by",
        sortFn: "text",
        cell: ({ row }) => {
          const { submitterName, submitterUsername } = row.original;
          if (!submitterName && !submitterUsername) {
            return <span className="text-faint">&mdash;</span>;
          }
          return (
            <div className="min-w-0">
              <p className="text-copy truncate">
                {submitterName ?? submitterUsername}
              </p>
              {submitterUsername && (
                <Link
                  to={`/${submitterUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-soft hover:text-ink truncate block"
                  title={`View @${submitterUsername} profile`}
                >
                  @{submitterUsername}
                </Link>
              )}
            </div>
          );
        },
      },
      {
        id: "linkedinUrl",
        header: "LinkedIn",
        enableSorting: false,
        cell: ({ row }) => (
          <LinkCell
            url={row.original.linkedinUrl}
            icon={Linkedin}
            label="LinkedIn"
          />
        ),
      },
      {
        id: "githubUrl",
        header: "GitHub",
        enableSorting: false,
        cell: ({ row }) => (
          <LinkCell url={row.original.githubUrl} icon={Github} label="GitHub" />
        ),
      },
      {
        id: "twitterUrl",
        header: "X",
        enableSorting: false,
        cell: ({ row }) => (
          <LinkCell url={row.original.twitterUrl} icon={Twitter} label="X" />
        ),
      },
      {
        id: "site",
        header: "Site",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-0.5">
            <a
              href={row.original.url}
              target="_blank"
              rel="noopener noreferrer"
              title={row.original.url}
              className="p-1 rounded text-faint hover:text-copy hover:bg-surface-hover transition-colors"
              aria-label={`Open ${row.original.title} website`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <CopyButton value={row.original.url} label="app website" />
          </div>
        ),
      },
    ],
    [],
  );

  const table = useTable({
    features: submissionTableFeatures,
    data: filteredRows,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  });

  const totalCount = rows?.length ?? 0;
  const pageRows = table.getRowModel().rows;
  const pageCount = table.getPageCount();

  return (
    <div className="rounded-lg border border-hairline bg-surface overflow-hidden">
      {/* Header: purpose, live count, and one search box */}
      <div className="px-5 pt-4 pb-3 border-b border-hairline space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">
              Submissions in this group
            </h3>
            <p className="text-[13px] text-soft mt-0.5">
              Read-only roster. Open a submission or copy a link; nothing here
              edits the entry.
            </p>
          </div>
          <span className="text-[13px] text-soft tabular-nums flex-shrink-0">
            {search.trim()
              ? `${filteredRows.length} of ${totalCount}`
              : `${totalCount} submission${totalCount === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[14rem]">
            <Search className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                // A narrower result set can drop the current page out of range
                setPagination((prev) => ({ ...prev, pageIndex: 0 }));
              }}
              placeholder="Search title, submitter, or tag..."
              className="pl-9"
              aria-label="Search submissions in this group"
            />
          </div>
          <SimpleSelect
            value={String(pagination.pageSize)}
            onChange={(value) =>
              setPagination({ pageIndex: 0, pageSize: Number(value) })
            }
            options={PAGE_SIZE_OPTIONS}
            className="w-40"
            aria-label="Rows per page"
          />
          {can("judging.results") && (
            <SubmissionDownloadControl group={group} />
          )}
        </div>
      </div>

      {rows === undefined ? (
        <p className="px-5 py-8 text-[13px] text-soft text-center">
          Loading submissions...
        </p>
      ) : totalCount === 0 ? (
        <p className="px-5 py-8 text-[13px] text-soft text-center">
          No submissions in this group yet. Add them from the Submissions
          section.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-hairline bg-surface-alt">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const sorted = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={
                            !canSort || !sorted
                              ? undefined
                              : sorted === "asc"
                                ? "ascending"
                                : "descending"
                          }
                          className="text-left px-4 py-2.5 font-medium text-copy whitespace-nowrap"
                        >
                          {canSort ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1 hover:text-ink transition-colors"
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                              {sorted === "asc" ? (
                                <ArrowUp className="w-3 h-3" />
                              ) : sorted === "desc" ? (
                                <ArrowDown className="w-3 h-3" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 text-faint" />
                              )}
                            </button>
                          ) : (
                            flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-8 text-center text-[13px] text-soft"
                    >
                      No submissions match "{search}"
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-hairline last:border-b-0 hover:bg-surface-hover transition-colors"
                    >
                      {row.getAllCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="px-4 py-3 align-top text-[13px]"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="px-5 py-3 border-t border-hairline bg-surface-alt flex items-center justify-between gap-3">
              <span className="text-[13px] text-soft tabular-nums">
                Page {pagination.pageIndex + 1} of {pageCount}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[13px] rounded-md border border-hairline text-copy hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[13px] rounded-md border border-hairline text-copy hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
