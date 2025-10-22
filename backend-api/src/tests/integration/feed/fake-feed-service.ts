import { GetFeedUsers } from '../../../domain/use-cases/feed/GetFeedUsers';
import { DomainError } from '../../../domain/errors/DomainError';
import { Gender } from '../../../domain/entities/User';
import { Result } from '../../../domain/Result';

export type FeedCandidate = {
  id: string;
  name: string;
  bio: string | null;
  birthDate: string | null;
  age: number | null;
  gender: Gender | null;
  photoUrl: string | null;
};

function isFailure<T, E>(result: Result<T, E>): result is import('../../../domain/Result').Failure<E> {
  return !result.success;
}

export class FakeFeedService {
  constructor(
    private readonly getFeedUsers: GetFeedUsers,
  ) {}

  async getFeedCandidates(
    userId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<FeedCandidate[]> {
    const result = await this.getFeedUsers.execute(userId, limit, offset);

    if (isFailure(result)) {
      throw result.error as DomainError;
    }

    return result.data.map((user) => ({
      id: user.id,
      name: user.name,
      bio: user.bio ?? null,
      birthDate: user.birthDate ?? null,
      age: user.birthDate ? this.calculateAge(user.birthDate) : null,
      gender: user.gender ?? null,
      photoUrl: user.photoUrl ?? null,
    }));
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
}
