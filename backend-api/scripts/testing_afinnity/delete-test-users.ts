/**
 * Script to delete test users from Supabase
 * 
 * This script deletes users from both auth.users and public.users tables
 * that match the pattern "testia" followed by numbers (e.g., testia1, testia2, testia11, etc.)
 * 
 * Usage:
 *   # Delete all test users (testia* pattern)
 *   npx tsx scripts/testing_afinnity/delete-test-users.ts
 * 
 *   # Delete a specific user by name
 *   npx tsx scripts/testing_afinnity/delete-test-users.ts testia1
 * 
 *   # Delete a specific user by ID
 *   npx tsx scripts/testing_afinnity/delete-test-users.ts --id <user-id>
 * 
 *      # Delete a specific user by email (deletes everything: messages, interactions, user, etc.)
   *   npx tsx scripts/testing_afinnity/delete-test-users.ts user@example.com
 * 
 * Environment variables required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  return { url, serviceRoleKey };
}

interface TestUser {
  id: string;
  email: string;
  displayName: string;
}

/**
 * Find a user by ID
 */
async function findUserById(
  client: SupabaseClient,
  userId: string,
): Promise<TestUser | null> {
  const { data, error } = await client.auth.admin.getUserById(userId);

  if (error || !data?.user) {
    return null;
  }

  const user = data.user;
  const metadata = user.user_metadata as Record<string, unknown> | null;
  const displayName =
    metadata && typeof metadata.display_name === 'string'
      ? metadata.display_name
      : null;

  return {
    id: user.id,
    email: user.email || '',
    displayName: displayName || user.email || 'Unknown',
  };
}

/**
 * Find a user by email
 */
async function findUserByEmail(
  client: SupabaseClient,
  email: string,
): Promise<TestUser | null> {
  // Use admin API to list users and find by email
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    if (!data || !data.users || data.users.length === 0) {
      break;
    }

    // Search for user with matching email
    for (const user of data.users) {
      if (user.email === email) {
        const metadata = user.user_metadata as Record<string, unknown> | null;
        const displayName =
          metadata && typeof metadata.display_name === 'string'
            ? metadata.display_name
            : null;

        return {
          id: user.id,
          email: user.email || '',
          displayName: displayName || user.email || 'Unknown',
        };
      }
    }

    // If we got fewer users than perPage, we're done
    if (data.users.length < perPage) {
      break;
    }

    page++;

    // Safety limit to avoid infinite loops
    if (page > 100) {
      console.warn('⚠️  Reached page limit (100), stopping pagination');
      break;
    }
  }

  return null;
}

/**
 * Find a user by display name
 */
async function findUserByName(
  client: SupabaseClient,
  name: string,
): Promise<TestUser | null> {
  // Use admin API to list users and find by name
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    if (!data || !data.users || data.users.length === 0) {
      break;
    }

    // Search for user with matching display_name
    for (const user of data.users) {
      const metadata = user.user_metadata as Record<string, unknown> | null;
      const displayName =
        metadata && typeof metadata.display_name === 'string'
          ? metadata.display_name
          : null;

      if (displayName === name) {
        return {
          id: user.id,
          email: user.email || '',
          displayName,
        };
      }
    }

    // If we got fewer users than perPage, we're done
    if (data.users.length < perPage) {
      break;
    }

    page++;

    // Safety limit to avoid infinite loops
    if (page > 100) {
      console.warn('⚠️  Reached page limit (100), stopping pagination');
      break;
    }
  }

  return null;
}

/**
 * Find all test users matching the pattern "testia" + numbers
 */
async function findTestUsers(client: SupabaseClient): Promise<TestUser[]> {
  const testUsers: TestUser[] = [];

  // Use admin API to list users (this requires pagination)
  let page = 1;
  const perPage = 1000; // Max per page

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    if (!data || !data.users || data.users.length === 0) {
      break;
    }

    // Filter users with display_name matching "testia" + numbers
    for (const user of data.users) {
      const metadata = user.user_metadata as Record<string, unknown> | null;
      const displayName =
        metadata && typeof metadata.display_name === 'string'
          ? metadata.display_name
          : null;

      // Check if display_name matches pattern "testia" followed by one or more digits
      if (displayName && /^testia\d+$/.test(displayName)) {
        testUsers.push({
          id: user.id,
          email: user.email || '',
          displayName,
        });
      }
    }

    // Check if there are more pages
    // If we got fewer users than perPage, we're done
    if (data.users.length < perPage) {
      break;
    }

    // Also check if there's pagination info in the response
    // Some versions of Supabase return total count or hasMore flag
    page++;

    // Safety limit to avoid infinite loops
    if (page > 100) {
      console.warn('⚠️  Reached page limit (100), stopping pagination');
      break;
    }
  }

  return testUsers;
}

