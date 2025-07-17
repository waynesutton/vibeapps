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
      className="fixed right-4 bottom-4 bg-[#F8F7F7] border border-[#D8E1EC] rounded-lg p-4 shadow-sm flex flex-col justify-center items-center text-center overflow-hidden"
      style={{
        width: "350px",
        height: config.boxSize === "square" ? "350px" : "150px",
      }}>
      <button
        onClick={() => setIsLocallyVisible(false)}
        className="absolute top-2 right-2 text-[#545454] hover:text-[#525252] z-10"
        aria-label="Close">
        <X className="w-4 h-4" />
      </button>

      {config.textAboveLogo ? (
        <>
          <a
            href={config.linkUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#525252] hover:text-[#292929] font-medium break-words mb-2">
            {config.displayText}
          </a>
          {config.logoUrl && (
            <a
              href={config.linkUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block">
              <img
                src={config.logoUrl}
                alt="Logo"
                className={`max-w-[250px] object-contain ${
                  config.boxSize === "square" ? "max-h-[250px]" : "max-h-[60px]"
                }`}
              />
            </a>
          )}
        </>
      ) : (
        <>
          {config.logoUrl && (
            <a
              href={config.linkUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mb-2">
              <img
                src={config.logoUrl}
                alt="Logo"
                className={`max-w-[150px] object-contain ${
                  config.boxSize === "square" ? "max-h-[120px]" : "max-h-[60px]"
                }`}
              />
            </a>
          )}
          <a
            href={config.linkUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#525252] hover:text-[#292929] font-medium break-words">
            {config.displayText}
          </a>
        </>
      )}
    </div>
  );
}
