import { randomUUID } from 'crypto';
import type { Match } from '../../../../domain/entities/Match';

export type MatchFactoryAttributes = {
  id: string;
  userId1: string;
  userId2: string;
  createdAt: string;
};

export class MatchFactory {
  static create(
    overrides: Partial<MatchFactoryAttributes> = {}
  ): MatchFactoryAttributes {
    return {
      id: overrides.id ?? randomUUID(),
      userId1: overrides.userId1 ?? randomUUID(),
      userId2: overrides.userId2 ?? randomUUID(),
      createdAt: overrides.createdAt ?? new Date().toISOString(),
    };
  }

  static toDomain(match: MatchFactoryAttributes): Match {
    return {
      id: match.id,
      userId1: match.userId1,
      userId2: match.userId2,
      createdAt: match.createdAt,
    };
  }
}