/**
 * Deletes all user-related data before deleting the user
 * Order is important to avoid foreign key constraint violations
 */
async function deleteUserData(
  client: SupabaseClient,
  userId: string,
): Promise<{
  messagesDeleted: number;
  interactionsDeleted: number;
  blockedUsersDeleted: number;
  userAIProfileDeleted: boolean;
}> {
  let messagesDeleted = 0;
  let interactionsDeleted = 0;
  let blockedUsersDeleted = 0;
  let userAIProfileDeleted = false;

  // 1. Delete messages sent by the user
  // Note: messages.sender_id has ON DELETE SET NULL, but we delete explicitly
  // to avoid leaving orphaned messages
  const { count: messagesCount, error: messagesCountError } = await client
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('sender_id', userId);

  if (messagesCountError) {
    console.warn(
      `⚠️  Warning: Could not count messages: ${messagesCountError.message}`,
    );
  } else {
    const { error: messagesError } = await client
      .from('messages')
      .delete()
      .eq('sender_id', userId);

    if (messagesError) {
      console.warn(
        `⚠️  Warning: Could not delete messages: ${messagesError.message}`,
      );
    } else {
      messagesDeleted = messagesCount || 0;
    }
  }

  // 2. Delete interactions (likes/passes) where user is involved
  // interactions.from_user and to_user have ON DELETE SET NULL, but we delete explicitly
  // We need to delete where user is either from_user OR to_user
  // Using PostgREST OR syntax: field1.eq.value1,field2.eq.value2
  const { count: interactionsFromCount, error: interactionsFromCountError } =
    await client
      .from('interactions')
      .select('*', { count: 'exact', head: true })
      .or(`from_user.eq.${userId},to_user.eq.${userId}`);

  if (interactionsFromCountError) {
    console.warn(
      `⚠️  Warning: Could not count interactions: ${interactionsFromCountError.message}`,
    );
  } else {
    const { error: interactionsError } = await client
      .from('interactions')
      .delete()
      .or(`from_user.eq.${userId},to_user.eq.${userId}`);

    if (interactionsError) {
      console.warn(
        `⚠️  Warning: Could not delete interactions: ${interactionsError.message}`,
      );
    } else {
      interactionsDeleted = interactionsFromCount || 0;
    }
  }

  // 3. Delete blocked_users where user is blocker or blocked
  // blocked_users has ON DELETE CASCADE, but we delete explicitly for clarity
  const { count: blockedCount, error: blockedCountError } = await client
    .from('blocked_users')
    .select('*', { count: 'exact', head: true })
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

  if (blockedCountError) {
    console.warn(
      `⚠️  Warning: Could not count blocked users: ${blockedCountError.message}`,
    );
  } else {
    const { error: blockedError } = await client
      .from('blocked_users')
      .delete()
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

    if (blockedError) {
      console.warn(
        `⚠️  Warning: Could not delete blocked users: ${blockedError.message}`,
      );
    } else {
      blockedUsersDeleted = blockedCount || 0;
    }
  }

  // 4. Delete user_ai_profiles (summary, summary_embedding, etc.)
  // This includes summary_embedding column which contains vector embeddings
  const { error: aiProfileError } = await client
    .from('user_ai_profiles')
    .delete()
    .eq('user_id', userId);

  if (aiProfileError) {
    // If user doesn't have an AI profile, that's okay
    // Only log if it's not a "not found" type error
    if (!aiProfileError.message.includes('not found')) {
      console.warn(
        `⚠️  Warning: Could not delete user_ai_profiles: ${aiProfileError.message}`,
      );
    }
  } else {
    userAIProfileDeleted = true;
  }

  // Note: chat_participants will be automatically deleted via CASCADE
  // when the user is deleted from public.users

  return {
    messagesDeleted,
    interactionsDeleted,
    blockedUsersDeleted,
    userAIProfileDeleted,
  };
}

function isEmail(str: string): boolean {
  // Simple email validation: contains @ and has at least one character before and after
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

function parseArguments(): {
  mode: 'all' | 'byName' | 'byId' | 'byEmail';
  name?: string;
  id?: string;
  email?: string;
} {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    return { mode: 'all' };
  }

  // Check for --id flag
  const idIndex = args.indexOf('--id');
  if (idIndex !== -1 && args[idIndex + 1]) {
    return { mode: 'byId', id: args[idIndex + 1] };
  }

  // Check if first argument is an email
  if (isEmail(args[0])) {
    return { mode: 'byEmail', email: args[0] };
  }

  // Otherwise, treat first argument as name
  return { mode: 'byName', name: args[0] };
}

