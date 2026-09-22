import { useState, type CSSProperties } from "react";
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
      // Below sm this is a bottom banner spanning the gutters: a fixed 350px
      // box covers most of a phone screen and sits on top of the content it is
      // advertising. From sm up it returns to the configured fixed-size box.
      className="fixed left-3 right-16 bottom-20 h-auto max-h-[40vh] sm:left-auto sm:right-20 lg:bottom-4 sm:w-[350px] sm:h-[var(--convex-box-h)] sm:max-h-none bg-surface-alt border border-hairline rounded-lg p-4 shadow-sm flex flex-col justify-center items-center text-center overflow-hidden"
      style={
        {
          "--convex-box-h": config.boxSize === "square" ? "350px" : "150px",
        } as CSSProperties
      }>
      <button
        onClick={() => setIsLocallyVisible(false)}
        className="absolute top-2 right-2 text-soft hover:text-copy z-10"
        aria-label="Close">
        <X className="w-4 h-4" />
      </button>

      {config.textAboveLogo ? (
        <>
          <a
            href={config.linkUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-copy hover:text-ink font-medium break-words mb-2">
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
                className={`max-w-full sm:max-w-[250px] object-contain ${
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
                className={`max-w-full sm:max-w-[150px] object-contain ${
                  config.boxSize === "square" ? "max-h-[120px]" : "max-h-[60px]"
                }`}
              />
            </a>
          )}
          <a
            href={config.linkUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-copy hover:text-ink font-medium break-words">
            {config.displayText}
          </a>
        </>
      )}
    </div>
  );
}
