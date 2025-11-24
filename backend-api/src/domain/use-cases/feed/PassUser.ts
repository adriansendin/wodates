import { Pass } from '../../entities/Pass';
import { Result, success, failure } from '../../Result';
import { DomainError, ConflictError } from '../../errors/DomainError';
import { PassRepository } from '../../repositories/PassRepository';

export class PassUser {
  constructor(private passRepository: PassRepository) {}

  async execute(
    userId: string,
    targetUserId: string
  ): Promise<Result<Pass, DomainError>> {
    // Check if already passed
    const hasPassedResult = await this.passRepository.hasPassed(
      userId,
      targetUserId
    );
    if (isSuccess(hasPassedResult) && hasPassedResult.data) {
      return failure(new ConflictError('User already passed'));
    }

    // Create pass
    const passResult = await this.passRepository.create({
      userId,
      targetUserId,
    });

    if (isFailure(passResult)) {
      return passResult;
    }

    return success(passResult.data);
  }
}

function isSuccess<T, E>(
  result: Result<T, E>
): result is import('../../Result').Success<T> {
  return result.success;
}

function isFailure<T, E>(
  result: Result<T, E>
): result is import('../../Result').Failure<E> {
  return !result.success;
}
