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
  display_name: string;
  birthDate: string | null;
  gender: string | null;
  looking_for: LookingForValue | null;
  bio: string | null;
  city: string | null;
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
  city: string | null;
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
      const [currentUser, excludedIds] = await Promise.all([
        this.fetchCurrentUser(userId),
        this.fetchExcludedUserIds(userId),
      ]);

      const genderFilter = this.resolveGenderFilter(currentUser.looking_for);
      const currentUserGender = this.normalizeGender(currentUser.gender);

      let query = this.client
        .from('users_active')
        .select(
          'id, display_name, birthDate, gender, looking_for, bio, city, show_bio_in_feed'
        )
        .neq('id', userId)
        .or('is_bot.is.null,is_bot.eq.false');

      // Exclude users already interacted with (likes, passes, matches, blocks)
      if (excludedIds.size > 0) {
        const ids = Array.from(excludedIds);
        query = query.not('id', 'in', `(${ids.join(',')})`);
      }

      // Filter: candidates whose gender matches what the current user is looking for
      if (genderFilter !== 'any') {
        query = query.in('gender', genderFilter).not('gender', 'is', null);
      }

      // Bidirectional filter: candidates must be looking for the current user's gender
      query = query.or(
        this.buildReverseLookingForFilter(currentUserGender)
      );

      query = query
        .order('id', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        throw new InternalError(
          `Failed to load feed candidates: ${this.formatSupabaseError(error)}`
        );
      }

      if (!data || data.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[SupabaseFeedService] Feed query returned 0 rows', {
            userId,
            offset,
            limit,
            viewerGender: currentUser.gender,
            viewerLookingFor: currentUser.looking_for,
            normalizedViewerGender: currentUserGender,
            genderFilter,
            reverseLookingForOr: this.buildReverseLookingForFilter(
              currentUserGender
            ),
            excludedCount: excludedIds.size,
          });
        }
        return [];
      }

      const candidates = await Promise.all(
        data.map((row) => this.mapRowToCandidate(row))
      );

      return candidates;
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
   * Builds a PostgREST OR filter so only candidates whose looking_for
   * is compatible with the current user's gender are returned.
   *
   * 'both' and NULL looking_for always match any gender.
   */
  private buildReverseLookingForFilter(currentUserGender: Gender | null): string {
    if (currentUserGender === 'male') {
      return 'looking_for.eq.male,looking_for.eq.both,looking_for.is.null';
    }
    if (currentUserGender === 'female') {
      return 'looking_for.eq.female,looking_for.eq.both,looking_for.is.null';
    }
    return 'looking_for.eq.both,looking_for.is.null';
  }

  /**
   * Resolves looking_for preference to a list of genders for SQL query optimization.
   * Used for initial filtering in the database query.
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

    // Get all chat IDs where the current user is a participant
    // This excludes users with confirmed matches from the discover feed
    const { data: participantRows, error: participantError } = await this.client
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', userId);

    let matchedUserIds: string[] = [];
    if (participantError) {
      // Log error but don't fail - other exclusions will still work
      console.warn(
        `[SupabaseFeedService] Failed to fetch chat participants for user ${userId}:`,
        this.formatSupabaseError(participantError)
      );
    } else if (participantRows && participantRows.length > 0) {
      const chatIds = participantRows.map((row) => row.chat_id);

      // Get all other participants from these chats (excluding the current user)
      const { data: otherParticipants, error: otherParticipantsError } =
        await this.client
          .from('chat_participants')
          .select('user_id')
          .in('chat_id', chatIds)
          .neq('user_id', userId);

      if (otherParticipantsError) {
        // Log error but don't fail - other exclusions will still work
        console.warn(
          `[SupabaseFeedService] Failed to fetch other participants for user ${userId}:`,
          this.formatSupabaseError(otherParticipantsError)
        );
      } else if (otherParticipants) {
        matchedUserIds = otherParticipants.map((p) => p.user_id);
      }
    }

    const [likes, passes, receivedPasses, blockedUsers] = (await Promise.all([
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
      // Users the current user has blocked (closed chats)
      this.client
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', userId),
    ])) as [
      PostgrestResponse<InteractionRow>,
      PostgrestResponse<InteractionRow>,
      PostgrestResponse<{ from_user: string }>,
      PostgrestResponse<{ blocked_id: string }>,
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

    // Process blocked users (users the current user has blocked)
    if (blockedUsers.error) {
      throw new InternalError(
        `Failed to fetch blocked users for feed exclusion: ${this.formatSupabaseError(blockedUsers.error)}`
      );
    }

    (blockedUsers.data ?? []).forEach((row) => {
      if (row?.blocked_id) {
        excluded.add(row.blocked_id);
      }
    });

    // Process users with confirmed matches (should never appear in discover again)
    matchedUserIds.forEach((matchedUserId) => {
      excluded.add(matchedUserId);
    });

    return excluded;
  }

  private async mapRowToCandidate(row: FeedUserRow): Promise<FeedCandidate> {
    const gender = this.normalizeGender(row.gender);
    const birthDate = this.normalizeDate(row.birthDate);
    const bio = row.bio ? row.bio.trim() || null : null;
    const age = birthDate ? this.calculateAge(birthDate) : null;
    const photoUrl = await this.getMainPhotoUrl(row.id);

    return {
      id: row.id,
      name: row.display_name,
      bio,
      birthDate,
      age,
      gender,
      photoUrl,
      city: row.city ? row.city.trim() || null : null,
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
