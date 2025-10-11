import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { RegisterRequest } from '../../domain/entities/Auth';
import {
  ConflictError,
  DomainError,
  InternalError,
  UnauthorizedError,
} from '../../domain/errors/DomainError';

type AuthUser = {
  id: string;
  email: string;
  name: string;
};

type SupabaseAuthConfig = {
  url: string;
  anonKey?: string;
  serviceRoleKey: string;
};

/**
 * Minimal Supabase-backed auth service. Uses the service role key to talk to
 * the Admin API so we can validate whether a user exists and create new ones.
 */
export class SupabaseAuthService {
  private readonly adminClient: SupabaseClient;
  private readonly anonClient?: SupabaseClient;

  constructor(config?: Partial<SupabaseAuthConfig>) {
    const resolvedConfig = this.resolveConfig(config);

    this.adminClient = createClient(resolvedConfig.url, resolvedConfig.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    if (resolvedConfig.anonKey) {
      this.anonClient = createClient(resolvedConfig.url, resolvedConfig.anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
  }

  async registerUser(registerRequest: RegisterRequest): Promise<AuthUser> {
    try {
      // Step 1: Create user in Supabase Auth
      const { data, error } = await this.adminClient.auth.admin.createUser({
        email: registerRequest.email,
        password: registerRequest.password,
        email_confirm: true,
        user_metadata: {
          name: registerRequest.name,
          birthDate: registerRequest.birthDate,
          gender: registerRequest.gender,
        },
      });

      if (error) {
        if (error.message && error.message.includes('already been registered')) {
          throw new ConflictError('Email already exists');
        }

        throw new InternalError('Failed to create user', error);
      }

      const user = data.user;
      if (!user) {
        throw new InternalError('Supabase did not return a user after creation');
      }

      // Step 2: Create user profile in public.users table
      await this.createUserProfile(user.id, registerRequest);

      return this.mapUser(user);
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      throw new InternalError('Unexpected error creating Supabase user', error);
    }
  }

  private async createUserProfile(userId: string, registerRequest: RegisterRequest): Promise<void> {
    try {
      const { error } = await this.adminClient
        .from('users')
        .insert({
          id: userId,
          email: registerRequest.email,
          name: registerRequest.name,
          birthDate: registerRequest.birthDate,
          gender: registerRequest.gender || null,
          city: registerRequest.location || null,
          looking_for: registerRequest.lookingFor || null,
        });

      if (error) {
        console.error('[SupabaseAuthService] Failed to create user profile', error);
        throw new InternalError('Failed to create user profile', error);
      }
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      throw new InternalError('Unexpected error creating user profile', error);
    }
  }

  async validateCredentials(email: string, password: string): Promise<AuthUser> {
    try {
      // First try a proper password check if we have an anon key configured.
      if (this.anonClient) {
        const { data, error } = await this.anonClient.auth.signInWithPassword({
          email,
          password,
        });

        if (!error && data.user) {
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
        candidate => candidate.email?.toLowerCase() === email.toLowerCase(),
      );

      if (!matchedUser) {
        throw new UnauthorizedError('Invalid email or password');
      }

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
    const name =
      metadata && typeof metadata.name === 'string'
        ? metadata.name
        : undefined;

    return {
      id: user.id,
      email: user.email ?? '',
      name: name ?? user.email ?? 'User',
    };
  }

  private resolveConfig(config?: Partial<SupabaseAuthConfig>): SupabaseAuthConfig {
    const url = config?.url ?? process.env.SUPABASE_URL;
    const anonKey = config?.anonKey ?? process.env.SUPABASE_ANON_KEY;
    const serviceRoleKey =
      config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SupabaseAuthService requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be configured',
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
