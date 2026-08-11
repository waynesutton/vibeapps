import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

// Radix Select items cannot use "" as a value, but many callers rely on
// empty-string sentinels ("All Categories", "None"). Map "" through a token.
const EMPTY_VALUE = "__empty__";

export interface SimpleSelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

interface SimpleSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<SimpleSelectOption>;
  placeholder?: React.ReactNode;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  /** Extra classes for the trigger button */
  className?: string;
  /** Extra classes for the dropdown panel */
  contentClassName?: string;
  "aria-label"?: string;
}

/**
 * Themed dropdown with native-select ergonomics (value / onChange / options).
 * Uses the site design system in all three themes instead of the OS popup,
 * with full keyboard support (arrows, type-ahead, Enter, Escape) via Radix.
 */
export function SimpleSelect({
  value,
  onChange,
  options,
  placeholder,
  id,
  name,
  disabled,
  required,
  className,
  contentClassName,
  "aria-label": ariaLabel,
}: SimpleSelectProps) {
  const hasEmptyOption = options.some((option) => option.value === "");
  const toRadix = (v: string) => (v === "" ? EMPTY_VALUE : v);
  const fromRadix = (v: string) => (v === EMPTY_VALUE ? "" : v);

  // When "" is a real option, map it through the sentinel; otherwise treat ""
  // as "nothing selected" so the Radix placeholder renders.
  const radixValue =
    value === "" && !hasEmptyOption ? undefined : toRadix(value);

  return (
    <Select
      value={radixValue}
      onValueChange={(v) => onChange(fromRadix(v))}
      disabled={disabled}
      name={name}
      required={required}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={toRadix(option.value)}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default SimpleSelect;
