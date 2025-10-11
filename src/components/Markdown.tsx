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
