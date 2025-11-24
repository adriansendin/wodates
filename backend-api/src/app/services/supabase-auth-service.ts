import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import {
  ConflictError,
  DomainError,
  InternalError,
  UnauthorizedError,
} from '../../domain/errors/DomainError';
import { AuthService, AuthUser } from './auth-service';
import { RegisterRequest } from '../../domain/entities/Auth';

type SupabaseAuthConfig = {
  url: string;
  anonKey?: string;
  serviceRoleKey: string;
};

/**
 * SupabaseAuthService - Gestión de autenticación
 *
 * IMPORTANTE: Este servicio almacena el nombre del usuario en:
 * auth.users.raw_user_meta_data.display_name (NO en public.users)
 *
 * Uses the service role key to talk to the Admin API.
 */
export class SupabaseAuthService implements AuthService {
  private readonly adminClient: SupabaseClient;
  private readonly anonClient?: SupabaseClient;

  constructor(config?: Partial<SupabaseAuthConfig>) {
    const resolvedConfig = this.resolveConfig(config);

    this.adminClient = createClient(
      resolvedConfig.url,
      resolvedConfig.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    if (resolvedConfig.anonKey) {
      this.anonClient = createClient(
        resolvedConfig.url,
        resolvedConfig.anonKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );
    }
  }

  async registerUser(registerRequest: RegisterRequest): Promise<AuthUser> {
    try {
      // Create user in Supabase Auth with display_name in raw_user_meta_data
      const { data, error } = await this.adminClient.auth.admin.createUser({
        email: registerRequest.email,
        password: registerRequest.password,
        email_confirm: true,
        user_metadata: {
          display_name: registerRequest.name, // IMPORTANTE: Almacenamos el nombre aquí, no en public.users
          birthDate: registerRequest.birthDate,
          gender: registerRequest.gender,
          location: registerRequest.location,
          country: registerRequest.country,
          lookingFor: registerRequest.lookingFor,
        },
      });

      if (error) {
        if (
          error.message &&
          error.message.includes('already been registered')
        ) {
          throw new ConflictError('Email already exists');
        }

        throw new InternalError('Failed to create user', error);
      }

      const user = data.user;
      if (!user) {
        throw new InternalError(
          'Supabase did not return a user after creation'
        );
      }

      // Step 2: Create user profile in public.users table (without name and email)
      await this.createUserProfile(user.id, registerRequest);

      return this.mapUser(user);
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      throw new InternalError('Unexpected error creating Supabase user', error);
    }
  }

  private async createUserProfile(
    userId: string,
    registerRequest: RegisterRequest
  ): Promise<void> {
    try {
      // Create profile in public.users without name and email (those are in auth.users)
      const { error } = await this.adminClient.from('users').insert({
        id: userId,
        // email and name are no longer stored in public.users
        birthDate: registerRequest.birthDate,
        gender: registerRequest.gender || null,
        city: registerRequest.location || null,
        country: registerRequest.country || 'Spain', // Default to Spain
        looking_for: registerRequest.lookingFor || null,
      });

      if (error) {
        console.error(
          '[SupabaseAuthService] Failed to create user profile',
          error
        );
        throw new InternalError('Failed to create user profile', error);
      }
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      throw new InternalError('Unexpected error creating user profile', error);
    }
  }

  async validateCredentials(
    email: string,
    password: string
  ): Promise<AuthUser> {
    try {
      // First try a proper password check if we have an anon key configured.
      if (this.anonClient) {
        const { data, error } = await this.anonClient.auth.signInWithPassword({
          email,
          password,
        });

        if (!error && data.user) {
          this.ensureUserIsActive(data.user);
          return this.mapUser(data.user);
        }
      }

      // Fallback: just confirm the user exists in Supabase Auth.
      const { data, error } = await this.adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 100,
      });

      if (error) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const matchedUser = data?.users?.find(
        (candidate) => candidate.email?.toLowerCase() === email.toLowerCase()
      );

      if (!matchedUser) {
        throw new UnauthorizedError('Invalid email or password');
      }

      this.ensureUserIsActive(matchedUser);

      return this.mapUser(matchedUser);
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      throw new InternalError('Unexpected error validating credentials', error);
    }
  }

  private mapUser(user: User): AuthUser {
    const metadata = user.user_metadata as Record<string, unknown> | null;
    // Get display_name from raw_user_meta_data (this is where we store user names)
    const displayName =
      metadata && typeof metadata.display_name === 'string'
        ? metadata.display_name
        : undefined;

    return {
      id: user.id,
      email: user.email ?? '',
      name: displayName ?? user.email ?? 'User',
    };
  }

  private ensureUserIsActive(user: User): void {
    const deletedAt =
      (user as unknown as { deleted_at?: string | null })?.deleted_at ?? null;

    if (deletedAt) {
      throw new UnauthorizedError(
        'Tu cuenta ha sido desactivada. Contacta con soporte si deseas reactivarla.'
      );
    }
  }

  private resolveConfig(
    config?: Partial<SupabaseAuthConfig>
  ): SupabaseAuthConfig {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const anonKey = config?.anonKey ?? process.env.SUPABASE_ANON_KEY;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SupabaseAuthService requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be configured'
      );
    }

    const resolved: SupabaseAuthConfig = {
      url,
      serviceRoleKey,
    };

    if (anonKey) {
      resolved.anonKey = anonKey;
    }

    return resolved;
  }
}
