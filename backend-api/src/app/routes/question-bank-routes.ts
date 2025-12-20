import { FastifyInstance } from 'fastify';
import { QuestionBankController } from '../controllers/question-bank-controller';
import { QuestionBankRepository } from '../../domain/repositories/QuestionBankRepository';

export async function questionBankRoutes(
  fastify: FastifyInstance,
  questionBankRepository: QuestionBankRepository
) {
  const controller = new QuestionBankController(questionBankRepository);

  fastify.get(
    '/question-bank',
    {
      schema: {
        description: 'Get all questions from the question bank',
        tags: ['question-bank'],
        querystring: {
          type: 'object',
          properties: {
            category: { type: 'string' },
            deprecated: { type: 'boolean' },
            limit: { type: 'number', minimum: 1, maximum: 100 },
            offset: { type: 'number', minimum: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              questions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    category: { type: 'string' },
                    question: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    deprecated: { type: 'boolean' },
                  },
                  required: [
                    'id',
                    'category',
                    'question',
                    'createdAt',
                    'deprecated',
                  ],
                },
              },
              count: { type: 'number' },
            },
            required: ['questions', 'count'],
          },
        },
      },
    },
    controller.getAll.bind(controller)
  );

  fastify.get(
    '/question-bank/:id',
    {
      schema: {
        description: 'Get a question by ID',
        tags: ['question-bank'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              category: { type: 'string' },
              question: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              deprecated: { type: 'boolean' },
            },
            required: ['id', 'category', 'question', 'createdAt', 'deprecated'],
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    controller.getById.bind(controller)
  );

  fastify.post(
    '/question-bank',
    {
      schema: {
        description: 'Create a new question',
        tags: ['question-bank'],
        body: {
          type: 'object',
          required: ['category', 'question'],
          properties: {
            category: { type: 'string', minLength: 1 },
            question: { type: 'string', minLength: 1 },
            deprecated: { type: 'boolean' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              category: { type: 'string' },
              question: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              deprecated: { type: 'boolean' },
            },
            required: ['id', 'category', 'question', 'createdAt', 'deprecated'],
          },
        },
      },
    },
    controller.create.bind(controller)
  );

  fastify.put(
    '/question-bank/:id',
    {
      schema: {
        description: 'Update a question',
        tags: ['question-bank'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            category: { type: 'string', minLength: 1 },
            question: { type: 'string', minLength: 1 },
            deprecated: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              category: { type: 'string' },
              question: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              deprecated: { type: 'boolean' },
            },
            required: ['id', 'category', 'question', 'createdAt', 'deprecated'],
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    controller.update.bind(controller)
  );

  fastify.delete(
    '/question-bank/:id',
    {
      schema: {
        description: 'Delete a question',
        tags: ['question-bank'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
          required: ['id'],
        },
        response: {
          204: {
            type: 'null',
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    controller.delete.bind(controller)
  );
}
