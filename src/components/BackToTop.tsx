import React from "react";
import { ArrowUp } from "lucide-react";

/**
 * Floating scroll-to-top control.
 *
 * Sits on the left so it never collides with the ConvexBox, which is pinned
 * bottom-right, and clears the mobile bottom bar below lg.
 */
export function BackToTop() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        })
      }
      className="fixed right-3 bottom-20 lg:right-4 lg:bottom-4 z-40 flex items-center justify-center w-11 h-11 rounded-lg border border-hairline bg-surface text-copy shadow-sm hover:bg-surface-hover hover:text-ink transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      aria-label="Back to top"
      title="Back to top"
    >
      <ArrowUp className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}
