import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "../components/ui/input"; // Assuming Input component exists
import { Button } from "../components/ui/button"; // Assuming Button component exists

export function NotFoundPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
      <div className="mb-8">
        <h1 className="text-9xl font-bold text-ink">404</h1>
        <p className="text-2xl md:text-3xl text-copy mt-4">
          Oops! The page you're looking for doesn't exist.
        </p>
        <p className="text-md text-soft mt-2">
          It might have been moved, or typed incorrectly.
        </p>
      </div>

      <form onSubmit={handleSearch} className="w-full max-w-md mb-8">
        <div className="relative flex items-center">
          <Input
            type="search"
            placeholder="Search for vibes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-3 px-4 pr-12 text-lg border-hairline-strong focus:border-hairline-strong focus:ring-ink rounded-md shadow-sm"
          />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-soft hover:text-copy"
          >
            <Search className="h-6 w-6" />
            <span className="sr-only">Search</span>
          </Button>
        </div>
      </form>

      <div>
        <Link
          to="/"
          className="px-6 py-3 bg-cta text-on-cta font-semibold rounded-md hover:bg-cta-hover transition-colors text-lg"
        >
          Go to Homepage
        </Link>
      </div>
    </div>
  );
}
