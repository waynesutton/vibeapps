import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
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
        p: ({ node, children, ...props }) => {
          // Check if paragraph contains block-level elements like pre/code blocks
          const hasBlockElements = React.Children.toArray(children).some(
            (child: any) =>
              child?.type === "pre" || child?.props?.node?.tagName === "pre",
          );

          // Use div instead of p for block elements to avoid nesting issues
          if (hasBlockElements) {
            return <div {...props}>{children}</div>;
          }

          return <p {...props}>{children}</p>;
        },
        // react-markdown v9 dropped the `inline` prop that used to tell these
        // two cases apart. It already wraps fenced blocks in a `pre` and
        // leaves inline spans bare, so styling the wrapper is enough:
        // rehype-highlight puts the `hljs` and `language-*` classes on the
        // inner `code` itself.
        pre: ({ node, children, ...props }) => (
          <pre className="hljs" {...props}>
            {children}
          </pre>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
