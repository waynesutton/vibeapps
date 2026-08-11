import React from "react";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={`w-full p-2 border border-hairline-strong rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ink ${className || ""}`}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";
