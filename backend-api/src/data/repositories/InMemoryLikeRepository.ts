import { Like, CreateLike } from '../../domain/entities/Like';
import { Result, success, failure } from '../../domain/Result';
import { DomainError, NotFoundError } from '../../domain/errors/DomainError';
import { LikeRepository } from '../../domain/repositories/LikeRepository';

export class InMemoryLikeRepository implements LikeRepository {
  private likes: Map<string, Like> = new Map();
  private userLikes: Map<string, Set<string>> = new Map(); // userId -> Set of liked user IDs
  private likeIndex: Map<string, string> = new Map(); // "userId-targetUserId" -> likeId

  async create(likeData: CreateLike): Promise<Result<Like, DomainError>> {
    const id = this.generateId();
    const now = new Date().toISOString();
    
    const like: Like = {
      id,
      ...likeData,
      createdAt: now,
    };

    this.likes.set(id, like);
    
    // Update indexes
    if (!this.userLikes.has(likeData.userId)) {
      this.userLikes.set(likeData.userId, new Set());
    }
    this.userLikes.get(likeData.userId)!.add(likeData.targetUserId);
    this.likeIndex.set(`${likeData.userId}-${likeData.targetUserId}`, id);
    
    return success(like);
  }

  async findByUserId(userId: string): Promise<Result<Like[], DomainError>> {
    const likedUserIds = this.userLikes.get(userId);
    if (!likedUserIds) {
      return success([]);
    }

    const userLikes = Array.from(likedUserIds)
      .map(targetUserId => {
        const likeId = this.likeIndex.get(`${userId}-${targetUserId}`);
        return likeId ? this.likes.get(likeId) : null;
      })
      .filter((like): like is Like => like !== null);

    return success(userLikes);
  }

  async findByUserAndTarget(userId: string, targetUserId: string): Promise<Result<Like, DomainError>> {
    const likeId = this.likeIndex.get(`${userId}-${targetUserId}`);
    if (!likeId) {
      return failure(new NotFoundError('Like not found'));
    }

    const like = this.likes.get(likeId);
    if (!like) {
      return failure(new NotFoundError('Like not found'));
    }

    return success(like);
  }

  async hasLiked(userId: string, targetUserId: string): Promise<Result<boolean, DomainError>> {
    const likedUserIds = this.userLikes.get(userId);
    if (!likedUserIds) {
      return success(false);
    }

    return success(likedUserIds.has(targetUserId));
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
