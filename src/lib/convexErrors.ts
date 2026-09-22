import { ConvexError } from "convex/values";

// Turn any thrown value from a Convex mutation into text a user can act on.
// ConvexError data survives prod redaction; plain Errors arrive as
// "[CONVEX M(stories:submit)] [Request ID: abc] Server Error" with no detail.
export function getConvexErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  // Application errors: the server chose this message on purpose
  if (error instanceof ConvexError) {
    if (typeof error.data === "string") return error.data;
    if (
      error.data &&
      typeof error.data === "object" &&
      "message" in error.data &&
      typeof error.data.message === "string"
    ) {
      return error.data.message;
    }
  }

  if (!(error instanceof Error)) return fallback;

  const requestId = /\[Request ID:\s*([^\]]+)\]/.exec(error.message)?.[1];

  // Strip the "[CONVEX ...] [Request ID: ...]" prefixes and the
  // "Called by client" trailer Convex appends in place of a stack trace
  const cleaned = error.message
    .replace(/\[CONVEX [^\]]*\]\s*/g, "")
    .replace(/\[Request ID:[^\]]*\]\s*/g, "")
    .replace(/^Uncaught Error:\s*/, "")
    .replace(/\s*Called by client\s*$/, "")
    .trim();

  // Dev deployments include the real message plus a stack trace after
  // "Server Error"; keep only the first meaningful line
  const firstLine = (text: string) =>
    text
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("at ")) ?? "";

  // Redacted prod error: keep the request id so support can find the log
  if (!cleaned || /^Server Error\b/.test(cleaned)) {
    const detail = firstLine(
      cleaned
        .replace(/^Server Error\s*/, "")
        .replace(/^Uncaught Error:\s*/, ""),
    );
    if (detail) return detail;
    return requestId
      ? `${fallback} If it keeps happening, share request ID ${requestId} with the team.`
      : fallback;
  }

  return firstLine(cleaned) || fallback;
}
