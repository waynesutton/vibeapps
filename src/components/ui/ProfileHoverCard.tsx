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
  const timeoutRef = useRef<NodeJS.Timeout>();
  const cardRef = useRef<HTMLDivElement>(null);

  // Query user data for hover card - only run when hovering
  const userData = useQuery(
    api.users.getUserForHoverCard,
    isHovered && username ? { username } : "skip",
  );

  // Handle mouse enter with delay
  const handleMouseEnter = () => {
    setIsHovered(true);
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Don't render hover card if no username provided
  if (!username) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {showCard && userData && (
        <div
          ref={cardRef}
          className="absolute z-50 w-80 bg-white rounded-lg shadow-lg border border-[#D8E1EC] p-4 mt-2 left-0"
          style={{
            transform: "translateY(0)",
            animation: "fadeIn 0.2s ease-out",
          }}
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
                  className="w-12 h-12 rounded-full object-cover border border-[#D8E1EC]"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#292929] flex items-center justify-center border border-[#D8E1EC]">
                  <span className="text-white text-lg font-medium">
                    {userData.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-[#292929] truncate">
                  {userData.name}
                </h3>
                {userData.isVerified && (
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </div>
              {userData.username && (
                <p className="text-sm text-[#545454]">@{userData.username}</p>
              )}
              <div className="flex items-center gap-1 text-xs text-[#787672] mt-1">
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
              <p className="text-sm text-[#525252] leading-relaxed">
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
                  className="flex items-center gap-1 px-2 py-1 bg-[#F2F4F7] hover:bg-[#E5E7EB] rounded text-xs text-[#525252] transition-colors"
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
                  className="flex items-center gap-1 px-2 py-1 bg-[#F2F4F7] hover:bg-[#E5E7EB] rounded text-xs text-[#525252] transition-colors"
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
                  className="flex items-center gap-1 px-2 py-1 bg-[#F2F4F7] hover:bg-[#E5E7EB] rounded text-xs text-[#525252] transition-colors"
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
                  className="flex items-center gap-1 px-2 py-1 bg-[#F2F4F7] hover:bg-[#E5E7EB] rounded text-xs text-[#525252] transition-colors"
                  title="Bluesky"
                >
                  <ExternalLink className="w-3 h-3" />
                  Bluesky
                </a>
              )}
            </div>
          )}

          {/* View Profile Link */}
          <div className="pt-2 border-t border-[#F4F0ED]">
            <Link
              to={`/${userData.username}`}
              className="block w-full text-center py-2 px-3 bg-[#292929] text-white rounded-md text-sm font-medium hover:bg-[#525252] transition-colors"
            >
              View Profile
            </Link>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
