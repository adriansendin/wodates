import { randomUUID } from 'crypto';

export type UserFactoryAttributes = {
  email: string;
  password: string;
  name: string;
};

export class UserFactory {
  static create(
    overrides: Partial<UserFactoryAttributes> = {}
  ): UserFactoryAttributes {
    const id = randomUUID().split('-')[0];

    return {
      email: overrides.email ?? `user.${id}@example.com`,
      password: overrides.password ?? `Passw0rd!${id}`,
      name: overrides.name ?? `Test User ${id}`,
    };
  }
}
