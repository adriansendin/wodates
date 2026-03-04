import { FastifyInstance } from 'fastify';
import { UsersController } from '../controllers/users-controller';
import { SupabaseUserService } from '../services/supabase-user-service';
import { LOOKING_FOR_VALUES } from '../../domain/entities/LookingFor';
import { GENDER_VALUES } from '../../domain/entities/User';
import {
  WANTS_CHILDREN_VALUES,
  CARES_ABOUT_PARTNER_CHILDREN_VALUES,
} from '../../domain/entities/FamilyPlan';
import {
  SMOKING_VALUES,
  CARES_ABOUT_PARTNER_SMOKING_VALUES,
} from '../../domain/entities/Habits';

declare module 'fastify' {
  interface FastifyInstance {
    authMiddleware: any;
    generateUserProfile?: any;
    processUserProfileService?: any;
  }
}

export async function userRoutes(fastify: FastifyInstance) {
  const userService = new SupabaseUserService();
  const controller = new UsersController(
    userService,
    fastify.processUserProfileService ?? fastify.generateUserProfile
  );
  const genderEnum = [...GENDER_VALUES, null];
  const lookingForEnum = [...LOOKING_FOR_VALUES, null];
  const wantsChildrenEnum = [...WANTS_CHILDREN_VALUES, null];
  const caresAboutPartnerChildrenEnum = [
    ...CARES_ABOUT_PARTNER_CHILDREN_VALUES,
    null,
  ];
  const smokingEnum = [...SMOKING_VALUES, null];
  const caresAboutPartnerSmokingEnum = [
    ...CARES_ABOUT_PARTNER_SMOKING_VALUES,
    null,
  ];

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
              show_bio_in_feed: { type: ['boolean', 'null'] },
              verification_status: {
                type: 'string',
                enum: ['none', 'pending', 'verified', 'rejected'],
              },
              has_children: { type: ['boolean', 'null'] },
              wants_children: {
                type: ['string', 'null'],
                enum: wantsChildrenEnum,
              },
              cares_about_partner_children: {
                type: ['string', 'null'],
                enum: caresAboutPartnerChildrenEnum,
              },
              smoking: { type: ['string', 'null'], enum: smokingEnum },
              cares_about_partner_smoking: {
                type: ['string', 'null'],
                enum: caresAboutPartnerSmokingEnum,
              },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    controller.getProfile.bind(controller)
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
            name: { type: ['string', 'null'], maxLength: 100 },
            birthDate: { type: ['string', 'null'], format: 'date' },
            gender: { type: ['string', 'null'], enum: genderEnum },
            looking_for: { type: ['string', 'null'], enum: lookingForEnum },
            min_age: { type: ['number', 'null'] },
            max_age: { type: ['number', 'null'] },
            bio: { type: ['string', 'null'] },
            city: { type: ['string', 'null'] },
            show_bio_in_feed: { type: ['boolean', 'null'] },
            has_children: { type: ['boolean', 'null'] },
            wants_children: {
              type: ['string', 'null'],
              enum: wantsChildrenEnum,
            },
            cares_about_partner_children: {
              type: ['string', 'null'],
              enum: caresAboutPartnerChildrenEnum,
            },
            smoking: { type: ['string', 'null'], enum: smokingEnum },
            cares_about_partner_smoking: {
              type: ['string', 'null'],
              enum: caresAboutPartnerSmokingEnum,
            },
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
              show_bio_in_feed: { type: ['boolean', 'null'] },
              verification_status: {
                type: 'string',
                enum: ['none', 'pending', 'verified', 'rejected'],
              },
              has_children: { type: ['boolean', 'null'] },
              wants_children: {
                type: ['string', 'null'],
                enum: wantsChildrenEnum,
              },
              cares_about_partner_children: {
                type: ['string', 'null'],
                enum: caresAboutPartnerChildrenEnum,
              },
              smoking: { type: ['string', 'null'], enum: smokingEnum },
              cares_about_partner_smoking: {
                type: ['string', 'null'],
                enum: caresAboutPartnerSmokingEnum,
              },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    controller.updateProfile.bind(controller)
  );

  fastify.post(
    '/users/me/deactivate',
    {
      schema: {
        description: 'Soft delete the authenticated user account',
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
            required: ['message'],
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    controller.deactivateAccount.bind(controller)
  );

  fastify.post(
    '/users/me/generate-profile',
    {
      schema: {
        description:
          'Generate or update user AI profile from unprocessed chats',
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              message: { type: 'string' },
            },
            required: ['summary', 'message'],
          },
          503: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    controller.generateProfile.bind(controller)
  );
}
