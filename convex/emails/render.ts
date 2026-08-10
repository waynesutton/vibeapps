// Shared, dependency-free helpers for template emails. This module has no
// Convex imports on purpose: the backend send pipeline and the admin UI
// preview both import it so rendered output always matches.

// Variables supported in template subjects, bodies, and signatures.
export const TEMPLATE_VARIABLES = [
  { key: "firstname", description: "Recipient first name" },
  { key: "name", description: "Recipient full name" },
  { key: "email", description: "Recipient email address" },
  { key: "groupname", description: "Judging group name" },
] as const;

export type TemplateVars = {
  firstname: string;
  name: string;
  email: string;
  groupname: string;
};

// Replace {{variable}} placeholders (case-insensitive, optional spaces).
// Unknown variables are left as typed so typos show up in test sends.
export function applyTemplateVars(text: string, vars: TemplateVars): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, rawKey: string) => {
    const key = rawKey.toLowerCase() as keyof TemplateVars;
    return key in vars ? vars[key] : match;
  });
}

// Escape user-provided text before any HTML is generated from it.
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Inline markdown: **bold**, *italic* or _italic_, [text](https://url).
// Runs on already-escaped text, so only these patterns produce HTML.
function renderInline(escaped: string): string {
  let out = escaped;
  // Links first so bold/italic inside link text still render
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" style="color: #292929;">$1</a>',
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/_([^_]+)_/g, "<em>$1</em>");
  return out;
}

/**
 * Markdown-lite to email HTML: paragraphs, unordered lists (- item),
 * bold, italic, and links. Input is escaped first so recipient-provided
 * values substituted into the template cannot inject markup.
 */
export function renderMarkdownLite(markdown: string): string {
  const escaped = escapeHtml(markdown.replace(/\r\n/g, "\n"));
  const blocks = escaped.split(/\n{2,}/);
  const html: Array<string> = [];

  for (const block of blocks) {
    const lines = block.split("\n").filter((line) => line.trim() !== "");
    if (lines.length === 0) continue;

    const isList = lines.every((line) => /^\s*[-*]\s+/.test(line));
    if (isList) {
      const items = lines
        .map(
          (line) =>
            `<li style="margin-bottom: 6px;">${renderInline(line.replace(/^\s*[-*]\s+/, ""))}</li>`,
        )
        .join("");
      html.push(
        `<ul style="color: #666; margin: 0 0 20px; padding-left: 22px;">${items}</ul>`,
      );
    } else {
      // Single newlines inside a paragraph become <br>
      html.push(
        `<p style="color: #666; margin: 0 0 20px;">${lines
          .map(renderInline)
          .join("<br>")}</p>`,
      );
    }
  }

  return html.join("\n");
}

/**
 * Branded VibeApps email wrapper (same look as the submission emails).
 * The optional signature renders below the body above the footer.
 */
export function templateEmailShell(
  bodyHtml: string,
  signatureHtml?: string,
): string {
  const signatureBlock = signatureHtml
    ? `<div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e9ecef;">${signatureHtml}</div>`
    : "";
  return `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://vibeapps.dev/android-chrome-512x512.png" alt="VibeApps" style="width: 48px; height: 48px;">
            </div>
            ${bodyHtml}
            ${signatureBlock}
            <p style="color: #999; font-size: 13px; margin-top: 40px;">
              VibeApps - The place to share and discover new apps built with AI.
            </p>
          </div>
        </body>
      </html>
    `;
}

// First word of a full name, for the {{firstname}} variable.
export function firstNameOf(fullName: string): string {
  const trimmed = fullName.trim();
  if (trimmed === "") return "there";
  return trimmed.split(/\s+/)[0];
}

// Light email format check for the reply-to field.
export function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
