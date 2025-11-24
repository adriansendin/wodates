import { randomUUID } from 'crypto';
import {
  ConflictError,
  UnauthorizedError,
} from '../../../domain/errors/DomainError';
import { RegisterRequest } from '../../../domain/entities/Auth';
import { AuthService, AuthUser } from '../../../app/services/auth-service';

type StoredUser = {
  user: AuthUser;
  password: string;
  profile: RegisterRequest;
};

export class InMemoryAuthService implements AuthService {
  private readonly users = new Map<string, StoredUser>();

  async registerUser(registerRequest: RegisterRequest): Promise<AuthUser> {
    const emailKey = registerRequest.email.toLowerCase();

    if (this.users.has(emailKey)) {
      throw new ConflictError('Email already exists');
    }

    const user: AuthUser = {
      id: randomUUID(),
      email: registerRequest.email,
      name: registerRequest.name,
    };

    this.users.set(emailKey, {
      user,
      password: registerRequest.password,
      profile: registerRequest,
    });

    return user;
  }

  async validateCredentials(
    email: string,
    password: string
  ): Promise<AuthUser> {
    const emailKey = email.toLowerCase();
    const stored = this.users.get(emailKey);

    if (!stored || stored.password !== password) {
      throw new UnauthorizedError('Invalid email or password');
    }

    return stored.user;
  }

  reset(): void {
    this.users.clear();
  }
}
