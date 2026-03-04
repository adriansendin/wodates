import { FastifyRequest, FastifyReply } from 'fastify';
import { RegisterSchema, LoginSchema } from '../../domain/entities/Auth';
import { DomainError } from '../../domain/errors/DomainError';
import { ZodError } from 'zod';
import { AuthService } from '../services/auth-service';
import { SystemUserService } from '../services/system-user-service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class AuthController {
  private readonly supabaseClient: SupabaseClient | null;

  constructor(
    private readonly authService: AuthService,
    private readonly systemUserService?: SystemUserService
  ) {
    // Initialize Supabase client for waitlist if credentials are available
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.supabaseClient = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );
    } else {
      this.supabaseClient = null;
    }
  }

  async register(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userData = RegisterSchema.parse(request.body);

      const user = await this.authService.registerUser(userData);
      const token = this.generateToken(user.id, user.email);

      // Create welcome match with Doc Love (blocking to ensure proper onboarding)
      if (this.systemUserService) {
        try {
          const matchResult = await this.systemUserService.createWelcomeMatch(
            user.id,
            userData.locale
          );
          if (matchResult.success) {
            request.log.info(
              { userId: user.id, matchId: matchResult.data.id },
              'Welcome match created with Doc Love'
            );
          } else {
            request.log.warn(
              { userId: user.id, error: matchResult.error },
              'Failed to create welcome match with Doc Love'
            );
          }
        } catch (error) {
          request.log.error(
            { userId: user.id, error },
            'Unexpected error creating welcome match'
          );
        }
      }

      return reply.status(201).send({
        user: this.buildResponseUser(user),
        token,
      });
    } catch (error) {
      if (error instanceof DomainError) {
        return this.handleError(reply, error);
      }

      if (error instanceof ZodError) {
        return this.handleValidationError(reply, error);
      }

      return this.handleUnexpectedError(reply, error);
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      request.log.info({ body: request.body }, 'Login request received');

      const { email, password } = LoginSchema.parse(request.body);

      request.log.info({ email }, 'Validating credentials');

      const user = await this.authService.validateCredentials(email, password);
      const token = this.generateToken(user.id, user.email);

      request.log.info(
        { userId: user.id, email: user.email },
        'Login successful'
      );

      return reply.send({
        user: this.buildResponseUser(user),
        token,
      });
    } catch (error) {
      if (error instanceof DomainError) {
        return this.handleError(reply, error);
      }

      if (error instanceof ZodError) {
        return this.handleValidationError(reply, error);
      }

      return this.handleUnexpectedError(reply, error);
    }
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    // In v0.1, we'll just return a new token
    // In production, implement proper refresh token logic
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'UNAUTHORIZED' });
    }

    const token = this.generateToken(user.id, user.email);
    return reply.send({ token });
  }

  async logout(_request: FastifyRequest, reply: FastifyReply) {
    // In v0.1, we don't need to do anything
    // In production, invalidate the token
    return reply.send({ message: 'Logged out successfully' });
  }

  async checkEmail(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { email } = request.body as { email: string };

      if (!email || typeof email !== 'string') {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Email is required',
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Invalid email format',
        });
      }

      const exists = await this.authService.checkEmailExists(email);

      return reply.send({
        exists,
        email,
      });
    } catch (error) {
      return this.handleUnexpectedError(reply, error);
    }
  }

  async joinWaitlist(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { city, email } = request.body as { city?: string; email?: string };

      if (!email || typeof email !== 'string') {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Email is required',
        });
      }

      if (!city || typeof city !== 'string' || city.trim() === '') {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'City is required',
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Invalid email format',
        });
      }

      // If Supabase is not configured, return success anyway (graceful degradation)
      if (!this.supabaseClient) {
        request.log.warn('Supabase not configured, waitlist entry not saved');
        return reply.send({
          message: 'Successfully joined waitlist',
        });
      }

      // Try to save to waitlist table (create if doesn't exist)
      // Using a simple table structure: waitlist (city, email, created_at)
      const { error } = await this.supabaseClient.from('waitlist').insert({
        city: city.trim(),
        email: email.trim(),
        created_at: new Date().toISOString(),
      });

      if (error) {
        // If table doesn't exist or other error, log but still return success
        request.log.warn(
          { error },
          'Failed to save waitlist entry to database'
        );
        // Still return success to user (graceful degradation)
      }

      return reply.send({
        message: 'Successfully joined waitlist',
      });
    } catch (error) {
      request.log.error({ error }, 'Unexpected error in joinWaitlist');
      // Return success anyway for better UX
      return reply.send({
        message: 'Successfully joined waitlist',
      });
    }
  }

  private generateToken(userId: string, email: string): string {
    // In v0.1, we'll create a simple token
    // In production, use proper JWT with secret
    const payload = {
      userId,
      email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    };

    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' })
    ).toString('base64');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64');

    return `${header}.${body}.signature`;
  }

  private handleError(reply: FastifyReply, error: DomainError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message,
      details: error.details,
    });
  }

  private handleValidationError(reply: FastifyReply, error: ZodError) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: error.flatten(),
    });
  }

  private handleUnexpectedError(reply: FastifyReply, error: unknown) {
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Unexpected error while processing request',
      details: error,
    });
  }

  private buildResponseUser(user: {
    id: string;
    email: string;
    name: string;
    gender?: string;
    birthDate?: string;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      gender: user.gender,
      birthDate: user.birthDate,
    };
  }
}
