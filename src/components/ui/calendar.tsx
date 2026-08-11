import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// Site-styled calendar built on react-day-picker. Replaces native
// <input type="date"> controls so date pickers match the design system.
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "relative flex flex-col sm:flex-row gap-4",
        month: "space-y-3",
        month_caption: "flex h-8 items-center justify-center",
        caption_label: "text-sm font-medium text-ink",
        nav: "absolute inset-x-0 top-0 flex h-8 items-center justify-between",
        button_previous:
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-hairline bg-surface text-soft transition-colors hover:bg-surface-hover hover:text-ink disabled:pointer-events-none disabled:opacity-40",
        button_next:
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-hairline bg-surface text-soft transition-colors hover:bg-surface-hover hover:text-ink disabled:pointer-events-none disabled:opacity-40",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-8 text-[11px] font-normal text-faint",
        week: "mt-1 flex w-full",
        day: "relative h-8 w-8 p-0 text-center text-sm text-ink",
        day_button: cn(
          "h-8 w-8 rounded-md text-sm font-normal transition-colors hover:bg-surface-hover",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink",
        ),
        // Range endpoints are solid ink; the days between get the warm paper fill
        range_start:
          "rounded-l-md bg-canvas [&>button]:bg-cta [&>button]:text-on-cta [&>button]:hover:bg-cta",
        range_end:
          "rounded-r-md bg-canvas [&>button]:bg-cta [&>button]:text-on-cta [&>button]:hover:bg-cta",
        range_middle: "bg-canvas [&>button]:hover:bg-surface-hover",
        selected: "[&>button]:font-medium",
        today:
          "[&>button]:font-semibold [&>button]:underline [&>button]:underline-offset-2",
        outside: "text-faint [&>button]:text-faint",
        disabled:
          "text-faint [&>button]:text-faint [&>button]:pointer-events-none",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ className: chevronClassName, orientation }) => {
          const iconClass = cn("h-4 w-4", chevronClassName);
          if (orientation === "left") return <ChevronLeft className={iconClass} />;
          if (orientation === "right") return <ChevronRight className={iconClass} />;
          if (orientation === "up") return <ChevronUp className={iconClass} />;
          return <ChevronDown className={iconClass} />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
