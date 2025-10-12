import {
  createClient,
  PostgrestResponse,
  SupabaseClient,
} from '@supabase/supabase-js';
import {
  DomainError,
  InternalError,
  NotFoundError,
} from '../../domain/errors/DomainError';
import { LookingForValue } from '../../domain/entities/LookingFor';
import { Gender, GENDER_VALUES } from '../../domain/entities/User';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type FeedUserRow = {
  id: string;
  name: string; // Retrieved from auth.users.raw_user_meta_data.display_name
  birthDate: string | null;
  gender: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type CurrentUserRow = {
  id: string;
  looking_for: LookingForValue | null;
};

type InteractionRow = {
  to_user: string;
};

export type FeedCandidate = {
  id: string;
  name: string;
  bio: string | null;
  birthDate: string | null;
  age: number | null;
  gender: Gender | null;
  photoUrl: string | null;
};

export class SupabaseFeedService {
  private readonly client: SupabaseClient;

  constructor(config?: Partial<SupabaseConfig>) {
    const resolved = this.resolveConfig(config);
    this.client = createClient(resolved.url, resolved.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async getFeedCandidates(
    userId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<FeedCandidate[]> {
    try {
      const currentUser = await this.fetchCurrentUser(userId);
      const genderFilter = this.resolveGenderFilter(currentUser.looking_for);

      let query = this.client
        .from('users')
        .select('id, birthDate, gender, bio, avatar_url') // Removed 'name' - comes from auth.users
        .neq('id', userId)
        .range(offset, offset + limit - 1);

      if (genderFilter !== 'any') {
        query = query.in('gender', genderFilter);
      }

      const [{ data, error }, excludedIds] = await Promise.all([
        query,
        this.fetchExcludedUserIds(userId),
      ]);

      if (error) {
        throw new InternalError(
          `Failed to load feed candidates: ${this.formatSupabaseError(error)}`,
        );
      }

      if (!data || data.length === 0) {
        return [];
      }

      const filtered = data.filter(
        (row) => !excludedIds.has(row.id),
      );

      // Fetch names from auth.users for all candidates in parallel
      const candidatesWithNames = await Promise.all(
        filtered.map(async (row) => {
          const name = await this.fetchUserName(row.id);
          return this.mapRowToCandidate({ ...row, name });
        })
      );

      return candidatesWithNames;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      throw new InternalError(
        'Unexpected error while loading feed candidates',
        error,
      );
    }
  }

  private async fetchCurrentUser(userId: string): Promise<CurrentUserRow> {
    const { data, error } = await this.client
      .from('users')
      .select('id, looking_for')
      .eq('id', userId)
      .single();

    if (error) {
      throw new InternalError(
        `Failed to resolve current user: ${this.formatSupabaseError(error)}`,
      );
    }

    if (!data) {
      throw new NotFoundError('Authenticated user not found in Supabase');
    }

    return data as CurrentUserRow;
  }

  private resolveGenderFilter(
    lookingFor: LookingForValue | null,
  ): 'any' | Gender[] {
    if (!lookingFor || lookingFor === 'both') {
      return 'any';
    }

    const allowed = new Set<Gender>();

    if (lookingFor === 'male') {
      allowed.add('male');
    }

    if (lookingFor === 'female') {
      allowed.add('female');
    }

    if (allowed.size === 0) {
      return 'any';
    }

    return Array.from(allowed);
  }

  private async fetchExcludedUserIds(userId: string): Promise<Set<string>> {
    const excluded = new Set<string>();

    const [likes, passes] = (await Promise.all([
      this.client
        .from('interactions')
        .select('to_user')
        .eq('from_user', userId)
        .eq('action', 'like'),
      this.client
        .from('interactions')
        .select('to_user')
        .eq('from_user', userId)
        .eq('action', 'pass'),
    ])) as [PostgrestResponse<InteractionRow>, PostgrestResponse<InteractionRow>];

    const processResult = (result: PostgrestResponse<InteractionRow>) => {
      if (result.error) {
        throw new InternalError(
          `Failed to fetch interactions for feed exclusion: ${this.formatSupabaseError(result.error)}`,
        );
      }

      (result.data ?? []).forEach((row) => {
        if (row?.to_user) {
          excluded.add(row.to_user);
        }
      });
    };

    processResult(likes);
    processResult(passes);

    return excluded;
  }

  /**
   * Obtiene el nombre del usuario desde auth.users.raw_user_meta_data.display_name
   * 
   * @param userId - ID del usuario
   * @returns El nombre del usuario o un valor por defecto
   */
  private async fetchUserName(userId: string): Promise<string> {
    try {
      const { data, error } = await this.client.auth.admin.getUserById(userId);
      
      if (error || !data?.user) {
        console.warn(`[SupabaseFeedService] Could not fetch name for user ${userId}`, error);
        return 'Usuario';
      }

      const user = data.user;
      const metadata = user.user_metadata as Record<string, unknown> | null;
      
      // Debug: Log metadata structure to understand what's available
      console.log(`[SupabaseFeedService] User ${userId} metadata:`, JSON.stringify({
        email: user.email,
        user_metadata: metadata,
        raw_user_meta_data: (user as any).raw_user_meta_data,
      }, null, 2));
      
      const displayName =
        metadata && typeof metadata.display_name === 'string'
          ? metadata.display_name.trim()
          : '';

      const result = displayName || user.email || 'Usuario';
      console.log(`[SupabaseFeedService] Resolved name for ${userId}: "${result}"`);
      
      return result;
    } catch (error) {
      console.warn(`[SupabaseFeedService] Error fetching name for user ${userId}`, error);
      return 'Usuario';
    }
  }

  private mapRowToCandidate(row: FeedUserRow): FeedCandidate {
    const gender = this.normalizeGender(row.gender);
    const birthDate = this.normalizeDate(row.birthDate);
    const bio = this.truncateBio(row.bio);
    const age = birthDate ? this.calculateAge(birthDate) : null;
    const photoUrl = this.normalizeUrl(row.avatar_url);

    return {
      id: row.id,
      name: row.name, // Already fetched from auth.users
      bio,
      birthDate,
      age,
      gender,
      photoUrl,
    };
  }

  private normalizeGender(value: string | null): Gender | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    if ((GENDER_VALUES as readonly string[]).includes(normalized)) {
      return normalized as Gender;
    }

    return null;
  }

  private normalizeDate(value: string | null): string | null {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  }

  private truncateBio(bio: string | null): string | null {
    if (!bio) {
      return null;
    }

    const trimmed = bio.trim();
    if (!trimmed) {
      return null;
    }

    const limit = 180;
    return trimmed.length > limit ? `${trimmed.slice(0, limit)}...` : trimmed;
  }

  private normalizeUrl(value: string | null): string | null {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    try {
      // Basic validation to ensure it's a valid URL
      const url = new URL(trimmed);
      return url.toString();
    } catch {
      return null;
    }
  }

  private calculateAge(birthDateIso: string): number | null {
    const birthDate = new Date(birthDateIso);
    if (Number.isNaN(birthDate.getTime())) {
      return null;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age -= 1;
    }

    return age;
  }

  private resolveConfig(config?: Partial<SupabaseConfig>): SupabaseConfig {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SupabaseFeedService requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
      );
    }

    return {
      url,
      serviceRoleKey,
    };
  }

  private formatSupabaseError(error: unknown): string {
    if (error && typeof error === 'object') {
      const maybeMessage = (error as { message?: unknown }).message;
      const maybeDetails = (error as { details?: unknown }).details;
      const maybeHint = (error as { hint?: unknown }).hint;

      const segments = [
        typeof maybeMessage === 'string' ? maybeMessage.trim() : null,
        typeof maybeDetails === 'string' ? maybeDetails.trim() : null,
        typeof maybeHint === 'string' ? maybeHint.trim() : null,
      ].filter((segment): segment is string => Boolean(segment));

      if (segments.length > 0) {
        return segments.join(' | ');
      }
    }

    return typeof error === 'string' ? error : 'Unknown Supabase error';
  }
}
