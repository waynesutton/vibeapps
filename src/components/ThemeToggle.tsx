import { SunIcon, MoonIcon, CircleHalfIcon } from "@phosphor-icons/react";
import { useTheme, type ThemeName } from "../lib/ThemeContext";

// Cycles light -> classic -> dark. Icon shows the current theme.
const THEME_LABELS: Record<ThemeName, string> = {
  light: "Light theme",
  classic: "Classic theme",
  dark: "Dark theme",
};

export function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();

  const icon =
    theme === "light" ? (
      <SunIcon className="w-4 h-4" weight="bold" />
    ) : theme === "classic" ? (
      <CircleHalfIcon className="w-4 h-4" weight="bold" />
    ) : (
      <MoonIcon className="w-4 h-4" weight="bold" />
    );

  return (
    <button
      onClick={cycleTheme}
      className="flex items-center justify-center w-8 h-8 rounded-full border border-hairline bg-surface text-soft hover:bg-surface-hover hover:text-ink transition-colors"
      aria-label={`${THEME_LABELS[theme]} active. Switch theme`}
      title={`${THEME_LABELS[theme]} (click to switch)`}
      type="button"
    >
      {icon}
    </button>
  );
}
