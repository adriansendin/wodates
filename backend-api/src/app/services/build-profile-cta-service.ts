import { DocLoveHelper } from './doc-love-helper';
import { MatchRepository } from '../../domain/repositories/MatchRepository';
import { MessageRepository } from '../../domain/repositories/MessageRepository';
import { SupabaseUserService } from './supabase-user-service';
import { NotFoundError, ForbiddenError } from '../../domain/errors/DomainError';

const WELCOME_LAST_MESSAGE =
  "When you're done, tap the button below to generate your profile.";

/**
 * Service for the "Build my profile" CTA in Doc Love chat.
 * Determines whether to show the button and records when the user taps it.
 */
export class BuildProfileCtaService {
  constructor(
    private docLoveHelper: DocLoveHelper,
    private matchRepository: MatchRepository,
    private messageRepository: MessageRepository,
    private userService: SupabaseUserService
  ) {}

  /**
   * Returns whether to show the "Build my profile" button for this user in this match.
   * True only if: match is with Doc Love, chat contains the last welcome message, and user has not tapped yet.
   */
  async getShowButton(userId: string, matchId: string): Promise<boolean> {
    const docLoveId = await this.docLoveHelper.getDocLoveUserId();
    const matchResult = await this.matchRepository.findById(matchId);
    if (!matchResult.success || !matchResult.data) {
      return false;
    }
    const match = matchResult.data;
    const otherId =
      match.userId1 === userId ? match.userId2 : match.userId1;
    if (otherId !== docLoveId) {
      return false;
    }

    const profile = await this.userService.getProfile(userId);
    if (profile.build_profile_cta_tapped_at != null) {
      return false;
    }

    const messagesResult = await this.messageRepository.findByMatchId(
      matchId,
      100
    );
    if (!messagesResult.success) {
      return false;
    }
    const hasWelcomeEnd = messagesResult.data.some(
      (m) => m.content && m.content.includes(WELCOME_LAST_MESSAGE)
    );
    return hasWelcomeEnd;
  }

  /**
   * Marks that the user has tapped the "Build my profile" button.
   * Call only when match is with Doc Love and user is part of the match.
   */
  async markTapped(userId: string, matchId: string): Promise<void> {
    const docLoveId = await this.docLoveHelper.getDocLoveUserId();
    const matchResult = await this.matchRepository.findById(matchId);
    if (!matchResult.success || !matchResult.data) {
      throw new NotFoundError('Match not found');
    }
    const match = matchResult.data;
    const otherId =
      match.userId1 === userId ? match.userId2 : match.userId1;
    if (otherId !== docLoveId) {
      throw new ForbiddenError('Not a Doc Love match');
    }
    await this.userService.setBuildProfileCtaTapped(userId);
  }
}
