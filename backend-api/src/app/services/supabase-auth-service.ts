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
      // VALIDACIÓN ESTRICTA: Verificar que gender y lookingFor sean valores válidos (REQUERIDOS)
      // Validar que gender sea un string válido y no esté vacío
      if (!registerRequest.gender || typeof registerRequest.gender !== 'string' || registerRequest.gender.trim() === '') {
        console.error('[SupabaseAuthService] Invalid gender:', registerRequest.gender);
        throw new InternalError('Gender is required and must be a valid non-empty string');
      }

      // Validar que lookingFor sea un string válido y no esté vacío
      if (!registerRequest.lookingFor || typeof registerRequest.lookingFor !== 'string' || registerRequest.lookingFor.trim() === '') {
        console.error('[SupabaseAuthService] Invalid lookingFor:', registerRequest.lookingFor);
        throw new InternalError('LookingFor is required and must be a valid non-empty string');
      }

      // Validar que location sea un string válido y no esté vacío
      if (!registerRequest.location || typeof registerRequest.location !== 'string' || registerRequest.location.trim() === '') {
        console.error('[SupabaseAuthService] Invalid location:', registerRequest.location);
        throw new InternalError('Location is required and must be a valid non-empty string');
      }

      // Validar formato de birthDate
      if (!registerRequest.birthDate || typeof registerRequest.birthDate !== 'string') {
        throw new InternalError('birthDate is required and must be a valid ISO datetime string');
      }
      
      // Validar que birthDate sea una fecha válida
      const birthDateObj = new Date(registerRequest.birthDate);
      if (isNaN(birthDateObj.getTime())) {
        throw new InternalError('birthDate must be a valid ISO datetime string');
      }

      // Preparar valores validados (asegurar que son strings válidos)
      const validatedGender = registerRequest.gender.trim();
      const validatedLookingFor = registerRequest.lookingFor.trim();
      const validatedCity = registerRequest.location.trim();
      const validatedBirthDate = registerRequest.birthDate;

      // Log para debugging
      console.log('[SupabaseAuthService] Creating user profile with validated data:', {
        userId,
        birthDate: validatedBirthDate,
        gender: validatedGender,
        city: validatedCity,
        looking_for: validatedLookingFor,
      });

      // Create profile in public.users without name and email (those are in auth.users)
      // Explicitly set show_bio_in_feed to true (boolean, not null)
      // gender, looking_for, city y birthDate son REQUERIDOS - usar valores validados
      const { data, error } = await this.adminClient
        .from('users')
        .insert({
          id: userId,
          // email and name are no longer stored in public.users
          birthDate: validatedBirthDate, // REQUERIDO - ya validado arriba (ISO datetime string)
          gender: validatedGender, // REQUERIDO - ya validado arriba (string no vacío)
          city: validatedCity, // REQUERIDO - ya validado arriba (string no vacío)
          country: registerRequest.country || 'Spain', // Default to Spain
          looking_for: validatedLookingFor, // REQUERIDO - ya validado arriba (string no vacío)
          show_bio_in_feed: true, // New users should show bio in feed by default
        })
        .select('id, birthDate, gender, city, looking_for, show_bio_in_feed')
        .single();

      if (error) {
        console.error(
          '[SupabaseAuthService] Failed to create user profile',
          {
            error: error.message,
            details: error.details,
            hint: error.hint,
            userId,
            attemptedData: {
              birthDate: validatedBirthDate,
              gender: validatedGender,
              city: validatedCity,
              looking_for: validatedLookingFor,
            }
          }
        );
        throw new InternalError('Failed to create user profile', error);
      }

      // Verificar que los datos se guardaron correctamente
      if (data) {
        console.log('[SupabaseAuthService] User profile created successfully:', {
          userId,
          savedData: {
            birthDate: data.birthDate,
            gender: data.gender,
            city: data.city,
            looking_for: data.looking_for,
          }
        });

        // Verificar que los campos requeridos no sean NULL
        if (!data.birthDate || !data.gender || !data.city || !data.looking_for) {
          console.error('[SupabaseAuthService] WARNING: Some required fields are NULL after insert:', {
            userId,
            birthDate: data.birthDate,
            gender: data.gender,
            city: data.city,
            looking_for: data.looking_for,
          });
        }
      }

      // Verify that show_bio_in_feed was set correctly (should be true, not null)
      if (data && data.show_bio_in_feed !== true) {
        console.warn(
          `[SupabaseAuthService] show_bio_in_feed was not set correctly for user ${userId}. Expected true, got: ${data.show_bio_in_feed}. Attempting to fix...`
        );
        // Attempt to fix by updating the field explicitly
        const { error: updateError } = await this.adminClient
          .from('users')
          .update({ show_bio_in_feed: true })
          .eq('id', userId);

        if (updateError) {
          console.error(
            `[SupabaseAuthService] Failed to fix show_bio_in_feed for user ${userId}`,
            updateError
          );
          // Don't throw here, as the user was created successfully
          // The migration script will fix this later
        }
      }
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      throw new InternalError('Unexpected error creating user profile', error);
    }
  }

  async checkEmailExists(email: string): Promise<boolean> {
    try {
      // Use admin API to list users and check if email exists
      // Note: This may be slow with many users, but Supabase Admin API
      // doesn't provide a direct method to check by email
      const normalizedEmail = email.toLowerCase().trim();
      let page = 1;
      const perPage = 1000;

      // Paginate through all users until we find the email or run out of users
      while (true) {
        const { data, error } = await this.adminClient.auth.admin.listUsers({
          page,
          perPage,
        });

        if (error) {
          console.error(
            `[SupabaseAuthService] Error checking email (page ${page}):`,
            error
          );
          // If we can't check, assume it doesn't exist to allow registration attempt
          return false;
        }

        const users = data.users || [];

        // Check if any user has this email (case-insensitive)
        const userExists = users.some(
          (user) => user.email?.toLowerCase().trim() === normalizedEmail
        );

        if (userExists) {
          return true;
        }

        // If we got fewer users than perPage, we've reached the end
        if (users.length < perPage) {
          break;
        }

        // Move to next page
        page++;
      }

      return false;
    } catch (error) {
      console.error('[SupabaseAuthService] Unexpected error checking email:', error);
      // If we can't check, assume it doesn't exist to allow registration attempt
      return false;
    }
  }

  async validateCredentials(
    email: string,
    password: string
  ): Promise<AuthUser> {
    try {
      // We MUST use signInWithPassword to properly validate the password
      // The Admin API cannot validate passwords, so we require anonClient
      if (!this.anonClient) {
        throw new InternalError(
          'Authentication service is not properly configured. SUPABASE_ANON_KEY is required to validate passwords.'
        );
      }

      // Use signInWithPassword to properly validate email and password
      const { data, error } = await this.anonClient.auth.signInWithPassword({
        email,
        password,
      });

      // If signInWithPassword fails, the credentials are invalid
      if (error || !data.user) {
        // Log the error for debugging but don't expose details to user
        console.warn(
          '[SupabaseAuthService] signInWithPassword failed:',
          error?.message || error?.code || 'Unknown error'
        );
        throw new UnauthorizedError('Invalid email or password');
      }

      // Credentials are valid, ensure user is active
      this.ensureUserIsActive(data.user);
      return this.mapUser(data.user);
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

    // Extract gender and birthDate from user_metadata (they are stored there during registration)
    const gender =
      metadata && typeof metadata.gender === 'string'
        ? metadata.gender
        : undefined;
    const birthDate =
      metadata && typeof metadata.birthDate === 'string'
        ? metadata.birthDate
        : undefined;

    return {
      id: user.id,
      email: user.email ?? '',
      name: displayName ?? user.email ?? 'User',
      gender,
      birthDate,
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
