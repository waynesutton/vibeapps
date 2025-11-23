import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { User } from "lucide-react";

interface MentionUser {
  _id: string;
  username: string;
  name: string;
  profileImageUrl?: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

export function MentionTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className = "",
  disabled = false,
  required = false,
}: MentionTextareaProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Search for users when we have a query
  const userSuggestions = useQuery(
    api.users.searchUsersForMentions,
    searchQuery.length >= 1 ? { query: searchQuery } : "skip",
  );

  const suggestions = userSuggestions || [];

  // Handle text changes and detect @mentions
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart;

    onChange(newValue);

    // Look for @ symbol before cursor
    const textBeforeCursor = newValue.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      // Check if @ is at start of line or preceded by whitespace
      const charBeforeAt =
        lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
      if (charBeforeAt === " " || charBeforeAt === "\n" || lastAtIndex === 0) {
        // Extract potential username after @
        const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);

        // Check if we're still in the same word (no spaces after @)
        if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
          setMentionStart(lastAtIndex);
          setSearchQuery(textAfterAt);
          setShowSuggestions(true);
          setSelectedIndex(0);
          return;
        }
      }
    }

    // Hide suggestions if not in mention context
    setShowSuggestions(false);
    setSearchQuery("");
    setMentionStart(-1);
  };

  // Handle keyboard navigation in suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
      case "Tab":
        e.preventDefault();
        insertMention(suggestions[selectedIndex]);
        break;
      case "Escape":
        setShowSuggestions(false);
        break;
    }
  };

  // Insert selected mention into text
  const insertMention = (user: MentionUser) => {
    if (!textareaRef.current || mentionStart === -1) return;

    const beforeMention = value.slice(0, mentionStart);
    const afterCursor = value.slice(textareaRef.current.selectionStart);
    const newValue = `${beforeMention}@${user.username} ${afterCursor}`;

    onChange(newValue);
    setShowSuggestions(false);
    setSearchQuery("");
    setMentionStart(-1);

    // Focus back to textarea and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionStart + user.username.length + 2; // +2 for @ and space
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Click to select suggestion
  const handleSuggestionClick = (user: MentionUser) => {
    insertMention(user);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        required={required}
        className={`w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC] disabled:opacity-50 disabled:bg-gray-100 ${className}`}
      />

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md max-h-48 overflow-y-auto"
        >
          {suggestions.map((user, index) => (
            <div
              key={user._id}
              onClick={() => handleSuggestionClick(user)}
              className={`px-3 py-2 cursor-pointer flex items-center gap-2 hover:bg-gray-100 ${
                index === selectedIndex
                  ? "bg-blue-50 border-l-2 border-blue-500"
                  : ""
              }`}
            >
              {user.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt={user.name}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center">
                  <User className="w-3 h-3 text-gray-600" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  @{user.username}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {user.name}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Helper text */}
      {showSuggestions &&
        searchQuery.length > 0 &&
        suggestions.length === 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md p-3">
            <div className="text-sm text-gray-500">
              No users found matching "{searchQuery}"
            </div>
          </div>
        )}
    </div>
  );
}
