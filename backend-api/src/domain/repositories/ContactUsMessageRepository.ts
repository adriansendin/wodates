import { ContactUsMessage, CreateContactUsMessage } from '../entities/ContactUsMessage';
import { Result } from '../Result';
import { DomainError } from '../errors/DomainError';

export interface ContactUsMessageRepository {
  create(message: CreateContactUsMessage): Promise<Result<ContactUsMessage, DomainError>>;
}

