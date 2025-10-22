import { randomUUID } from 'crypto';
import { Like, CreateLike } from '../../../domain/entities/Like';
import { Match, CreateMatch } from '../../../domain/entities/Match';
import { Message, CreateMessage } from '../../../domain/entities/Message';
import { Pass, CreatePass } from '../../../domain/entities/Pass';
import { BlockedUser, CreateBlockedUser } from '../../../domain/entities/BlockedUser';
import { success, failure, Result } from '../../../domain/Result';
import {
  DomainError,
  NotFoundError,
} from '../../../domain/errors/DomainError';
import { LikeRepository } from '../../../domain/repositories/LikeRepository';
import { MatchRepository } from '../../../domain/repositories/MatchRepository';
import { MessageRepository } from '../../../domain/repositories/MessageRepository';
import { PassRepository } from '../../../domain/repositories/PassRepository';
import { BlockedUserRepository } from '../../../domain/repositories/BlockedUserRepository';

const now = () => new Date().toISOString();

const pairKey = (userId: string, targetUserId: string) => `${userId}->${targetUserId}`;

export class TestLikeRepository implements LikeRepository {
  private likes = new Map<string, Like>();
  private createError: DomainError | undefined = undefined;
  private hasLikedOverrides = new Map<string, boolean>();

  constructor(initialLikes: Like[] = []) {
    initialLikes.forEach((like) => {
      this.likes.set(pairKey(like.userId, like.targetUserId), like);
    });
  }

  setCreateError(error: DomainError | undefined): void {
    this.createError = error;
  }

  setHasLikedOverride(userId: string, targetUserId: string, value: boolean) {
    this.hasLikedOverrides.set(pairKey(userId, targetUserId), value);
  }

  clearHasLikedOverride(userId: string, targetUserId: string) {
    this.hasLikedOverrides.delete(pairKey(userId, targetUserId));
  }

  seedLike(like: Like) {
    this.likes.set(pairKey(like.userId, like.targetUserId), like);
  }

  async create(data: CreateLike): Promise<Result<Like, DomainError>> {
    if (this.createError) {
      return failure(this.createError);
    }

    const like: Like = {
      id: randomUUID(),
      userId: data.userId,
      targetUserId: data.targetUserId,
      createdAt: now(),
    };

    this.seedLike(like);
    return success(like);
  }

  async findByUserId(userId: string): Promise<Result<Like[], DomainError>> {
    const likes = Array.from(this.likes.values()).filter((like) => like.userId === userId);
    return success(likes);
  }

  async findByUserAndTarget(userId: string, targetUserId: string): Promise<Result<Like, DomainError>> {
    const like = this.likes.get(pairKey(userId, targetUserId));
    if (!like) {
      return failure(new NotFoundError('Like not found'));
    }
    return success(like);
  }

  async hasLiked(userId: string, targetUserId: string): Promise<Result<boolean, DomainError>> {
    const key = pairKey(userId, targetUserId);
    if (this.hasLikedOverrides.has(key)) {
      return success(this.hasLikedOverrides.get(key) ?? false);
    }
    return success(this.likes.has(key));
  }
}

export class TestMatchRepository implements MatchRepository {
  private matches = new Map<string, Match>();
  private createError: DomainError | undefined = undefined;
  private findByIdError: DomainError | undefined = undefined;

  constructor(initialMatches: Match[] = []) {
    initialMatches.forEach((match) => {
      this.matches.set(match.id, match);
    });
  }

  setCreateError(error: DomainError | undefined): void {
    this.createError = error;
  }

  setFindByIdError(error: DomainError | undefined): void {
    this.findByIdError = error;
  }

  seedMatch(match: Match) {
    this.matches.set(match.id, match);
  }

  async create(data: CreateMatch): Promise<Result<Match, DomainError>> {
    if (this.createError) {
      return failure(this.createError);
    }

    const match: Match = {
      id: randomUUID(),
      userId1: data.userId1,
      userId2: data.userId2,
      createdAt: now(),
    };

    this.matches.set(match.id, match);
    return success(match);
  }

  async findByUserId(userId: string): Promise<Result<Match[], DomainError>> {
    const matches = Array.from(this.matches.values()).filter(
      (match) => match.userId1 === userId || match.userId2 === userId
    );
    return success(matches);
  }

  async findById(id: string): Promise<Result<Match, DomainError>> {
    if (this.findByIdError) {
      return failure(this.findByIdError);
    }

    const match = this.matches.get(id);
    if (!match) {
      return failure(new NotFoundError('Match not found'));
    }
    return success(match);
  }

  async existsBetweenUsers(userId1: string, userId2: string): Promise<Result<boolean, DomainError>> {
    const exists = Array.from(this.matches.values()).some((match) => {
      const sameOrder = match.userId1 === userId1 && match.userId2 === userId2;
      const reverseOrder = match.userId1 === userId2 && match.userId2 === userId1;
      return sameOrder || reverseOrder;
    });
    return success(exists);
  }

