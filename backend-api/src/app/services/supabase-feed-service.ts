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
  looking_for: LookingForValue | null;
  bio: string | null;
  show_bio_in_feed: boolean | null;
};

type CurrentUserRow = {
  id: string;
  looking_for: LookingForValue | null;
  gender: string | null;
  city: string | null;
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
  show_bio_in_feed: boolean | null;
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
    offset: number = 0
  ): Promise<FeedCandidate[]> {
    try {
      const currentUser = await this.fetchCurrentUser(userId);
      const genderFilter = this.resolveGenderFilter(currentUser.looking_for);

      let query = this.client
        .from('users')
        .select('id, birthDate, gender, looking_for, bio, city, show_bio_in_feed') // Added 'show_bio_in_feed' to control bio visibility
        .neq('id', userId)
        .lt('active_chats_count', 1) // Exclude users with any active chats (must be 0)
        .or('is_bot.is.null,is_bot.eq.false') // Exclude bots (system users)
        .order('id', { ascending: false }) // Order by ID descending to show newer users first
        .range(offset, offset + limit - 1);

      // Initial filter: optimize query by filtering candidates that current user is looking for
      if (genderFilter !== 'any') {
        query = query.in('gender', genderFilter).not('gender', 'is', null);
      }

      // Filter by city: only show users in the same city
      if (currentUser.city) {
        query = query.eq('city', currentUser.city);
      }

      const [{ data, error }, excludedIds] = await Promise.all([
        query,
        this.fetchExcludedUserIds(userId),
      ]);

      if (error) {
        throw new InternalError(
          `Failed to load feed candidates: ${this.formatSupabaseError(error)}`
        );
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Filter out excluded users (liked/passed) and apply bidirectional gender filter
      const currentUserGender = this.normalizeGender(currentUser.gender);
      const filtered = data.filter((row) => {
        if (excludedIds.has(row.id)) {
          return false;
        }

        // Bidirectional filter: both users must be looking for each other's gender
        const candidateGender = this.normalizeGender(row.gender);
        const candidateLookingFor = row.looking_for;

        // Check if current user is looking for candidate's gender
        if (!this.includesGender(currentUser.looking_for, candidateGender)) {
          return false;
        }

        // Check if candidate is looking for current user's gender
        // If current user has no gender, allow if candidate is looking for "both" or has no preference
        if (currentUserGender) {
          // Current user has gender - check if candidate is looking for it
          if (!this.includesGender(candidateLookingFor, currentUserGender)) {
            return false;
          }
        } else {
          // Current user has no gender - only allow if candidate is looking for "both" or has no preference
          if (candidateLookingFor && candidateLookingFor !== 'both') {
            return false;
          }
        }

        return true;
      });

      // Fetch identity info from auth.users for all candidates in parallel
      const candidatesWithNames = await Promise.all(
        filtered.map(async (row) => {
          const identity = await this.fetchUserIdentity(row.id);
          if (!identity || identity.deletedAt) {
            return null;
          }

          return await this.mapRowToCandidate({ ...row, name: identity.name });
        })
      );

      return candidatesWithNames.filter(
        (candidate): candidate is FeedCandidate => candidate !== null
      );
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      throw new InternalError(
        'Unexpected error while loading feed candidates',
        error
      );
    }
  }

  private async fetchCurrentUser(userId: string): Promise<CurrentUserRow> {
    const { data, error } = await this.client
      .from('users')
      .select('id, looking_for, gender, city')
      .eq('id', userId)
      .single();

    if (error) {
      throw new InternalError(
        `Failed to resolve current user: ${this.formatSupabaseError(error)}`
      );
    }

    if (!data) {
      throw new NotFoundError('Authenticated user not found in Supabase');
    }

    return data as CurrentUserRow;
  }

  /**
   * Determines if a looking_for preference includes a specific gender.
   * Pure function for bidirectional gender filtering.
   *
   * @param lookingFor - The user's looking_for preference ('male', 'female', 'both', or null)
   * @param gender - The gender to check ('male', 'female', 'non_binary')
   * @returns true if the looking_for preference includes the gender
   */
  private includesGender(
    lookingFor: LookingForValue | null,
    gender: Gender | null
  ): boolean {
    if (!gender) {
      return false;
    }

    if (!lookingFor || lookingFor === 'both') {
      // 'both' means "any gender" - includes all genders (male, female, non_binary)
      return true;
    }

    // Map looking_for values to gender values
    if (lookingFor === 'male') {
      return gender === 'male';
    }

    if (lookingFor === 'female') {
      return gender === 'female';
    }

    return false;
  }

  /**
   * Resolves looking_for preference to a list of genders for SQL query optimization.
   * Used for initial filtering in the database query.
   *
   * @param lookingFor - The user's looking_for preference
   * @returns Array of genders or 'any' if no filter should be applied
   */
  private resolveGenderFilter(
    lookingFor: LookingForValue | null
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

    const [likes, passes, receivedPasses] = (await Promise.all([
      // Users the current user has liked
      this.client
        .from('interactions')
        .select('to_user')
        .eq('from_user', userId)
        .eq('action', 'like'),
      // Users the current user has passed (disliked)
      this.client
        .from('interactions')
        .select('to_user')
        .eq('from_user', userId)
        .eq('action', 'pass'),
      // Users who have passed (disliked) the current user
      this.client
        .from('interactions')
        .select('from_user')
        .eq('to_user', userId)
        .eq('action', 'pass'),
    ])) as [
      PostgrestResponse<InteractionRow>,
      PostgrestResponse<InteractionRow>,
      PostgrestResponse<{ from_user: string }>,
    ];

    const processResult = (result: PostgrestResponse<InteractionRow>) => {
      if (result.error) {
        throw new InternalError(
          `Failed to fetch interactions for feed exclusion: ${this.formatSupabaseError(result.error)}`
        );
      }

      (result.data ?? []).forEach((row) => {
        if (row?.to_user) {
          excluded.add(row.to_user);
        }
      });
    };

    // Process likes and passes given by current user
    processResult(likes);
    processResult(passes);

    // Process passes received by current user (bidirectional exclusion)
    if (receivedPasses.error) {
      throw new InternalError(
        `Failed to fetch received passes for feed exclusion: ${this.formatSupabaseError(receivedPasses.error)}`
      );
    }

    (receivedPasses.data ?? []).forEach((row) => {
      if (row?.from_user) {
        excluded.add(row.from_user);
      }
    });

    return excluded;
  }

  /**
   * Obtiene el nombre del usuario desde auth.users.raw_user_meta_data.display_name
   *
   * @param userId - ID del usuario
   * @returns El nombre del usuario o un valor por defecto
   */
  private async fetchUserIdentity(
    userId: string
  ): Promise<{ name: string; deletedAt: string | null } | null> {
    try {
      const { data, error } = await this.client.auth.admin.getUserById(userId);

      if (error || !data?.user) {
        console.warn(
          `[SupabaseFeedService] Could not fetch name for user ${userId}`,
          error
        );
        return null;
      }

      const user = data.user;
      const metadata = user.user_metadata as Record<string, unknown> | null;

      const displayName =
        metadata && typeof metadata.display_name === 'string'
          ? metadata.display_name.trim()
          : '';

      const result = displayName || user.email || 'Usuario';
      const deletedAt =
        (user as unknown as { deleted_at?: string | null })?.deleted_at ?? null;

      return {
        name: result,
        deletedAt,
      };
    } catch (error) {
      console.warn(
        `[SupabaseFeedService] Error fetching name for user ${userId}`,
        error
      );
      return null;
    }
  }

  private async mapRowToCandidate(row: FeedUserRow): Promise<FeedCandidate> {
    const gender = this.normalizeGender(row.gender);
    const birthDate = this.normalizeDate(row.birthDate);
    // Always include bio - filtering is done on frontend based on show_bio_in_feed flags
    const bio = row.bio ? this.truncateBio(row.bio) : null;
    const age = birthDate ? this.calculateAge(birthDate) : null;
    const photoUrl = await this.getMainPhotoUrl(row.id);

    return {
      id: row.id,
      name: row.name, // Already fetched from auth.users
      bio,
      birthDate,
      age,
      gender,
      photoUrl,
      show_bio_in_feed: row.show_bio_in_feed,
    };
  }

  private async getMainPhotoUrl(userId: string): Promise<string | null> {
    try {
      const { data, error } = await this.client
        .from('user_photos')
        .select('public_url')
        .eq('user_id', userId)
        .eq('is_main', true)
        .single();

      if (error || !data) {
        return null;
      }

      return this.normalizeUrl(data.public_url);
    } catch {
      return null;
    }
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
        'SupabaseFeedService requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
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
