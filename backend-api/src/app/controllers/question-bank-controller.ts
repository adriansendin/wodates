import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DomainError } from '../../domain/errors/DomainError';
import { QuestionBankRepository } from '../../domain/repositories/QuestionBankRepository';
import {
  CreateQuestionBankSchema,
  UpdateQuestionBankSchema,
} from '../../domain/entities/QuestionBank';

const QuestionBankQuerySchema = z.object({
  category: z.string().optional(),
  deprecated: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export class QuestionBankController {
  constructor(
    private readonly questionBankRepository: QuestionBankRepository
  ) {}

  async getAll(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = QuestionBankQuerySchema.parse(request.query ?? {});

      const result = await this.questionBankRepository.findAll({
        ...(query.category !== undefined && { category: query.category }),
        ...(query.deprecated !== undefined && { deprecated: query.deprecated }),
        ...(query.limit !== undefined && { limit: query.limit }),
        ...(query.offset !== undefined && { offset: query.offset }),
      });

      if (result.success) {
        return reply.send({
          questions: result.data,
          count: result.data.length,
        });
      } else {
        return this.handleError(reply, result.error);
      }
    } catch (error) {
      return this.handleValidationError(reply, error);
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = z
        .object({
          id: z.coerce.number().int().positive(),
        })
        .parse(request.params);

      const result = await this.questionBankRepository.findById(id);

      if (result.success) {
        return reply.send(result.data);
      } else {
        return this.handleError(reply, result.error);
      }
    } catch (error) {
      return this.handleValidationError(reply, error);
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const payload = CreateQuestionBankSchema.parse(request.body);

      const result = await this.questionBankRepository.create(payload);

      if (result.success) {
        return reply.status(201).send(result.data);
      } else {
        return this.handleError(reply, result.error);
      }
    } catch (error) {
      return this.handleValidationError(reply, error);
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = z
        .object({
          id: z.coerce.number().int().positive(),
        })
        .parse(request.params);

      const payload = UpdateQuestionBankSchema.parse(request.body);

      const result = await this.questionBankRepository.update(id, payload);

      if (result.success) {
        return reply.send(result.data);
      } else {
        return this.handleError(reply, result.error);
      }
    } catch (error) {
      return this.handleValidationError(reply, error);
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = z
        .object({
          id: z.coerce.number().int().positive(),
        })
        .parse(request.params);

      const result = await this.questionBankRepository.delete(id);

      if (result.success) {
        return reply.status(204).send();
      } else {
        return this.handleError(reply, result.error);
      }
    } catch (error) {
      return this.handleValidationError(reply, error);
    }
  }

  private handleError(reply: FastifyReply, error: DomainError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message,
      details: error.details,
    });
  }

  private handleValidationError(reply: FastifyReply, error: unknown) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: error,
    });
  }
}
