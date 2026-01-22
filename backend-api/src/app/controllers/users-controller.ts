import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  DomainError,
  UnauthorizedError,
} from '../../domain/errors/DomainError';
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
import {
  SupabaseUserService,
  UpdateUserProfileInput,
} from '../services/supabase-user-service';
import { GenerateUserProfileFromChats } from '../../domain/use-cases/chat/GenerateUserProfileFromChats';

const dateSchema = z.preprocess(
  (value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        return null;
      }
      return trimmed;
    }
    return value;
  },
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'birthDate must use format YYYY-MM-DD')
    .nullable()
);

const nullableString = (max: number) =>
  z.preprocess((value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        return null;
      }
      return trimmed;
    }
    return value;
  }, z.string().min(1).max(max).nullable());

const nullableText = (max: number) =>
  z.preprocess((value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        return null;
      }
      return trimmed;
    }
    return value;
  }, z.string().max(max).nullable());

const nullableEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        return null;
      }
      return trimmed;
    }
    return value;
  }, z.enum(values).nullable());

const nullableInt = (min: number, max: number) =>
  z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        return null;
      }

      const parsed = Number.parseInt(trimmed, 10);
      if (Number.isNaN(parsed)) {
        return value;
      }
      return parsed;
    }

    return value;
  }, z.number().int().min(min).max(max).nullable());

const UpdateProfileSchema = z
  .object({
    birthDate: dateSchema.optional(),
    gender: nullableEnum(GENDER_VALUES).optional(),
    looking_for: nullableEnum(LOOKING_FOR_VALUES).optional(),
    min_age: nullableInt(18, 100).optional(),
    max_age: nullableInt(18, 100).optional(),
    bio: nullableText(500).optional(),
    city: nullableString(100).optional(),
    avatarUrl: nullableString(500).optional(),
    show_bio_in_feed: z.boolean().optional(),
    // Family plan
    has_children: z.boolean().nullable().optional(),
    wants_children: nullableEnum(WANTS_CHILDREN_VALUES).optional(),
    cares_about_partner_children: nullableEnum(
      CARES_ABOUT_PARTNER_CHILDREN_VALUES
    ).optional(),
    // Habits
    smoking: nullableEnum(SMOKING_VALUES).optional(),
    cares_about_partner_smoking: nullableEnum(
      CARES_ABOUT_PARTNER_SMOKING_VALUES
    ).optional(),
  })
  .refine(
    (data) => {
      if (
        data.min_age !== null &&
        data.min_age !== undefined &&
        data.max_age !== null &&
        data.max_age !== undefined
      ) {
        return data.min_age <= data.max_age;
      }
      return true;
    },
    {
      message: 'min_age must be less than or equal to max_age',
      path: ['min_age'],
    }
  );

export class UsersController {
  constructor(
    private readonly userService: SupabaseUserService,
    private generateUserProfileUseCase?: GenerateUserProfileFromChats
  ) {}

  async getProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user;
      if (!authUser) {
        throw new UnauthorizedError('Missing authenticated user');
      }