  async delete(matchId: string): Promise<Result<void, DomainError>> {
    this.matches.delete(matchId);
    return success(undefined);
  }
}

export class TestMessageRepository implements MessageRepository {
  private messages = new Map<string, Message>();
  private createError: DomainError | undefined = undefined;

  constructor(initialMessages: Message[] = []) {
    initialMessages.forEach((message) => {
      this.messages.set(message.id, message);
    });
  }

  setCreateError(error: DomainError | undefined): void {
    this.createError = error;
  }

  seedMessage(message: Message) {
    this.messages.set(message.id, message);
  }

  async create(data: CreateMessage): Promise<Result<Message, DomainError>> {
    if (this.createError) {
      return failure(this.createError);
    }

    const message: Message = {
      id: randomUUID(),
      matchId: data.matchId,
      senderId: data.senderId,
      content: data.content,
      createdAt: now(),
    };

    this.messages.set(message.id, message);
    return success(message);
  }

  async findByMatchId(matchId: string): Promise<Result<Message[], DomainError>> {
    const messages = Array.from(this.messages.values()).filter(
      (message) => message.matchId === matchId
    );
    return success(messages);
  }

  async findById(id: string): Promise<Result<Message, DomainError>> {
    const message = this.messages.get(id);
    if (!message) {
      return failure(new NotFoundError('Message not found'));
    }
    return success(message);
  }
}

export class TestPassRepository implements PassRepository {
  private passes = new Map<string, Pass>();
  private createError: DomainError | undefined = undefined;

  constructor(initialPasses: Pass[] = []) {
    initialPasses.forEach((pass) => {
      this.passes.set(pairKey(pass.userId, pass.targetUserId), pass);
    });
  }

  setCreateError(error: DomainError | undefined): void {
    this.createError = error;
  }

  seedPass(pass: Pass) {
    this.passes.set(pairKey(pass.userId, pass.targetUserId), pass);
  }

  async create(data: CreatePass): Promise<Result<Pass, DomainError>> {
    if (this.createError) {
      return failure(this.createError);
    }

    const pass: Pass = {
      id: randomUUID(),
      userId: data.userId,
      targetUserId: data.targetUserId,
      createdAt: now(),
    };

    this.seedPass(pass);
    return success(pass);
  }

  async findByUserId(userId: string): Promise<Result<Pass[], DomainError>> {
    const passes = Array.from(this.passes.values()).filter((pass) => pass.userId === userId);
    return success(passes);
  }

  async hasPassed(userId: string, targetUserId: string): Promise<Result<boolean, DomainError>> {
    return success(this.passes.has(pairKey(userId, targetUserId)));
  }
}

export class TestBlockedUserRepository implements BlockedUserRepository {
  private blocks = new Map<string, BlockedUser>();
  private createError: DomainError | undefined = undefined;
  private hasBlockedOverrides = new Map<string, boolean>();

  constructor(initialBlocks: BlockedUser[] = []) {
    initialBlocks.forEach((block) => {
      this.blocks.set(pairKey(block.blockerId, block.blockedId), block);
    });
  }

  setCreateError(error: DomainError | undefined): void {
    this.createError = error;
  }

  setHasBlockedOverride(blockerId: string, blockedId: string, value: boolean) {
    this.hasBlockedOverrides.set(pairKey(blockerId, blockedId), value);
  }

  seedBlock(block: BlockedUser) {
    this.blocks.set(pairKey(block.blockerId, block.blockedId), block);
  }

  async create(data: CreateBlockedUser): Promise<Result<BlockedUser, DomainError>> {
    if (this.createError) {
      return failure(this.createError);
    }

    const block: BlockedUser = {
      blockerId: data.blockerId,
      blockedId: data.blockedId,
      createdAt: now(),
    };

    this.seedBlock(block);
    return success(block);
  }

  async hasBlocked(blockerId: string, blockedId: string): Promise<Result<boolean, DomainError>> {
    const key = pairKey(blockerId, blockedId);
    if (this.hasBlockedOverrides.has(key)) {
      return success(this.hasBlockedOverrides.get(key) ?? false);
    }
    return success(this.blocks.has(key));
  }

  async isBlocked(userId1: string, userId2: string): Promise<Result<boolean, DomainError>> {
    const blocked =
      this.blocks.has(pairKey(userId1, userId2)) ||
      this.blocks.has(pairKey(userId2, userId1));
    return success(blocked);
  }

  async getBlockedByUser(userId: string): Promise<Result<BlockedUser[], DomainError>> {
    const blocks = Array.from(this.blocks.values()).filter((block) => block.blockerId === userId);
    return success(blocks);
  }

  async delete(blockerId: string, blockedId: string): Promise<Result<void, DomainError>> {
    this.blocks.delete(pairKey(blockerId, blockedId));
    return success(undefined);
  }
}

