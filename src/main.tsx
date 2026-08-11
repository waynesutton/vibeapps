import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // Or your main CSS file
import { ClerkProvider } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { useAuth } from "@clerk/clerk-react"; // Added useAuth import
import { dark } from "@clerk/themes";
import { ThemeProvider, useTheme } from "./lib/ThemeContext";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!publishableKey) {
  throw new Error(
    "Missing Publishable Key. Make sure VITE_CLERK_PUBLISHABLE_KEY is set in your .env file.",
  );
}

if (!import.meta.env.VITE_CONVEX_URL) {
  // Added check for VITE_CONVEX_URL
  throw new Error(
    "Missing Convex URL. Make sure VITE_CONVEX_URL is set in your .env file.",
  );
}

// Wraps ClerkProvider so its modals/cards follow the active site theme
function AppWithProviders() {
  const { theme } = useTheme();
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={theme === "dark" ? { baseTheme: dark } : undefined}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <App />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppWithProviders />
    </ThemeProvider>
  </React.StrictMode>,
);
