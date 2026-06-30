import { useEffect } from "react";

/**
 * Closes/dismisses an overlay when the Escape key is pressed.
 *
 * Subscribes to a window-level keydown listener only while `enabled` is true
 * (i.e. the modal is open) and cleans up on unmount or when disabled. This is a
 * legitimate Effect use: subscribing to an external event system.
 */
export function useEscapeKey(enabled: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onEscape();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onEscape]);
}
