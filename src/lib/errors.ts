const PASSTHROUGH_PREFIXES = ["That API key was rejected"];

/**
 * Most generation errors get the PRD's generic copy. A short allowlist of
 * known, actionable messages (e.g. a rejected API key) is surfaced as-is
 * instead, since "check Settings" is more useful than "try again".
 */
export function friendlyErrorMessage(error: unknown): string {
  if (error instanceof Error && PASSTHROUGH_PREFIXES.some((p) => error.message.startsWith(p))) {
    return error.message;
  }
  return "Something went wrong. Try again in a moment.";
}
