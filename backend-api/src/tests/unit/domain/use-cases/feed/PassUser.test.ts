import { beforeEach, describe, expect, it } from 'vitest';
import { PassUser } from '../../../../../domain/use-cases/feed/PassUser';
import { TestPassRepository } from '../../../helpers/fakeRepositories';
import { InternalError } from '../../../../../domain/errors/DomainError';

const USER_A = '33333333-3333-3333-3333-333333333333';
const USER_B = '44444444-4444-4444-4444-444444444444';

describe('PassUser use case', () => {
  let passRepository: TestPassRepository;
  let useCase: PassUser;

  beforeEach(() => {
    passRepository = new TestPassRepository();
    useCase = new PassUser(passRepository);
  });

  it('creates a pass when no previous pass exists', async () => {
    const result = await useCase.execute(USER_A, USER_B);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        userId: USER_A,
        targetUserId: USER_B,
      });
    }
  });

  it('returns CONFLICT when the user already passed the target', async () => {
    await useCase.execute(USER_A, USER_B);

    const duplicate = await useCase.execute(USER_A, USER_B);

    expect(duplicate.success).toBe(false);
    if (!duplicate.success) {
      expect(duplicate.error.code).toBe('CONFLICT');
    }
  });

  it('propagates repository errors when creating the pass fails', async () => {
    passRepository.setCreateError(new InternalError('pass storage unavailable'));

    const result = await useCase.execute(USER_A, USER_B);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
      expect(result.error.message).toBe('pass storage unavailable');
    }
  });
});