async function deleteTestUsers() {
  const { mode, name, id, email } = parseArguments();

  const config = getSupabaseConfig();
  const client = createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log('🗑️  Starting user deletion...\n');

    let testUsers: TestUser[] = [];

    // Find users based on mode
    if (mode === 'byEmail') {
      if (!email) {
        throw new Error('Email is required when using email mode');
      }
      console.log(`🔍 Searching for user by email: ${email}...`);
      const user = await findUserByEmail(client, email);
      if (!user) {
        console.log(`❌ User with email "${email}" not found.\n`);
        return;
      }
      testUsers = [user];
    } else if (mode === 'byId') {
      if (!id) {
        throw new Error('User ID is required when using --id flag');
      }
      console.log(`🔍 Searching for user by ID: ${id}...`);
      const user = await findUserById(client, id);
      if (!user) {
        console.log(`❌ User with ID "${id}" not found.\n`);
        return;
      }
      testUsers = [user];
    } else if (mode === 'byName') {
      if (!name) {
        throw new Error('User name is required');
      }
      console.log(`🔍 Searching for user by name: ${name}...`);
      const user = await findUserByName(client, name);
      if (!user) {
        console.log(`❌ User with name "${name}" not found.\n`);
        return;
      }
      testUsers = [user];
    } else {
      // mode === 'all'
      console.log('🔍 Searching for test users (pattern: testia + numbers)...');
      testUsers = await findTestUsers(client);
    }

    if (testUsers.length === 0) {
      console.log('✅ No users found to delete.\n');
      return;
    }

    console.log(`📋 Found ${testUsers.length} test user(s) to delete:\n`);
    testUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.displayName} (${user.email}) - ID: ${user.id}`);
    });
    console.log('');

    // Delete users
    const results: Array<{
      user: TestUser;
      success: boolean;
      error?: string;
    }> = [];

    for (let i = 0; i < testUsers.length; i++) {
      const user = testUsers[i];
      try {
        console.log(
          `Deleting user ${i + 1}/${testUsers.length}: ${user.displayName} (${user.email})...`,
        );

        // Step 1: Delete user-related data (messages, interactions, blocked users, AI profiles)
        console.log(`  📝 Cleaning up user data...`);
        const deletedData = await deleteUserData(client, user.id);
        
        const deletedItems: string[] = [];
        if (deletedData.messagesDeleted > 0) {
          deletedItems.push(`${deletedData.messagesDeleted} message(s)`);
        }
        if (deletedData.interactionsDeleted > 0) {
          deletedItems.push(`${deletedData.interactionsDeleted} interaction(s)`);
        }
        if (deletedData.blockedUsersDeleted > 0) {
          deletedItems.push(`${deletedData.blockedUsersDeleted} blocked user(s)`);
        }
        if (deletedData.userAIProfileDeleted) {
          deletedItems.push('AI profile (summary, summary_embedding, etc.)');
        }
        
        if (deletedItems.length > 0) {
          console.log(`  ✅ Deleted: ${deletedItems.join(', ')}`);
        } else {
          console.log(`  ℹ️  No related data found to delete`);
        }

        // Step 2: Delete from auth.users (this should cascade to public.users if foreign keys are set up)
        // The second parameter controls soft delete: false = hard delete, true = soft delete
        // We want hard delete to completely remove test users
        console.log(`  🗑️  Deleting from auth.users...`);
        const { error: authError } = await client.auth.admin.deleteUser(
          user.id,
          false, // Hard delete
        );

        if (authError) {
          throw new Error(`Auth deletion failed: ${authError.message}`);
        }

        // Step 3: Also explicitly delete from public.users (in case cascade doesn't work)
        // Note: chat_participants will be automatically deleted via CASCADE
        console.log(`  🗑️  Deleting from public.users...`);
        const { error: publicError } = await client
          .from('users')
          .delete()
          .eq('id', user.id);

        if (publicError) {
          // If user doesn't exist in public.users, that's okay
          // Only log if it's not a "not found" type error
          if (!publicError.message.includes('not found')) {
            console.warn(
              `  ⚠️  Warning: Could not delete from public.users: ${publicError.message}`,
            );
          }
        }

        console.log(`  ✅ Successfully deleted user: ${user.displayName}\n`);
        results.push({ user, success: true });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.error(
          `  ❌ Failed to delete user ${user.displayName}: ${errorMessage}\n`,
        );
        results.push({ user, success: false, error: errorMessage });
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log('='.repeat(50));
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`✅ Successfully deleted: ${successful}/${testUsers.length}`);
    if (failed > 0) {
      console.log(`❌ Failed: ${failed}/${testUsers.length}`);
      console.log('\nFailed deletions:');
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(
            `  - ${r.user.displayName} (${r.user.email}): ${r.error}`,
          );
        });
    }

    console.log('\n✨ Done!');
  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  }
}

// Run the script
deleteTestUsers().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


