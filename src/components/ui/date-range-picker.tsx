import * as React from "react";
import { CalendarIcon, X } from "lucide-react";
import { format, startOfMonth, endOfMonth, subDays, subMonths } from "date-fns";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type { DateRange };

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
}

// Quick presets so admins can jump to common windows (day ranges and whole months)
function getPresets(): Array<{ label: string; range: DateRange }> {
  const today = new Date();
  return [
    { label: "Last 7 days", range: { from: subDays(today, 6), to: today } },
    { label: "Last 30 days", range: { from: subDays(today, 29), to: today } },
    {
      label: "This month",
      range: { from: startOfMonth(today), to: endOfMonth(today) },
    },
    {
      label: "Last month",
      range: {
        from: startOfMonth(subMonths(today, 1)),
        to: endOfMonth(subMonths(today, 1)),
      },
    },
    {
      label: "Last 3 months",
      range: { from: startOfMonth(subMonths(today, 2)), to: endOfMonth(today) },
    },
  ];
}

// Format the trigger label: "Jul 1 – Jul 31, 2026" style, compact when possible
function formatRangeLabel(range: DateRange): string {
  if (!range.from) return "";
  if (!range.to) return format(range.from, "MMM d, yyyy");
  const sameYear = range.from.getFullYear() === range.to.getFullYear();
  const fromLabel = sameYear
    ? format(range.from, "MMM d")
    : format(range.from, "MMM d, yyyy");
  return `${fromLabel} – ${format(range.to, "MMM d, yyyy")}`;
}

/**
 * Date range picker with a styled calendar and preset windows. Used for
 * filtering and scanning submissions by date instead of native date inputs.
 */
export function DateRangePicker({
  value,
  onChange,
  placeholder = "Filter by date",
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const presets = getPresets();
  const hasValue = Boolean(value?.from);

  const handleSelect = (range: DateRange | undefined) => {
    onChange(range);
  };

  const handlePreset = (range: DateRange) => {
    onChange(range);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Filter by submission date range"
          className={cn(
            "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors",
            "hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-ring",
            hasValue ? "text-[#292929]" : "text-[#545454]",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 text-[#545454]" />
          {hasValue && value ? formatRangeLabel(value) : placeholder}
          {hasValue && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear date range"
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(undefined);
                }
              }}
              className="ml-1 -mr-1 flex h-5 w-5 items-center justify-center rounded hover:bg-gray-200"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Preset windows */}
          <div className="flex flex-row flex-wrap gap-1 border-b border-gray-100 p-3 sm:flex-col sm:flex-nowrap sm:border-b-0 sm:border-r">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePreset(preset.range)}
                className="rounded-md px-2.5 py-1.5 text-left text-sm text-[#545454] transition-colors hover:bg-gray-100 hover:text-[#292929]"
              >
                {preset.label}
              </button>
            ))}
            {hasValue && (
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
                className="rounded-md px-2.5 py-1.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50 sm:mt-auto"
              >
                Clear dates
              </button>
            )}
          </div>
          {/* Custom range calendar */}
          <Calendar
            mode="range"
            numberOfMonths={2}
            defaultMonth={value?.from ?? subMonths(new Date(), 1)}
            selected={value}
            onSelect={handleSelect}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
