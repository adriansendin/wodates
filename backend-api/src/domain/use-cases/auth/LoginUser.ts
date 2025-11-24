import { User } from '../../entities/User';
import { Result, success, failure } from '../../Result';
import { DomainError, UnauthorizedError } from '../../errors/DomainError';
import { UserRepository } from '../../repositories/UserRepository';

export class LoginUser {
  constructor(private userRepository: UserRepository) {}

  async execute(
    email: string,
    password: string
  ): Promise<Result<User, DomainError>> {
    const userResult = await this.userRepository.findByEmail(email);

    if (isFailure(userResult)) {
      return failure(new UnauthorizedError('Invalid email or password'));
    }

    const user = userResult.data;

    // In v0.1, we'll use a simple password check (in production, use bcrypt)
    // For now, we'll accept any password for demo purposes
    if (password.length < 6) {
      return failure(new UnauthorizedError('Invalid email or password'));
    }

    return success(user);
  }
}

function isFailure<T, E>(
  result: Result<T, E>
): result is import('../../Result').Failure<E> {
  return !result.success;
}
