import { QuestionBank, CreateQuestionBank, UpdateQuestionBank } from '../entities/QuestionBank';
import { Result } from '../Result';
import { DomainError } from '../errors/DomainError';

export interface QuestionBankRepository {
  findAll(options?: {
    category?: string;
    deprecated?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Result<QuestionBank[], DomainError>>;
  findById(id: number): Promise<Result<QuestionBank, DomainError>>;
  create(questionBank: CreateQuestionBank): Promise<Result<QuestionBank, DomainError>>;
  update(id: number, questionBank: UpdateQuestionBank): Promise<Result<QuestionBank, DomainError>>;
  delete(id: number): Promise<Result<void, DomainError>>;
}
