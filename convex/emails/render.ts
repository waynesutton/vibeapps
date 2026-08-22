// Shared, dependency-free helpers for template emails. This module has no
// Convex imports on purpose: the backend send pipeline and the admin UI
// preview both import it so rendered output always matches.

// Variables supported in template subjects, bodies, and signatures.
export const TEMPLATE_VARIABLES = [
  { key: "firstname", description: "Recipient first name" },
  { key: "name", description: "Recipient full name" },
  { key: "email", description: "Recipient email address" },
  { key: "groupname", description: "Judging group name" },
  { key: "judgingurl", description: "Link to the group's judging page" },
  { key: "resultsurl", description: "Link to the group's results page" },
  { key: "submissionurl", description: "Link to the group's submission page" },
] as const;

export type TemplateVars = {
  firstname: string;
  name: string;
  email: string;
  groupname: string;
  judgingurl: string;
  resultsurl: string;
  submissionurl: string;
};

// Group links for templates, matching the share links in the group workspace
// (judging interface, results page, custom submission page). Used by the
// backend send pipeline and both admin previews so URLs never drift.
export function judgingGroupUrls(slug: string): {
  judgingurl: string;
  resultsurl: string;
  submissionurl: string;
} {
  const base = `https://vibeapps.dev/judging/${slug}`;
  return {
    judgingurl: base,
    resultsurl: `${base}/results`,
    submissionurl: `${base}/submit`,
  };
}

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

// Inline markdown: **bold**, *italic* or _italic_, [text](https://url),
// plus bare https URLs (so a link variable used on its own is clickable).
// Runs on already-escaped text, so only these patterns produce HTML.
function renderInline(escaped: string): string {
  let out = escaped;
  // Links first so bold/italic inside link text still render
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" style="color: #292929;">$1</a>',
  );
  // Autolink bare URLs. Skips URLs already inside an anchor from the pass
  // above (those are preceded by a quote or ">"), and keeps trailing
  // sentence punctuation outside the link.
  out = out.replace(
    /(^|[^">])(https?:\/\/[^\s<]+)/g,
    (_match, prefix: string, url: string) => {
      const clean = url.replace(/[.,;:!?)]+$/, "");
      const trailing = url.slice(clean.length);
      return `${prefix}<a href="${clean}" style="color: #292929;">${clean}</a>${trailing}`;
    },
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

// Recipient context for the shared footer links. userId is a plain string
// here (not Id<"users">) so this module stays dependency-free for the
// frontend previews that import it.
export type EmailFooterOpts = {
  userId?: string;
  username?: string;
  unsubscribeToken?: string;
};

/**
 * Where "Manage email preferences" points. Never `/profile` (not a real SPA
 * route): known usernames land on the public profile with the
 * #email-preferences fragment, account holders without a username go to
 * /set-username, and unknown recipients sign in first with a relative
 * redirect path (sanitizeRedirectPath rejects absolute URLs).
 */
export function emailPreferencesUrl(opts: {
  userId?: string;
  username?: string;
}): string {
  if (opts.username) {
    return `https://vibeapps.dev/${opts.username}#email-preferences`;
  }
  if (opts.userId) {
    return "https://vibeapps.dev/set-username";
  }
  return (
    "https://vibeapps.dev/sign-in?redirect_url=" +
    encodeURIComponent("/set-username")
  );
}

/**
 * The one legal/preferences footer every VibeApps email uses: contact link,
 * clickable Manage email preferences and Unsubscribe, open-source credit,
 * CAN-SPAM address, and the social line.
 */
export function standardEmailFooter(opts: EmailFooterOpts = {}): string {
  const prefsUrl = emailPreferencesUrl(opts);
  const unsubscribeLink = opts.unsubscribeToken
    ? ` | <a href="https://vibeapps.dev/api/unsubscribe?token=${opts.unsubscribeToken}" style="color: #666; font-size: 12px;">Unsubscribe</a>`
    : "";
  return `
            <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #eee;">
              <a href="${prefsUrl}" style="color: #666; font-size: 12px;">Manage email preferences</a>${unsubscribeLink}
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; font-size: 11px; color: #666; line-height: 1.4;">
                <p style="margin: 5px 0;">If you have any questions, feedback, ideas or problems <a href="https://github.com/waynesutton/vibeapps/issues" style="color: #666;">contact us!</a></p>
                <p style="margin: 5px 0;">VibeApps is an <a href="https://github.com/waynesutton/vibeapps" style="color: #666;">open-source project</a> maintained by <a href="https://waynesutton.ai/" style="color: #666;">WayneSutton.ai</a>.</p>
                <p style="margin: 5px 0;">Convex, 444 De Haro St Ste 218, San Francisco, CA 94107-2398 USA</p>
                <p style="margin: 5px 0;">
                  Follow us on <a href="https://twitter.com/convex" style="color: #666;">Twitter</a> or <a href="https://www.linkedin.com/company/convex-dev/" style="color: #666;">LinkedIn</a>. 
                  <a href="https://github.com/get-convex/convex-backend" style="color: #666;">Star on Github</a>
                </p>
              </div>
            </div>`;
}

/**
 * Branded VibeApps email wrapper (same look as the submission emails).
 * The optional signature renders below the body above the footer. Pass
 * footerOpts so the shared footer can link preferences/unsubscribe for the
 * recipient; previews omit it and render the signed-out fallback links.
 */
export function templateEmailShell(
  bodyHtml: string,
  signatureHtml?: string,
  footerOpts?: EmailFooterOpts,
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
            ${standardEmailFooter(footerOpts)}
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
