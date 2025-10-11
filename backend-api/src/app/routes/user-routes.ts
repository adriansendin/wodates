import { FastifyInstance } from 'fastify';
import { UsersController } from '../controllers/users-controller';
import { SupabaseUserService } from '../services/supabase-user-service';
import { LOOKING_FOR_VALUES } from '../../domain/entities/LookingFor';
import { GENDER_VALUES } from '../../domain/entities/User';

declare module 'fastify' {
  interface FastifyInstance {
    authMiddleware: any;
  }
}

export async function userRoutes(fastify: FastifyInstance) {
  const userService = new SupabaseUserService();
  const controller = new UsersController(userService);
  const genderEnum = [...GENDER_VALUES, null];
  const lookingForEnum = [...LOOKING_FOR_VALUES, null];

  fastify.get(
    '/users/me',
    {
      schema: {
        description: 'Get the authenticated user profile',
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              email: { type: 'string', format: 'email' },
              birthDate: { type: ['string', 'null'], format: 'date' },
              gender: { type: ['string', 'null'], enum: genderEnum },
              looking_for: { type: ['string', 'null'], enum: lookingForEnum },
              min_age: { type: ['number', 'null'] },
              max_age: { type: ['number', 'null'] },
              bio: { type: ['string', 'null'] },
              city: { type: ['string', 'null'] },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    controller.getProfile.bind(controller),
  );

  fastify.put(
    '/users/me',
    {
      schema: {
        description: 'Update the authenticated user profile',
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            birthDate: { type: ['string', 'null'], format: 'date' },
            gender: { type: ['string', 'null'], enum: genderEnum },
            looking_for: { type: ['string', 'null'], enum: lookingForEnum },
            min_age: { type: ['number', 'null'] },
            max_age: { type: ['number', 'null'] },
            bio: { type: ['string', 'null'] },
            city: { type: ['string', 'null'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              birthDate: { type: ['string', 'null'], format: 'date' },
              gender: { type: ['string', 'null'], enum: genderEnum },
              looking_for: { type: ['string', 'null'], enum: lookingForEnum },
              min_age: { type: ['number', 'null'] },
              max_age: { type: ['number', 'null'] },
              bio: { type: ['string', 'null'] },
              city: { type: ['string', 'null'] },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    controller.updateProfile.bind(controller),
  );
}
