import { Pass, CreatePass } from '../../domain/entities/Pass';
import { Result, success } from '../../domain/Result';
import { DomainError } from '../../domain/errors/DomainError';
import { PassRepository } from '../../domain/repositories/PassRepository';

export class InMemoryPassRepository implements PassRepository {
  private passes: Map<string, Pass> = new Map();
  private userPasses: Map<string, Set<string>> = new Map(); // userId -> Set of passed user IDs
  private passIndex: Map<string, string> = new Map(); // "userId-targetUserId" -> passId

  async create(passData: CreatePass): Promise<Result<Pass, DomainError>> {
    const id = this.generateId();
    const now = new Date().toISOString();
    
    const pass: Pass = {
      id,
      ...passData,
      createdAt: now,
    };

    this.passes.set(id, pass);
    
    // Update indexes
    if (!this.userPasses.has(passData.userId)) {
      this.userPasses.set(passData.userId, new Set());
    }
    this.userPasses.get(passData.userId)!.add(passData.targetUserId);
    this.passIndex.set(`${passData.userId}-${passData.targetUserId}`, id);
    
    return success(pass);
  }

  async findByUserId(userId: string): Promise<Result<Pass[], DomainError>> {
    const passedUserIds = this.userPasses.get(userId);
    if (!passedUserIds) {
      return success([]);
    }

    const userPasses = Array.from(passedUserIds)
      .map(targetUserId => {
        const passId = this.passIndex.get(`${userId}-${targetUserId}`);
        return passId ? this.passes.get(passId) : null;
      })
      .filter((pass): pass is Pass => pass !== null);

    return success(userPasses);
  }

  async hasPassed(userId: string, targetUserId: string): Promise<Result<boolean, DomainError>> {
    const passedUserIds = this.userPasses.get(userId);
    if (!passedUserIds) {
      return success(false);
    }

    return success(passedUserIds.has(targetUserId));
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
