import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase client singleton instance
 * @returns {SupabaseClient} The Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    // Debug: verificar que las variables se carguen
    console.log('[SupabaseClient] SUPABASE_URL:', SUPABASE_URL);
    console.log(
      '[SupabaseClient] SUPABASE_ANON_KEY:',
      SUPABASE_ANON_KEY ? `EXISTE (${SUPABASE_ANON_KEY.length} chars)` : 'VACÍA'
    );

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        'Missing Supabase configuration. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables.'
      );
    }

    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    console.log('[SupabaseClient] Client created successfully');
  }

  return supabaseClient;
}
