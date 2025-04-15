import * as React from "react";

import { cn } from "@/lib/utils"; // Assuming you have a cn utility function like Shadcn

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-[#D5D3D0] bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-[#787672] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8A6A3] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
