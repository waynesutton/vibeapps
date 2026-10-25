// Pure helpers for importing a CSV (Devpost Projects export or similar) into
// a judging group. Parsing happens in the browser with papaparse; these
// functions map headers to story fields and build the rows the
// judgingGroupImports.importCsvBatch mutation accepts.

// Story fields a CSV column can map to
export const CSV_TARGETS = [
  "importKey",
  "sourceUrl",
  "title",
  "tagline",
  "longDescription",
  "url",
  "githubUrl",
  "tryItOut",
  "videoUrl",
  "linkedinUrl",
  "twitterUrl",
  "submitterFirstName",
  "submitterLastName",
  "submitterName",
  "email",
  "teamName",
  "submittedAt",
  "teamMember",
  "extra",
  "ignore",
] as const;

export type CsvTarget = (typeof CSV_TARGETS)[number];

export const CSV_TARGET_LABELS: Record<CsvTarget, string> = {
  importKey: "Unique ID",
  sourceUrl: "Source page (also the unique ID)",
  title: "Title",
  tagline: "Tagline",
  longDescription: "Description",
  url: "Live app URL",
  githubUrl: "GitHub URL",
  tryItOut: "Links list (GitHub and live app)",
  videoUrl: "Video URL",
  linkedinUrl: "LinkedIn URL",
  twitterUrl: "X / Twitter URL",
  submitterFirstName: "Submitter first name",
  submitterLastName: "Submitter last name",
  submitterName: "Submitter full name",
  email: "Submitter email",
  teamName: "Team name",
  submittedAt: "Submitted at (date)",
  teamMember: "Team member column",
  extra: "Extra field for judges",
  ignore: "Ignore",
};

export type CsvMapping = Record<string, CsvTarget>;

export type CsvRow = Record<string, string>;

// Row shape sent to importCsvBatch
export type ImportRow = {
  importKey: string;
  title: string;
  tagline?: string;
  longDescription?: string;
  url?: string;
  githubUrl?: string;
  videoUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  sourceUrl?: string;
  submitterName?: string;
  email?: string;
  teamName?: string;
  teamMembers?: Array<{ name: string; email: string }>;
  submittedAt?: number;
  extraAnswers: Array<{ key: string; label: string; value: string }>;
};

// "Team Member 2 First Name", "Team Member 3 Email", ...
const TEAM_MEMBER_HEADER =
  /^team\s*member\s*(\d+)\s*(first\s*name|last\s*name|name|email)$/i;

// Devpost bookkeeping columns: not useful to judges or the AI judge
const IGNORED_HEADERS = new Set([
  "project status",
  "judging status",
  "highest step completed",
  "project created at",
  "additional team member count",
]);

// Exact header matches (lowercased, trimmed) for Devpost and common exports
const HEADER_TARGETS: Record<string, CsvTarget> = {
  "project title": "title",
  title: "title",
  "project name": "title",
  name: "title",
  "submission url": "sourceUrl",
  "devpost url": "sourceUrl",
  "project url": "sourceUrl",
  id: "importKey",
  "submission id": "importKey",
  "project id": "importKey",
  tagline: "tagline",
  "elevator pitch": "tagline",
  "short description": "tagline",
  "about the project": "longDescription",
  description: "longDescription",
  "project description": "longDescription",
  '"try it out" links': "tryItOut",
  "try it out links": "tryItOut",
  "try it out": "tryItOut",
  "live url": "url",
  "live app url": "url",
  "app url": "url",
  "demo url": "url",
  website: "url",
  "github url": "githubUrl",
  github: "githubUrl",
  "repo url": "githubUrl",
  "repository url": "githubUrl",
  "video demo link": "videoUrl",
  "video url": "videoUrl",
  "demo video": "videoUrl",
  video: "videoUrl",
  "linkedin url": "linkedinUrl",
  linkedin: "linkedinUrl",
  "twitter url": "twitterUrl",
  "x url": "twitterUrl",
  "submitter first name": "submitterFirstName",
  "first name": "submitterFirstName",
  "submitter last name": "submitterLastName",
  "last name": "submitterLastName",
  "submitter name": "submitterName",
  "submitter email": "email",
  email: "email",
  "team name": "teamName",
  "submitted at": "submittedAt",
  "submission date": "submittedAt",
};

// Header names are lowercased with smart quotes flattened
function headerKey(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .trim()
    .toLowerCase();
}

