/** UUID v4 pattern (8-4-4-4-12 hex). */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Helper service to get Doc Love's user ID.
 *
 * Uses the DOC_LOVE_ID environment variable as the single source of truth.
 * No DB or auth lookups by email/name/role. Validates UUID format and fails fast if missing/invalid.
 */
export class DocLoveHelper {
  constructor(
    _config?: { url?: string; serviceRoleKey?: string },
    _injectedClient?: unknown
  ) {
    // Constructor kept for API compatibility; only getDocLoveUserId() is used (reads from env).
  }

  /**
   * Gets Doc Love's user ID (UUID) from process.env.DOC_LOVE_ID.
   *
   * @returns Doc Love's user ID (UUID)
   * @throws Error if DOC_LOVE_ID is missing or not a valid UUID
   */
  async getDocLoveUserId(): Promise<string> {
    const id = process.env.DOC_LOVE_ID?.trim();
    if (!id) {
      throw new Error(
        "DOC_LOVE_ID is required. Set DOC_LOVE_ID in .env (e.g. DOC_LOVE_ID=87ca0479-a2b7-47eb-97b3-42a95e7b1669)."
      );
    }
    if (!UUID_REGEX.test(id)) {
      throw new Error(
        `DOC_LOVE_ID must be a valid UUID. Got: ${id}. Example: 87ca0479-a2b7-47eb-97b3-42a95e7b1669`
      );
    }
    return id;
  }

  /**
   * Clears any cached state (no-op; kept for backward compatibility).
   */
  static clearCache(): void {
    // No cache; DOC_LOVE_ID is read from env each time.
  }
}
