import React, { createContext, useContext, useState, useCallback } from "react";

// Three site themes: light (default cream), classic (original), dark (deep black)
export type ThemeName = "light" | "classic" | "dark";

const STORAGE_KEY = "vibeapps-theme";
const THEME_ORDER: Array<ThemeName> = ["light", "classic", "dark"];

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readInitialTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "classic" || stored === "dark") {
      return stored;
    }
  } catch {
    // localStorage unavailable (private mode); fall through to default
  }
  return "light";
}

function applyTheme(theme: ThemeName) {
  document.documentElement.setAttribute("data-theme", theme);
  // Keep shadcn `.dark` class in sync for components that rely on it
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore persistence failures
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const initial = readInitialTheme();
    // The pre-paint script in index.html sets data-theme; sync the class here
    document.documentElement.classList.toggle("dark", initial === "dark");
    return initial;
  });

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
    applyTheme(next);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      const next =
        THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
      applyTheme(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
