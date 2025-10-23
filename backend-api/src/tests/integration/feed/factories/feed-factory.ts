import { randomUUID } from 'crypto';
import { User, Gender } from '../../../../domain/entities/User';

type FeedUserOverrides = Partial<User> & {
  age?: number;
  gender?: Gender;
};

export class FeedFactory {
  private static counter = 0;

  static reset(): void {
    this.counter = 0;
  }

  static generateSampleFeed(overrides: FeedUserOverrides[] = []): User[] {
    if (overrides.length === 0) {
      overrides = [
        { gender: 'female' as const, age: 27 },
        { gender: 'female' as const, age: 31 },
        { gender: 'male' as const, age: 29 },
      ];
    }

    return overrides.map((override) => this.createUser(override));
  }

  static createUser(overrides: FeedUserOverrides = {}): User {
    this.counter += 1;

    const age = overrides.age ?? 26 + this.counter;
    const birthDate = overrides.birthDate ?? this.birthDateFromAge(age);
    const gender = overrides.gender ?? 'female';
    const id = overrides.id ?? randomUUID();
    const name = overrides.name ?? `Candidate ${this.counter}`;
    const email = overrides.email ?? `candidate${this.counter}@example.com`;
    const now = new Date(Date.now() - this.counter * 1000).toISOString();

    return {
      id,
      email,
      name,
      birthDate,
      gender,
      bio: overrides.bio ?? `Bio for ${name}`,
      photoUrl:
        overrides.photoUrl ??
        `https://example.com/avatars/${id}.jpg`,
      location: overrides.location ?? {
        latitude: 40.4168,
        longitude: -3.7038,
        city: (overrides as any).location?.city ?? 'Madrid',
        country: (overrides as any).location?.country ?? 'Spain',
      },
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
    };
  }

  private static birthDateFromAge(age: number): string {
    const today = new Date();
    const birthYear = today.getFullYear() - age;
    const birthDate = new Date(Date.UTC(birthYear, today.getMonth(), today.getDate()));
    return birthDate.toISOString();
  }
}
