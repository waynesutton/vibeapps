import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  ExternalLink,
  MapPin,
  Calendar,
  Globe,
  Twitter,
  Linkedin,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ProfileHoverCardProps {
  username?: string;
  userId?: Id<"users">;
  children: React.ReactNode;
  className?: string;
}

export function ProfileHoverCard({
  username,
  userId,
  children,
  className = "",
}: ProfileHoverCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [cardPosition, setCardPosition] = useState<"left" | "right">("left");
  const timeoutRef = useRef<NodeJS.Timeout>();
  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Query user data for hover card - only run when hovering
  const userData = useQuery(
    api.users.getUserForHoverCard,
    isHovered && username ? { username } : "skip",
  );

  // Calculate optimal position for the hover card
  const calculatePosition = () => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const cardWidth = 320; // w-80 = 320px

    // Check if card would overflow on the right
    if (rect.left + cardWidth > viewportWidth - 20) {
      setCardPosition("right");
    } else {
      setCardPosition("left");
    }
  };

  // Handle mouse enter with delay
  const handleMouseEnter = () => {
    setIsHovered(true);
    calculatePosition();
    timeoutRef.current = setTimeout(() => {
      setShowCard(true);
    }, 500); // 500ms delay before showing card
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    setIsHovered(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowCard(false);
  };

  // Cleanup timeout on unmount and handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (showCard) {
        calculatePosition();
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      window.removeEventListener("resize", handleResize);
    };
  }, [showCard]);

  // Don't render hover card if no username provided
  if (!username) {
    return <>{children}</>;
  }

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {showCard && userData && (
        <div
          ref={cardRef}
          className={`absolute z-50 w-80 max-w-[calc(100vw-2rem)] bg-surface rounded-lg border border-hairline p-4 mt-2 animate-fade-in ${
            cardPosition === "left" ? "left-0" : "right-0"
          }`}
          onMouseEnter={() => setShowCard(true)}
          onMouseLeave={handleMouseLeave}
        >
          {/* Header with avatar and basic info */}
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0">
              {userData.imageUrl ? (
                <img
                  src={userData.imageUrl}
                  alt={userData.name}
                  className="w-12 h-12 rounded-full object-cover border border-hairline"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-cta flex items-center justify-center border border-hairline">
                  <span className="text-on-cta text-lg font-medium">
                    {userData.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-ink truncate">
                  {userData.name}
                </h3>
                {userData.isVerified && (
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </div>
              {userData.username && (
                <p className="text-sm text-soft">@{userData.username}</p>
              )}
              <div className="flex items-center gap-1 text-xs text-faint mt-1">
                <Calendar className="w-3 h-3" />
                <span>
                  Joined{" "}
                  {formatDistanceToNow(userData._creationTime, {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Bio */}
          {userData.bio && (
            <div className="mb-3">
              <p className="text-sm text-copy leading-relaxed">
                {userData.bio}
              </p>
            </div>
          )}

          {/* Social Links */}
          {(userData.website ||
            userData.twitter ||
            userData.linkedin ||
            userData.bluesky) && (
            <div className="flex flex-wrap gap-2 mb-3">
              {userData.website && (
                <a
                  href={userData.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 bg-canvas hover:bg-surface-hover rounded text-xs text-copy transition-colors"
                  title="Website"
                >
                  <Globe className="w-3 h-3" />
                  Website
                </a>
              )}
              {userData.twitter && (
                <a
                  href={userData.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 bg-canvas hover:bg-surface-hover rounded text-xs text-copy transition-colors"
                  title="Twitter"
                >
                  <Twitter className="w-3 h-3" />
                  Twitter
                </a>
              )}
              {userData.linkedin && (
                <a
                  href={userData.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 bg-canvas hover:bg-surface-hover rounded text-xs text-copy transition-colors"
                  title="LinkedIn"
                >
                  <Linkedin className="w-3 h-3" />
                  LinkedIn
                </a>
              )}
              {userData.bluesky && (
                <a
                  href={userData.bluesky}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 bg-canvas hover:bg-surface-hover rounded text-xs text-copy transition-colors"
                  title="Bluesky"
                >
                  <ExternalLink className="w-3 h-3" />
                  Bluesky
                </a>
              )}
            </div>
          )}

          {/* View Profile Link */}
          <div className="pt-2 border-t border-hairline">
            <Link
              to={`/${userData.username}`}
              className="block w-full text-center py-2 px-3 bg-cta text-on-cta rounded-md text-sm font-medium hover:bg-cta-hover transition-colors"
            >
              View Profile
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
