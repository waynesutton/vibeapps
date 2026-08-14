import { Check } from "lucide-react";

import { SimpleSelect } from "./SimpleSelect";

// Must match MULTISELECT_SEPARATOR in convex/storyFormFields.ts. Multi-select
// answers travel as a single comma-joined string so every submit path and
// downstream consumer (judging UI, CSV export, AI judge) keeps plain strings.
export const MULTISELECT_SEPARATOR = ", ";

export function parseMultiselectValue(value: string): string[] {
  return value
    .split(MULTISELECT_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
}

export type ChoiceFieldType = "radio" | "multiselect" | "select";

interface ChoiceFieldInputProps {
  fieldKey: string;
  fieldType: ChoiceFieldType;
  options: string[];
  value: string; // Radio/select: single option. Multiselect: comma-joined options.
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string; // Select only: trigger placeholder text
}

// Shared row shell: full-width tappable label with hover + checked states so
// the whole row (not just the 20px control) is the touch target.
const rowClasses =
  "group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-hairline bg-surface px-3.5 py-2.5 transition-colors duration-150 hover:border-hairline-strong hover:bg-surface-hover has-[:checked]:border-hairline-strong has-[:checked]:bg-surface-hover has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60";

const optionTextClasses =
  "flex-1 text-sm leading-5 text-copy group-has-[:checked]:text-ink";

/**
 * Renders admin-configured radio (single choice), multiselect (checkboxes),
 * or select (dropdown) form fields. Values stay strings so existing form
 * state and submit mutations work unchanged.
 */
export function ChoiceFieldInput({
  fieldKey,
  fieldType,
  options,
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder,
}: ChoiceFieldInputProps) {
  if (options.length === 0) {
    return null;
  }

  // Dropdown: themed Radix select shares the same string value contract
  if (fieldType === "select") {
    return (
      <SimpleSelect
        id={fieldKey}
        name={fieldKey}
        value={options.includes(value) ? value : ""}
        onChange={onChange}
        options={options.map((option) => ({ value: option, label: option }))}
        placeholder={placeholder || "Select an option"}
        required={required}
        disabled={disabled}
        aria-label={fieldKey}
        className="w-full"
      />
    );
  }

  if (fieldType === "radio") {
    return (
      <div
        role="radiogroup"
        aria-labelledby={`${fieldKey}-label`}
        className="space-y-2"
      >
        {options.map((option) => (
          <label key={option} className={rowClasses}>
            {/* 20px custom radio: border thickens into a ring around a dot */}
            <input
              type="radio"
              name={fieldKey}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              required={required}
              disabled={disabled}
              className="h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-hairline-strong bg-surface transition-all duration-150 checked:border-[6px] checked:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed"
            />
            <span className={optionTextClasses}>{option}</span>
          </label>
        ))}
      </div>
    );
  }

  const selected = parseMultiselectValue(value);
  // Preserve the configured option order regardless of click order
  const toggle = (option: string) => {
    const next = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : options.filter((o) => selected.includes(o) || o === option);
    onChange(next.join(MULTISELECT_SEPARATOR));
  };

  return (
    <div
      role="group"
      aria-labelledby={`${fieldKey}-label`}
      className="space-y-2"
    >
      {options.map((option, index) => (
        <label key={option} className={rowClasses}>
          {/* 20px custom checkbox: ink fill with contrast check when selected */}
          <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
            <input
              type="checkbox"
              value={option}
              checked={selected.includes(option)}
              onChange={() => toggle(option)}
              // Native "select at least one": require the first checkbox only
              // while nothing is selected yet
              required={required && selected.length === 0 && index === 0}
              disabled={disabled}
              className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-hairline-strong bg-surface transition-all duration-150 checked:border-ink checked:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed"
            />
            <Check
              className="pointer-events-none absolute h-3.5 w-3.5 text-on-cta opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
              strokeWidth={3}
              aria-hidden="true"
            />
          </span>
          <span className={optionTextClasses}>{option}</span>
        </label>
      ))}
    </div>
  );
}
