import React, { useState } from "react";
import { X } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function ConvexBox() {
  const config = useQuery(api.convexBoxConfig.get);

  const [isLocallyVisible, setIsLocallyVisible] = useState(true);

  if (!config || !config.isEnabled || !isLocallyVisible) {
    return null;
  }

  return (
    <div
      className="fixed right-4 bottom-4 bg-[#F8F7F7] border border-[#D5D3D0] rounded-lg p-4 shadow-sm flex flex-col justify-center items-center text-center overflow-hidden"
      style={{ width: "350px", height: "150px" }}>
      <button
        onClick={() => setIsLocallyVisible(false)}
        className="absolute top-2 right-2 text-[#787672] hover:text-[#525252] z-10"
        aria-label="Close">
        <X className="w-4 h-4" />
      </button>

      {config.logoUrl && (
        <img
          src={config.logoUrl}
          alt="Logo"
          className="max-h-[60px] max-w-[150px] object-contain mb-2"
        />
      )}

      <a
        href={config.linkUrl || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-[#525252] hover:text-[#2A2825] font-medium break-words">
        {config.displayText}
      </a>
    </div>
  );
}
