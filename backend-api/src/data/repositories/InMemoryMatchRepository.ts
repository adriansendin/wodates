import { Match, CreateMatch } from '../../domain/entities/Match';
import { Result, success, failure } from '../../domain/Result';
import { DomainError, NotFoundError } from '../../domain/errors/DomainError';
import { MatchRepository } from '../../domain/repositories/MatchRepository';

export class InMemoryMatchRepository implements MatchRepository {
  private matches: Map<string, Match> = new Map();
  private userMatches: Map<string, Set<string>> = new Map(); // userId -> Set of match IDs
  private matchIndex: Map<string, string> = new Map(); // "userId1-userId2" -> matchId

  async create(matchData: CreateMatch): Promise<Result<Match, DomainError>> {
    const id = this.generateId();
    const now = new Date().toISOString();
    
    const match: Match = {
      id,
      ...matchData,
      createdAt: now,
    };

    this.matches.set(id, match);
    
    // Update indexes
    if (!this.userMatches.has(matchData.userId1)) {
      this.userMatches.set(matchData.userId1, new Set());
    }
    if (!this.userMatches.has(matchData.userId2)) {
      this.userMatches.set(matchData.userId2, new Set());
    }
    
    this.userMatches.get(matchData.userId1)!.add(id);
    this.userMatches.get(matchData.userId2)!.add(id);
    
    // Create bidirectional index
    this.matchIndex.set(`${matchData.userId1}-${matchData.userId2}`, id);
    this.matchIndex.set(`${matchData.userId2}-${matchData.userId1}`, id);
    
    return success(match);
  }

  async findByUserId(userId: string): Promise<Result<Match[], DomainError>> {
    const userMatchIds = this.userMatches.get(userId);
    if (!userMatchIds) {
      return success([]);
    }

    const userMatches = Array.from(userMatchIds)
      .map(matchId => this.matches.get(matchId))
      .filter((match): match is Match => match !== null);

    return success(userMatches);
  }

  async findById(id: string): Promise<Result<Match, DomainError>> {
    const match = this.matches.get(id);
    if (!match) {
      return failure(new NotFoundError('Match not found'));
    }

    return success(match);
  }

  async existsBetweenUsers(userId1: string, userId2: string): Promise<Result<boolean, DomainError>> {
    const matchId = this.matchIndex.get(`${userId1}-${userId2}`) || 
                   this.matchIndex.get(`${userId2}-${userId1}`);
    
    return success(!!matchId);
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
