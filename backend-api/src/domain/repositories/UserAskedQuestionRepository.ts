import {
  UserAskedQuestion,
  CreateUserAskedQuestion,
} from '../entities/UserAskedQuestion';
import { Result } from '../Result';
import { DomainError } from '../errors/DomainError';

export interface UserAskedQuestionRepository {
  /**
   * Records that a question from question_bank has been asked to a user.
   * If the question was already asked to this user, it will fail (due to unique constraint).
   *
   * @param userAskedQuestion - The user and question to record
   * @returns Result with the created UserAskedQuestion or a DomainError
   */
  create(
    userAskedQuestion: CreateUserAskedQuestion
  ): Promise<Result<UserAskedQuestion, DomainError>>;

  /**
   * Checks if a specific question has been asked to a specific user.
   *
   * @param userId - The user ID to check
   * @param questionId - The question ID to check
   * @returns Result with boolean indicating if the question was asked, or a DomainError
   */
  hasBeenAsked(
    userId: string,
    questionId: number
  ): Promise<Result<boolean, DomainError>>;

  /**
   * Gets all questions that have been asked to a specific user.
   *
   * @param userId - The user ID
   * @returns Result with array of UserAskedQuestion, or a DomainError
   */
  getAskedQuestionsByUser(
    userId: string
  ): Promise<Result<UserAskedQuestion[], DomainError>>;

  /**
   * Gets all users who have been asked a specific question.
   *
   * @param questionId - The question ID
   * @returns Result with array of UserAskedQuestion, or a DomainError
   */
  getUsersAskedQuestion(
    questionId: number
  ): Promise<Result<UserAskedQuestion[], DomainError>>;

  /**
   * Gets questions that have NOT been asked to a specific user yet.
   * Useful for selecting which question to ask next.
   *
   * @param userId - The user ID
   * @param questionIds - Optional array of question IDs to filter from
   * @returns Result with array of question IDs that haven't been asked, or a DomainError
   */
  getUnaskedQuestionIds(
    userId: string,
    questionIds?: number[]
  ): Promise<Result<number[], DomainError>>;
}