// Best guess target for one header
export function guessTarget(header: string): CsvTarget {
  const key = headerKey(header);
  if (TEAM_MEMBER_HEADER.test(key)) return "teamMember";
  if (IGNORED_HEADERS.has(key)) return "ignore";
  return HEADER_TARGETS[key] ?? "extra";
}

// Mapping for a header list: a saved mapping wins, then the guess. A single
// value target (title, email, ...) is only assigned to the first header
// that claims it; later ones fall back to an extra field.
export function buildMapping(
  headers: Array<string>,
  saved?: Array<{ header: string; target: string }>,
): CsvMapping {
  const savedByHeader = new Map<string, CsvTarget>();
  for (const entry of saved ?? []) {
    if ((CSV_TARGETS as ReadonlyArray<string>).includes(entry.target)) {
      savedByHeader.set(entry.header, entry.target as CsvTarget);
    }
  }
  const mapping: CsvMapping = {};
  const claimed = new Set<CsvTarget>();
  for (const header of headers) {
    let target = savedByHeader.get(header) ?? guessTarget(header);
    if (isSingleTarget(target)) {
      if (claimed.has(target)) target = "extra";
      else claimed.add(target);
    }
    mapping[header] = target;
  }
  return mapping;
}

// Targets that hold one value per row
export function isSingleTarget(target: CsvTarget): boolean {
  return target !== "extra" && target !== "ignore" && target !== "teamMember";
}

// Column filters offered when the export has these Devpost columns
export function findHeader(
  headers: Array<string>,
  name: string,
): string | undefined {
  const wanted = name.toLowerCase();
  return headers.find((header) => headerKey(header) === wanted);
}

export type RowFilters = {
  prizeHeader?: string;
  prizeContains: string;
  statusHeader?: string;
  submittedOnly: boolean;
};

export function rowPassesFilters(row: CsvRow, filters: RowFilters): boolean {
  if (filters.prizeHeader && filters.prizeContains.trim()) {
    const cell = (row[filters.prizeHeader] ?? "").toLowerCase();
    if (!cell.includes(filters.prizeContains.trim().toLowerCase())) {
      return false;
    }
  }
  if (filters.statusHeader && filters.submittedOnly) {
    const status = (row[filters.statusHeader] ?? "").trim().toLowerCase();
    if (!status.startsWith("submitted")) return false;
  }
  return true;
}

const URL_PATTERN = /https?:\/\/[^\s,;"'<>]+/gi;

// Every absolute URL inside a cell, trailing punctuation removed
export function extractUrls(cell: string): Array<string> {
  const matches = cell.match(URL_PATTERN) ?? [];
  return matches.map((url) => url.replace(/[).\]]+$/, ""));
}

function isGithubRepoUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?github\.com\/[^/\s]+\/[^/\s#?]+/i.test(url);
}

function isDevpostUrl(url: string): boolean {
  return /^https?:\/\/([a-z0-9-]+\.)?devpost\.com\//i.test(url);
}

