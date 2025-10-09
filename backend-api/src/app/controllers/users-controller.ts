import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  DomainError,
  UnauthorizedError,
} from '../../domain/errors/DomainError';
import { LOOKING_FOR_VALUES } from '../../domain/entities/LookingFor';
import { GENDER_VALUES } from '../../domain/entities/User';
import {
  SupabaseUserService,
  UpdateUserProfileInput,
} from '../services/supabase-user-service';

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
    .nullable(),
);

const nullableString = (max: number) =>
  z.preprocess(
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
    z.string().min(1).max(max).nullable(),
  );

const nullableText = (max: number) =>
  z.preprocess(
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
    z.string().max(max).nullable(),
  );

const nullableEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
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
    z.enum(values).nullable(),
  );

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
    },
  );

export class UsersController {
  constructor(private readonly userService: SupabaseUserService) {}

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

      const payload = UpdateProfileSchema.parse(request.body ?? {});
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
      }
      if ('max_age' in payload) {
        updateInput.max_age = payload.max_age ?? null;
      }
      if ('bio' in payload) {
        updateInput.bio = payload.bio ?? null;
      }
      if ('city' in payload) {
        updateInput.city = payload.city ?? null;
      }

      const profile = await this.userService.updateProfile(
        authUser.id,
        updateInput,
      );
      return reply.send(profile);
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
