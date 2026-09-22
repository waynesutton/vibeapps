import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";

// One flattened row from the admin-only exportGroupSubmissions query.
export type SubmissionExportRow = FunctionReturnType<
  typeof api.judgingGroupSubmissions.exportGroupSubmissions
>[number];

// The few group fields the builders need. Structural so any group shape works.
type ExportGroup = {
  _id: string;
  name: string;
  slug: string;
};

// Options shared by the Markdown builders. siteOrigin lets each file link back
// to the public app page; exportedAt keeps output deterministic in tests.
type MarkdownExportOptions = {
  siteOrigin?: string;
  exportedAt?: string;
};

// Characters that would change meaning inside a heading or list item.
// Kept small on purpose: "." "-" "(" ")" "#" "!" are safe mid-line.
const INLINE_MARKDOWN_ESCAPES = /[\\`*_[\]<>|]/g;
const MAX_SAFE_FILENAME_LENGTH = 180;

// Escape a CSV cell. Quotes cells with separators or quotes, and prefixes a
// leading formula trigger (= + - @) so spreadsheets treat it as text.
export function escapeCsv(value: string): string {
  let firstVisibleCharacter = 0;
  while (firstVisibleCharacter < value.length) {
    const character = value[firstVisibleCharacter];
    const characterCode = value.charCodeAt(firstVisibleCharacter);
    if (
      characterCode > 32 &&
      characterCode !== 127 &&
      character.trim() !== ""
    ) {
      break;
    }
    firstVisibleCharacter++;
  }
  const firstVisibleValue = value[firstVisibleCharacter];
  const safeValue =
    firstVisibleValue !== undefined && "=+-@".includes(firstVisibleValue)
      ? `'${value}`
      : value;
  if (/[",\r\n]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

// Lowercase, hyphenated, ASCII-only filename stem with a length cap.
export function safeFilename(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_SAFE_FILENAME_LENGTH)
    .replace(/-$/, "");
  return sanitized || "submission";
}

// Escape a single-line value for use inside a heading or list item.
// Newlines collapse to spaces so a title can never break the structure.
export function escapeInline(value: string): string {
  return value
    .replace(/\s*\r?\n\s*/g, " ")
    .replace(INLINE_MARKDOWN_ESCAPES, (character) => `\\${character}`)
    .trim();
}

// Normalize line endings and trim so a raw Markdown body slots in cleanly.
function normalizeMarkdownBody(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

// JSON strings are valid YAML double-quoted scalars, so this keeps quotes,
// colons, hashes, and newlines safe without a YAML library.
function yamlScalar(value: string | number): string {
  return typeof value === "number" ? String(value) : JSON.stringify(value);
}

// Build a YAML frontmatter block from ordered key/value pairs.
// Arrays render as flow sequences; undefined values are skipped.
function yamlFrontmatter(
  entries: Array<[string, string | number | string[] | undefined]>,
): string {
  const lines = entries.flatMap(([key, value]) => {
    if (value === undefined) return [];
    if (Array.isArray(value)) {
      return [`${key}: [${value.map(yamlScalar).join(", ")}]`];
    }
    return [`${key}: ${yamlScalar(value)}`];
  });
  return ["---", ...lines, "---"].join("\n");
}

// Render one "- **Label:** <url>" list line. Only http(s) URLs become
// autolinks; anything else is escaped and printed as text.
function markdownLink(label: string, url?: string): string | null {
  if (!url) return null;
  const prefix = `- **${label}:**`;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return `${prefix} ${escapeInline(url)}`;
    }
    return `${prefix} <${parsed.toString()}>`;
  } catch {
    return `${prefix} ${escapeInline(url)}`;
  }
}

// Split the comma-joined tag string from the export query into a clean list.
function splitTags(tags: string): string[] {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

// Public app page for a submission when the caller passes a site origin.
function submissionPageUrl(
  slug: string,
  siteOrigin?: string,
): string | undefined {
  if (!siteOrigin) return undefined;
  return `${siteOrigin.replace(/\/$/, "")}/s/${slug}`;
}

// JSON download: group metadata plus the untouched export rows.
export function buildSubmissionJson(
  group: ExportGroup,
  rows: SubmissionExportRow[],
  exportedAt = new Date().toISOString(),
): string {
  return JSON.stringify(
    {
      group: { id: group._id, name: group.name, slug: group.slug },
      exportedAt,
      submissions: rows,
    },
    null,
    2,
  );
}

// CSV download: same columns as the original export, CRLF lines, UTF-8 BOM so
// Excel opens it with the right encoding.
export function buildSubmissionCsv(rows: SubmissionExportRow[]): string {
  const headers = [
    "App Title",
    "App/Project Tagline",
    "Description",
    "App Website Link",
    "Video Demo URL",
    "GitHub",
    "LinkedIn",
    "Twitter/X",
    "Chef Show URL",
    "Chef App URL",
    "Tags",
    "Team Name",
    "Team Member Count",
    "Team Members",
    "Submitter Name",
    "Email",
    "Slug",
    "Votes",
  ];
  const csvLines = [headers.map(escapeCsv).join(",")];
  for (const row of rows) {
    csvLines.push(
      [
        row.title,
        row.tagline,
        row.longDescription || "",
        row.url,
        row.videoUrl || "",
        row.githubUrl || "",
        row.linkedinUrl || "",
        row.twitterUrl || "",
        row.chefShowUrl || "",
        row.chefAppUrl || "",
        row.tags,
        row.teamName || "",
        row.teamMemberCount !== undefined ? String(row.teamMemberCount) : "",
        row.teamMembers,
        row.submitterName || "",
        row.email || "",
        row.slug,
        String(row.votes),
      ]
        .map(escapeCsv)
        .join(","),
    );
  }
  return `\uFEFF${csvLines.join("\r\n")}`;
}

export type SubmissionMarkdownFile = {
  filename: string;
  title: string;
  content: string;
};

// One Markdown file per submission. Short fields are escaped inline; the long
// description is already Markdown (it renders through <Markdown> on the story
// page) so it is written as the author wrote it. Frontmatter makes each file
// machine readable for agents and static site tools.
export function buildSubmissionMarkdownFiles(
  rows: SubmissionExportRow[],
  options: MarkdownExportOptions = {},
): SubmissionMarkdownFile[] {
  const sequenceWidth = String(rows.length).length;
  return rows.map((row, index) => {
    const page = submissionPageUrl(row.slug, options.siteOrigin);
    const frontmatter = yamlFrontmatter([
      ["title", row.title],
      ["slug", row.slug],
      ["url", row.url],
      ["page", page],
      ["tags", splitTags(row.tags)],
      ["votes", row.votes],
      ["teamName", row.teamName],
      ["submitter", row.submitterName],
    ]);
    const links = [
      markdownLink("Website", row.url),
      markdownLink("App page", page),
      markdownLink("Video demo", row.videoUrl),
      markdownLink("GitHub", row.githubUrl),
      markdownLink("LinkedIn", row.linkedinUrl),
      markdownLink("Twitter/X", row.twitterUrl),
      markdownLink("Chef Show", row.chefShowUrl),
      markdownLink("Chef App", row.chefAppUrl),
    ].filter((line): line is string => line !== null);
    const description = row.longDescription
      ? normalizeMarkdownBody(row.longDescription)
      : "";
    const content = [
      frontmatter,
      "",
      `# ${escapeInline(row.title)}`,
      ...(row.tagline ? ["", escapeInline(row.tagline)] : []),
      ...(description ? ["", "## Description", "", description] : []),
      "",
      "## Details",
      "",
      `- **Slug:** ${escapeInline(row.slug)}`,
      `- **Tags:** ${escapeInline(row.tags || "None")}`,
      `- **Votes:** ${row.votes}`,
      ...(row.teamName ? [`- **Team:** ${escapeInline(row.teamName)}`] : []),
      ...(row.teamMemberCount !== undefined
        ? [`- **Team member count:** ${row.teamMemberCount}`]
        : []),
      ...(row.teamMembers
        ? [`- **Team members:** ${escapeInline(row.teamMembers)}`]
        : []),
      ...(row.submitterName
        ? [`- **Submitter:** ${escapeInline(row.submitterName)}`]
        : []),
      ...(row.email ? [`- **Email:** ${escapeInline(row.email)}`] : []),
      ...(links.length > 0 ? ["", "## Links", "", ...links] : []),
      "",
    ].join("\n");
    const order = String(index + 1).padStart(sequenceWidth, "0");
    return {
      filename: `${order}-${safeFilename(row.slug || row.title)}.md`,
      title: row.title,
      content,
    };
  });
}

// README.md for the ZIP: what the archive is, when it was made, and a linked
// list of every file so the download is self describing.
export function buildSubmissionMarkdownIndex(
  group: ExportGroup,
  files: SubmissionMarkdownFile[],
  exportedAt = new Date().toISOString(),
): string {
  const frontmatter = yamlFrontmatter([
    ["group", group.name],
    ["slug", group.slug],
    ["exportedAt", exportedAt],
    ["count", files.length],
  ]);
  return [
    frontmatter,
    "",
    `# ${escapeInline(group.name)} submissions`,
    "",
    `Exported ${exportedAt}. ${files.length} ${files.length === 1 ? "submission" : "submissions"}, one Markdown file each with YAML frontmatter.`,
    "",
    "## Files",
    "",
    ...files.map(
      (file) => `- [${escapeInline(file.title)}](${encodeURI(file.filename)})`,
    ),
    "",
  ].join("\n");
}

// ZIP of one Markdown file per submission plus a README.md index.
// JSZip is loaded on demand so the main bundle does not carry it.
export async function buildSubmissionMarkdownZip(
  group: ExportGroup,
  rows: SubmissionExportRow[],
  options: MarkdownExportOptions = {},
): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  const files = buildSubmissionMarkdownFiles(rows, options);
  const zip = new JSZip();
  zip.file("README.md", buildSubmissionMarkdownIndex(group, files, exportedAt));
  for (const file of files) {
    zip.file(file.filename, file.content);
  }
  return await zip.generateAsync({ type: "blob", mimeType: "application/zip" });
}
