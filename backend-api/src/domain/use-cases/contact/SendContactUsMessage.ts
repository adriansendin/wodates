import { ContactUsMessage, CreateContactUsMessage } from '../../entities/ContactUsMessage';
import { Result } from '../../Result';
import { DomainError } from '../../errors/DomainError';
import { ContactUsMessageRepository } from '../../repositories/ContactUsMessageRepository';

export class SendContactUsMessage {
  constructor(
    private readonly contactUsMessageRepository: ContactUsMessageRepository
  ) {}

  async execute(
    message: CreateContactUsMessage
  ): Promise<Result<ContactUsMessage, DomainError>> {
    return this.contactUsMessageRepository.create(message);
  }
}

