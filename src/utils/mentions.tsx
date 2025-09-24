import React from "react";
import { Link } from "react-router-dom";

/**
 * Utility function to render text with @username mentions as clickable links
 * Converts @username tokens to links pointing to user profiles
 */
export function renderTextWithMentions(text: string): React.ReactNode {
  if (!text) return text;

  // Split text by @username patterns while preserving the matches
  const parts = text.split(/(^|\s)(@[a-zA-Z0-9_.]+)/g);

  return parts.map((part, index) => {
    // Check if this part is a mention (starts with @)
    if (part.startsWith("@")) {
      const username = part.slice(1); // Remove the @ symbol
      return (
        <Link
          key={index}
          to={`/${username}`}
          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
          title={`View ${username}'s profile`}
        >
          {part}
        </Link>
      );
    }

    // Regular text part
    return part;
  });
}
