import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";

export type SubmissionExportRow = FunctionReturnType<
  typeof api.judgingGroupSubmissions.exportGroupSubmissions
>[number];

type ExportGroup = {
  _id: string;
  name: string;
  slug: string;
};

const MARKDOWN_SPECIAL_CHARACTERS = "\\`*_{}[]()#+-.!|<>~";
const MAX_SAFE_FILENAME_LENGTH = 180;

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

export function safeFilename(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_SAFE_FILENAME_LENGTH)
    .replace(/-$/, "");
  return sanitized || "submission";
}

function escapeMarkdown(value: string): string {
  return Array.from(value.replace(/\r\n?/g, "\n"))
    .map((character) =>
      MARKDOWN_SPECIAL_CHARACTERS.includes(character)
        ? `\\${character}`
        : character,
    )
    .join("")
    .replace(/\n/g, "  \n");
}

function markdownLink(label: string, url?: string): string | null {
  if (!url) return null;
  const prefix = `- **${escapeMarkdown(label)}:**`;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return `${prefix} ${escapeMarkdown(url)}`;
    }
    return `${prefix} <${parsed.toString()}>`;
  } catch {
    return `${prefix} ${escapeMarkdown(url)}`;
  }
}

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

export function buildSubmissionMarkdownFiles(rows: SubmissionExportRow[]) {
  const sequenceWidth = String(rows.length).length;
  return rows.map((row, index) => {
    const links = [
      markdownLink("Website", row.url),
      markdownLink("Video demo", row.videoUrl),
      markdownLink("GitHub", row.githubUrl),
      markdownLink("LinkedIn", row.linkedinUrl),
      markdownLink("Twitter/X", row.twitterUrl),
      markdownLink("Chef Show", row.chefShowUrl),
      markdownLink("Chef App", row.chefAppUrl),
    ].filter((line): line is string => line !== null);
    const content = [
      `# ${escapeMarkdown(row.title)}`,
      ...(row.tagline ? ["", escapeMarkdown(row.tagline)] : []),
      ...(row.longDescription
        ? ["", escapeMarkdown(row.longDescription)]
        : []),
      "",
      "## Details",
      "",
      `- **Slug:** ${escapeMarkdown(row.slug)}`,
      `- **Tags:** ${escapeMarkdown(row.tags || "None")}`,
      `- **Votes:** ${row.votes}`,
      ...(row.teamName
        ? [`- **Team:** ${escapeMarkdown(row.teamName)}`]
        : []),
      ...(row.teamMemberCount !== undefined
        ? [`- **Team member count:** ${row.teamMemberCount}`]
        : []),
      ...(row.teamMembers
        ? [`- **Team members:** ${escapeMarkdown(row.teamMembers)}`]
        : []),
      ...(row.submitterName
        ? [`- **Submitter:** ${escapeMarkdown(row.submitterName)}`]
        : []),
      ...(row.email ? [`- **Email:** ${escapeMarkdown(row.email)}`] : []),
      ...(links.length > 0 ? ["", "## Links", "", ...links] : []),
      "",
    ].join("\n");
    const order = String(index + 1).padStart(sequenceWidth, "0");
    return {
      filename: `${order}-${safeFilename(row.slug || row.title)}.md`,
      content,
    };
  });
}

export async function buildSubmissionMarkdownZip(
  rows: SubmissionExportRow[],
): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const file of buildSubmissionMarkdownFiles(rows)) {
    zip.file(file.filename, file.content);
  }
  return await zip.generateAsync({ type: "blob", mimeType: "application/zip" });
}
