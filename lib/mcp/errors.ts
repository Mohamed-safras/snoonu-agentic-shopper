/**
 * Translate raw MCP / transport errors into calm, user-facing messages — the
 * Streamable HTTP layer surfaces things like
 * `{"error":"rate_limit_exceeded","message":"Free tier limit of 60 ..."}`
 * which must never reach the shopper verbatim.
 */
function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err ?? "");
}

/** A free-tier / rate-limit error from the MCP server. */
export function isRateLimit(err: unknown): boolean {
  return /rate[_ ]?limit|requests?\s*\/\s*minute|too many requests|\b429\b|retry in/i.test(
    messageOf(err),
  );
}

/** Seconds to wait, if the error states one (e.g. "Retry in 43s"). */
export function retryAfterSeconds(err: unknown): number | null {
  const m = messageOf(err).match(/retry in\s*(\d+)\s*s/i);
  return m ? Number(m[1]) : null;
}

/** A friendly, in-character message for any MCP/transport failure. */
export function friendlyMcpError(err: unknown): string {
  if (isRateLimit(err)) {
    const secs = retryAfterSeconds(err);
    return `Aiyo, I'm getting a lot of requests right now 🙏 — please try again${
      secs ? ` in about ${secs} secs` : " in a moment"
    }.`;
  }
  const message = messageOf(err);
  if (
    /streamable http|posting to endpoint|fetch failed|network|econn|timeout|temporarily unavailable|\b50\d\b/i.test(
      message,
    )
  ) {
    return "Snoonu is briefly unreachable — please try again in a moment.";
  }
  return "Something went wrong on our side — please try again.";
}
