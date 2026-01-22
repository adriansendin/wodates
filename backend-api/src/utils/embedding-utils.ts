/**
 * Embedding normalization utilities
 * 
 * Handles various formats that Supabase/pgvector may return:
 * - Array: [0.1, 0.2, ...]
 * - JSON string: "[0.1,0.2,...]"
 * - Postgres array string: "{0.1,0.2,...}"
 */

/**
 * Normalizes embedding value to number[] or null
 * 
 * @param val - Embedding value in any format
 * @returns Normalized array of numbers, or null if invalid
 */
export function normalizeEmbedding(val: any): number[] | null {
  if (!val) return null;
  if (Array.isArray(val)) return val;

  // Supabase/pgvector sometimes returns a string like "[0.1,0.2,...]" or "{0.1,0.2,...}"
  if (typeof val === "string") {
    const s = val.trim();

    // JSON array
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }

    // Postgres array style: "{0.1,0.2,...}"
    if (s.startsWith("{") && s.endsWith("}")) {
      const inner = s.slice(1, -1);
      const parts = inner.split(",").map((x) => Number(x));
      return parts.every((n) => Number.isFinite(n)) ? parts : null;
    }
  }

  return null;
}
