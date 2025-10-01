# Code blocks in submission preview and detail

## Current behavior

The long description renders with ReactMarkdown in two places and already opens links safely in a new tab.

- StoryForm preview uses `ReactMarkdown` inside a `prose` container.
- StoryDetail displays `ReactMarkdown` with the same link overrides.
- Raw HTML is not enabled, which is good for safety.

## Goal

Render fenced code blocks written with triple backticks as properly styled code in both the form preview and the detail page. Keep it safe, identical in both places, and minimal in scope.

## Recommended approach

Create a shared `Markdown` component that wraps `react-markdown` with:

- `remark-gfm` for fenced blocks and GitHub-flavored markdown.
- `rehype-highlight` for syntax highlighting that never executes code.
- Keep `rehypeRaw` disabled to avoid rendering raw HTML.
- Provide a custom `code` renderer to distinguish inline vs block code and keep styling consistent.

This is safe because `react-markdown` does not execute scripts, `rehype-highlight` only decorates code with classes, and we do not enable raw HTML. Links remain sandboxed with `rel="noopener noreferrer"`.

## Implementation steps

1. Install minimal deps

```bash
npm i remark-gfm rehype-highlight highlight.js
```

2. Add a shared markdown wrapper
   Create `src/components/Markdown.tsx`:

```tsx
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
// Choose a neutral theme that fits black and white design
import "highlight.js/styles/github.css";

type Props = { children: string };

export function Markdown({ children }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        a: ({ node, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer" />
        ),
        code: ({ inline, className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || "");
          if (inline) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }
          return (
            <pre className={`hljs ${match ? className : ""}`}>
              <code {...props}>{String(children).replace(/\n$/, "")}</code>
            </pre>
          );
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
```

3. Use the wrapper in both places

- StoryForm preview: replace the inner `ReactMarkdown` with `<Markdown>{formData.longDescription}</Markdown>` and keep the `prose` container.
- StoryDetail: replace the inner `ReactMarkdown` with `<Markdown>{story.longDescription}</Markdown>` and keep the `prose` container.

4. Optional UX polish

- Add a small copy button to block code with a custom wrapper div around `<pre>` if desired.
- Cap block height with CSS and make it scrollable for long code.

## Security notes

- Do not enable `rehypeRaw`.
- Keep the existing link policy with `target="_blank"` and `rel="noopener noreferrer"`.
- Highlighting is static; it does not evaluate code.
- If needed, whitelist languages by importing only specific highlight.js languages.

## Quick test

Paste this into the long description field and verify preview and detail render the formatted block:

````md
Here is some JS:

```js
function greet(name) {
  return `Hello, ${name}`;
}
console.log(greet("Vibe"));
```
````

Inline `code` still works.

```


## Rule alignment (@dev2.mdc, @help.mdc)

- Scope and safety: no raw HTML; add fenced code only. Keep existing UI, colors, and design system unchanged.
- Reflection first: we’re not editing app code in this step; plan is documented here, then applied surgically.
- Minimal change: introduce a shared `Markdown` wrapper; swap it in two places; no schema or API changes.
- Security: `remark-gfm` and `rehype-highlight` only; links remain `target="_blank" rel="noopener noreferrer"`.
- Design: keep current `prose` containers; no browser default popups added.

## Implementation checklist

1. Add deps: `remark-gfm`, `rehype-highlight`, `highlight.js`.
2. Create `src/components/Markdown.tsx` exactly as shown above.
3. Replace inner `ReactMarkdown` usages in `StoryForm` preview and `StoryDetail` with `<Markdown>`; keep surrounding layout.
4. Verify TypeScript types and imports; no other component changes.
5. Commit as a single coherent change with message: "markdown: add safe fenced code blocks to longDescription".

## Test plan

- Paste the sample fenced block (JS) in the form and confirm preview renders with syntax highlighting.
- Submit and confirm `StoryDetail` renders the same formatting.
- Check inline `code` still renders as before.
- Validate external links open in a new tab and have `rel="noopener noreferrer"`.
- Try an extremely long code block; verify scroll behavior and no layout shift.
- Try triple backticks without language to confirm default highlighting still looks acceptable.

## Rollback

- Revert to `react-markdown` direct usage in both files and remove `Markdown.tsx` and new deps.


```
