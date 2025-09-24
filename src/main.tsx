import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // Or your main CSS file
import { ClerkProvider } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { useAuth } from "@clerk/clerk-react"; // Added useAuth import

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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={publishableKey}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <App />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  </React.StrictMode>,
);
