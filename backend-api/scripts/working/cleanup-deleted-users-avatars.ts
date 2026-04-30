/**
 * Limpia fotos del bucket "avatars" únicamente para usuarios soft-deleted.
 *
 * Criterio de borrado (estricto):
 * - auth.users.deleted_at IS NOT NULL
 *
 * Flujo:
 * 1) Lee usuarios desde Auth Admin API y se queda SOLO con deleted_at != null
 * 2) Busca sus storage_path en public.user_photos
 * 3) Borra archivos en Storage bucket "avatars"
 * 4) (Opcional) borra filas de public.user_photos
 *
 * Uso:
 *   DRY_RUN=1 npx tsx scripts/working/cleanup-deleted-users-avatars.ts
 *   npx tsx scripts/working/cleanup-deleted-users-avatars.ts
 *   DELETE_DB_ROWS=1 npx tsx scripts/working/cleanup-deleted-users-avatars.ts
 */

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type MinimalAuthUser = {
  id: string;
  deleted_at?: string | null;
};

type UserPhotoRow = {
  id: string;
  user_id: string;
  storage_path: string;
};

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

const BUCKET = 'avatars';
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const DELETE_DB_ROWS =
  process.env.DELETE_DB_ROWS === '1' || process.env.DELETE_DB_ROWS === 'true';
const STORAGE_DELETE_CHUNK_SIZE = 100;
const FILTER_CHUNK_SIZE = 200;
const DB_DELETE_CHUNK_SIZE = 500;

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return { url, serviceRoleKey };
}

function createAdminClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Devuelve SOLO los IDs de usuarios soft-deleted en Auth:
 * auth.users.deleted_at IS NOT NULL
 */
async function getSoftDeletedAuthUserIds(
  client: SupabaseClient
): Promise<string[]> {
  const deletedUserIds: string[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(`Failed to list auth users on page ${page}: ${error.message}`);
    }

    const users = (data.users ?? []) as MinimalAuthUser[];

    for (const user of users) {
      if (user.deleted_at) {
        deletedUserIds.push(user.id);
      }
    }

    if (users.length < perPage) {
      break;
    }
    page += 1;
  }

  return deletedUserIds;
}

async function getPhotosByUserIds(
  client: SupabaseClient,
  userIds: string[]
): Promise<UserPhotoRow[]> {
  if (userIds.length === 0) return [];

  const rows: UserPhotoRow[] = [];
  const userIdChunks = chunkArray(userIds, FILTER_CHUNK_SIZE);

  for (const idsChunk of userIdChunks) {
    const { data, error } = await client
      .from('user_photos')
      .select('id, user_id, storage_path')
      .in('user_id', idsChunk);

    if (error) {
      throw new Error(`Failed to query user_photos: ${error.message}`);
    }

    rows.push(...((data ?? []) as UserPhotoRow[]));
  }

  return rows.filter((row) => typeof row.storage_path === 'string' && row.storage_path.trim() !== '');
}

async function deleteStoragePaths(
  client: SupabaseClient,
  storagePaths: string[]
): Promise<void> {
  const chunks = chunkArray(storagePaths, STORAGE_DELETE_CHUNK_SIZE);

  for (const pathChunk of chunks) {
    const { error } = await client.storage.from(BUCKET).remove(pathChunk);
    if (error) {
      console.error('[cleanup-deleted-users-avatars] Storage delete error:', {
        message: error.message,
        paths: pathChunk,
      });
    }
  }
}

async function deletePhotoRows(
  client: SupabaseClient,
  photoRows: UserPhotoRow[]
): Promise<void> {
  const photoIds = photoRows.map((row) => row.id);
  const chunks = chunkArray(photoIds, DB_DELETE_CHUNK_SIZE);

  for (const idChunk of chunks) {
    const { error } = await client.from('user_photos').delete().in('id', idChunk);
    if (error) {
      console.error('[cleanup-deleted-users-avatars] DB delete error:', {
        message: error.message,
        ids: idChunk,
      });
    }
  }
}

async function main() {
  const config = getSupabaseConfig();
  const client = createAdminClient(config);

  console.log(
    '\n[cleanup-deleted-users-avatars] Searching users with auth.users.deleted_at IS NOT NULL...\n'
  );
  const deletedUserIds = await getSoftDeletedAuthUserIds(client);
  console.log(
    `[cleanup-deleted-users-avatars] Soft-deleted auth users found: ${deletedUserIds.length}`
  );

  if (deletedUserIds.length === 0) {
    console.log('[cleanup-deleted-users-avatars] Nothing to clean.');
    return;
  }

  console.log('[cleanup-deleted-users-avatars] Fetching photo rows from public.user_photos...');
  const photoRows = await getPhotosByUserIds(client, deletedUserIds);

  const uniqueStoragePaths = Array.from(
    new Set(photoRows.map((row) => row.storage_path))
  );

  console.log(`[cleanup-deleted-users-avatars] Photo rows matched: ${photoRows.length}`);
  console.log(
    `[cleanup-deleted-users-avatars] Unique storage files to delete from bucket "${BUCKET}": ${uniqueStoragePaths.length}`
  );

  if (uniqueStoragePaths.length === 0) {
    console.log('[cleanup-deleted-users-avatars] No files found for deleted users.');
    return;
  }

  if (DRY_RUN) {
    console.log('\n[cleanup-deleted-users-avatars] DRY_RUN=1 => no deletion performed.');
    console.log('[cleanup-deleted-users-avatars] Files that would be removed:');
    uniqueStoragePaths.forEach((path) => console.log(`  - ${path}`));
    console.log('');
    return;
  }

  await deleteStoragePaths(client, uniqueStoragePaths);

  if (DELETE_DB_ROWS) {
    await deletePhotoRows(client, photoRows);
  }

  console.log('\n[cleanup-deleted-users-avatars] Finished.');
  console.log(`- Deleted storage files attempted: ${uniqueStoragePaths.length}`);
  console.log(`- Deleted DB rows attempted: ${DELETE_DB_ROWS ? photoRows.length : 0}`);
  console.log('');
}

main().catch((error) => {
  console.error('[cleanup-deleted-users-avatars] Fatal error:', error);
  process.exit(1);
});