// Trim a GitHub link down to the repo root (drops /tree/main etc.)
function githubRepoRoot(url: string): string {
  const match = url.match(
    /^(https?:\/\/(?:www\.)?github\.com\/[^/\s]+\/[^/\s#?]+)/i,
  );
  return match ? match[1].replace(/\.git$/i, "") : url;
}

// Split a "Try it out" cell: first GitHub repo link and first other link
export function splitLinks(cell: string): {
  githubUrl?: string;
  liveUrl?: string;
} {
  let githubUrl: string | undefined;
  let liveUrl: string | undefined;
  for (const url of extractUrls(cell)) {
    if (!githubUrl && isGithubRepoUrl(url)) {
      githubUrl = githubRepoRoot(url);
    } else if (!liveUrl && !isGithubRepoUrl(url) && !isDevpostUrl(url)) {
      liveUrl = url;
    }
  }
  return { githubUrl, liveUrl };
}

function firstUrl(cell: string | undefined): string | undefined {
  if (!cell) return undefined;
  return extractUrls(cell)[0];
}

function parseDate(cell: string | undefined): number | undefined {
  if (!cell?.trim()) return undefined;
  const ms = Date.parse(cell.trim());
  return Number.isFinite(ms) && ms > 0 ? ms : undefined;
}

// Stable key for extra answers derived from the header text
export function extraKey(header: string): string {
  const slug = headerKey(header)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `csv_${slug || "field"}`;
}

// Build one mutation row from a CSV row and the mapping
export function buildImportRow(row: CsvRow, mapping: CsvMapping): ImportRow {
  const single: Partial<Record<CsvTarget, string>> = {};
  const extraAnswers: ImportRow["extraAnswers"] = [];
  const members = new Map<
    number,
    { first: string; last: string; name: string; email: string }
  >();

  for (const [header, target] of Object.entries(mapping)) {
    const value = (row[header] ?? "").trim();
    if (target === "ignore") continue;
    if (target === "extra") {
      if (value) {
        extraAnswers.push({
          key: extraKey(header),
          label: header.replace(/^\uFEFF/, "").trim(),
          value,
        });
      }
      continue;
    }
    if (target === "teamMember") {
      const match = headerKey(header).match(TEAM_MEMBER_HEADER);
      if (!match || !value) continue;
      const index = Number(match[1]);
      const part = match[2].replace(/\s+/g, " ");
      const member = members.get(index) ?? {
        first: "",
        last: "",
        name: "",
        email: "",
      };
      if (part === "first name") member.first = value;
      else if (part === "last name") member.last = value;
      else if (part === "name") member.name = value;
      else member.email = value;
      members.set(index, member);
      continue;
    }
    if (value) single[target] = value;
  }

  const links = splitLinks(single.tryItOut ?? "");
  // Last resort GitHub link: a repo URL inside the description
  const describedRepo = !links.githubUrl
    ? extractUrls(single.longDescription ?? "").find(isGithubRepoUrl)
    : undefined;
  const githubCell = firstUrl(single.githubUrl);
  const githubUrl = githubCell
    ? githubRepoRoot(githubCell)
    : (links.githubUrl ??
      (describedRepo ? githubRepoRoot(describedRepo) : undefined));
  const sourceUrl = firstUrl(single.sourceUrl);
  const title = single.title ?? "";

  const submitterName =
    single.submitterName ??
    ([single.submitterFirstName, single.submitterLastName]
      .filter(Boolean)
      .join(" ") ||
      undefined);

  const teamMembers = [...members.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, member]) => ({
      name: member.name || [member.first, member.last].filter(Boolean).join(" "),
      email: member.email,
    }))
    .filter((member) => member.name || member.email);

  const importKey =
    single.importKey ??
    sourceUrl ??
    (title ? `title:${title.toLowerCase()}` : "");

  return {
    importKey,
    title,
    tagline: single.tagline,
    longDescription: single.longDescription,
    url: firstUrl(single.url) ?? links.liveUrl,
    githubUrl,
    videoUrl: firstUrl(single.videoUrl),
    linkedinUrl: firstUrl(single.linkedinUrl),
    twitterUrl: firstUrl(single.twitterUrl),
    sourceUrl,
    submitterName,
    email: single.email,
    teamName: single.teamName,
    teamMembers: teamMembers.length > 0 ? teamMembers : undefined,
    submittedAt: parseDate(single.submittedAt),
    extraAnswers,
  };
}

// Same normalization the server uses for duplicate URL checks
export function normalizeUrlForMatch(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.host.toLowerCase()}${path}${url.search}`;
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, "");
  }
}

export type PreviewStatus = "create" | "update" | "skip";

export type PreviewRow = {
  row: ImportRow;
  status: PreviewStatus;
  reason?: string;
};

// Client side preview; the server re-checks everything on import
export function previewRows(
  rows: Array<ImportRow>,
  importedKeys: Set<string>,
  existingUrls: Set<string>,
): Array<PreviewRow> {
  const seenKeys = new Set<string>();
  return rows.map((row) => {
    if (!row.importKey) {
      return { row, status: "skip", reason: "Missing unique ID" };
    }
    if (seenKeys.has(row.importKey)) {
      return { row, status: "skip", reason: "Duplicate row in this file" };
    }
    seenKeys.add(row.importKey);
    if (!row.title) return { row, status: "skip", reason: "Missing title" };
    const link = row.url ?? row.githubUrl ?? row.sourceUrl;
    if (!link) {
      return {
        row,
        status: "skip",
        reason: "No live URL, GitHub URL, or source URL",
      };
    }
    if (importedKeys.has(row.importKey)) return { row, status: "update" };
    const normalized = normalizeUrlForMatch(link);
    if (normalized && existingUrls.has(normalized)) {
      return {
        row,
        status: "skip",
        reason: "A submission with this URL is already in the group",
      };
    }
    return { row, status: "create" };
  });
}

// Split an array into fixed size chunks
export function chunk<T>(items: Array<T>, size: number): Array<Array<T>> {
  const out: Array<Array<T>> = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