      const profile = await this.userService.getProfile(authUser.id);
      return reply.send(profile);
    } catch (error) {
      return this.handleError(reply, error);
    }
  }

  async updateProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user;
      if (!authUser) {
        throw new UnauthorizedError('Missing authenticated user');
      }

      console.log('[UsersController] ===== UPDATE PROFILE REQUEST =====');
      console.log('[UsersController] Raw request body:', request.body);
      console.log('[UsersController] Request body type:', typeof request.body);
      console.log(
        '[UsersController] Request body keys:',
        request.body && typeof request.body === 'object'
          ? Object.keys(request.body)
          : []
      );

      const payload = UpdateProfileSchema.parse(request.body ?? {});

      console.log('[UsersController] Parsed payload:', payload);
      console.log('[UsersController] Payload keys:', Object.keys(payload));
      console.log('[UsersController] ===================================');

      const updateInput: UpdateUserProfileInput = {};

      if ('birthDate' in payload) {
        updateInput.birthDate = payload.birthDate ?? null;
      }
      if ('gender' in payload) {
        updateInput.gender = payload.gender ?? null;
      }
      if ('looking_for' in payload) {
        updateInput.looking_for = payload.looking_for ?? null;
      }
      if ('min_age' in payload) {
        updateInput.min_age = payload.min_age ?? null;
        console.log(
          '[UsersController] Processing min_age:',
          payload.min_age,
          '->',
          updateInput.min_age
        );
      } else {
        console.log('[UsersController] min_age NOT in payload');
      }
      if ('max_age' in payload) {
        updateInput.max_age = payload.max_age ?? null;
        console.log(
          '[UsersController] Processing max_age:',
          payload.max_age,
          '->',
          updateInput.max_age
        );
      } else {
        console.log('[UsersController] max_age NOT in payload');
      }
      if ('bio' in payload) {
        updateInput.bio = payload.bio ?? null;
      }
      if ('city' in payload) {
        updateInput.city = payload.city ?? null;
      }
      if ('avatarUrl' in payload) {
        updateInput.avatarUrl = payload.avatarUrl ?? null;
      }
      if ('show_bio_in_feed' in payload) {
        updateInput.show_bio_in_feed = payload.show_bio_in_feed ?? null;
      }
      // Family plan
      if ('has_children' in payload) {
        updateInput.has_children = payload.has_children ?? null;
        console.log(
          '[UsersController] Processing has_children:',
          payload.has_children,
          '->',
          updateInput.has_children
        );
      } else {
        console.log('[UsersController] has_children NOT in payload');
      }
      if ('wants_children' in payload) {
        updateInput.wants_children = payload.wants_children ?? null;
        console.log(
          '[UsersController] Processing wants_children:',
          payload.wants_children,
          '->',
          updateInput.wants_children
        );
      } else {
        console.log('[UsersController] wants_children NOT in payload');
      }
      if ('cares_about_partner_children' in payload) {
        updateInput.cares_about_partner_children =
          payload.cares_about_partner_children ?? null;
        console.log(
          '[UsersController] Processing cares_about_partner_children:',
          payload.cares_about_partner_children,
          '->',
          updateInput.cares_about_partner_children
        );
      } else {
        console.log(
          '[UsersController] cares_about_partner_children NOT in payload'
        );
      }
      // Habits
      if ('smoking' in payload) {
        updateInput.smoking = payload.smoking ?? null;
        console.log(
          '[UsersController] Processing smoking:',
          payload.smoking,
          '->',
          updateInput.smoking
        );
      } else {
        console.log('[UsersController] smoking NOT in payload');
      }
      if ('cares_about_partner_smoking' in payload) {
        updateInput.cares_about_partner_smoking =
          payload.cares_about_partner_smoking ?? null;
        console.log(
          '[UsersController] Processing cares_about_partner_smoking:',
          payload.cares_about_partner_smoking,
          '->',
          updateInput.cares_about_partner_smoking
        );
      } else {
        console.log(
          '[UsersController] cares_about_partner_smoking NOT in payload'
        );
      }

      console.log('[UsersController] Final updateInput:', updateInput);
      console.log(
        '[UsersController] updateInput keys:',
        Object.keys(updateInput)
      );

      const profile = await this.userService.updateProfile(
        authUser.id,
        updateInput
      );
      return reply.send(profile);
    } catch (error) {
      return this.handleError(reply, error);
    }
  }

  async deactivateAccount(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user;
      if (!authUser) {
        throw new UnauthorizedError('Missing authenticated user');
      }

      await this.userService.deactivateAccount(authUser.id);

      return reply.send({
        message: 'Cuenta desactivada correctamente',
      });
    } catch (error) {
      return this.handleError(reply, error);
    }
  }

  async generateProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      request.log.info("[generate-profile] START", { userId: request.user.id });
      const authUser = request.user;
      if (!authUser) {
        throw new UnauthorizedError('Missing authenticated user');
      }

      if (!this.generateUserProfileUseCase) {
        return reply.status(503).send({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Profile generation service is not available',
        });
      }

      request.log.info(
        { userId: authUser.id },
        'Generating user profile from chats'
      );

      const result = await this.generateUserProfileUseCase.execute(authUser.id);

      if (!result.success) {
        return this.handleError(reply, result.error);
      }

      return reply.send({
        summary: result.data,
        message: 'Profile generated successfully',
      });
    } catch (error) {
      return this.handleError(reply, error);
    }
  }

  private handleError(reply: FastifyReply, error: unknown) {
    if (error instanceof DomainError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
        details: error.details,
      });
    }

    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Unexpected error processing request',
      details: error instanceof Error ? error.message : error,
    });
  }
}
