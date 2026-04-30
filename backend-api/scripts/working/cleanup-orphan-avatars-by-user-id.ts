/**
 * Limpia archivos huérfanos del bucket "avatars".
 *
 * Regla de conservación:
 * - Se conserva un archivo si su carpeta raíz (primer segmento del path)
 *   corresponde a un user_id existente en auth.users O en public.users.
 *
 * Regla de borrado:
 * - Se borra cualquier archivo del bucket "avatars" cuyo primer segmento
 *   no corresponda a un user_id existente en ninguna de esas dos tablas.
 *
 * Seguridad:
 * - DRY_RUN=1 -> no borra, solo muestra lo que borraría.
 *
 * Nota sobre "carpetas vacías":
 * - En Supabase Storage las carpetas son virtuales (derivadas del path).
 * - No hay una operación real de "delete folder" separada del delete de archivos.
 * - Al borrar archivos, las carpetas vacías desaparecen automáticamente del listado.
 *
 * Uso:
 *   DRY_RUN=1 npx tsx scripts/working/cleanup-orphan-avatars-by-user-id.ts
 *   npx tsx scripts/working/cleanup-orphan-avatars-by-user-id.ts
 */

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type MinimalAuthUser = {
  id: string;
};

type PublicUserRow = {
  id: string;
};

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type StorageEntry = {
  name: string;
  id?: string | null;
};

const BUCKET = 'avatars';
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const LIST_LIMIT = 1000;
const REMOVE_CHUNK_SIZE = 100;

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

async function getAuthUserIds(client: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to list auth users on page ${page}: ${error.message}`);
    }

    const users = (data.users ?? []) as MinimalAuthUser[];
    users.forEach((u) => ids.add(u.id));

    if (users.length < perPage) break;
    page += 1;
  }

  return ids;
}

async function getPublicUserIds(client: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await client
      .from('users')
      .select('id')
      .range(from, to);

    if (error) {
      throw new Error(`Failed to list public.users from ${from} to ${to}: ${error.message}`);
    }

    const rows = (data ?? []) as PublicUserRow[];
    rows.forEach((row) => ids.add(row.id));

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return ids;
}

function joinPath(parent: string, child: string): string {
  if (!parent) return child;
  return `${parent}/${child}`;
}

/**
 * Recorre el bucket de forma recursiva y devuelve paths completos de archivos.
 * En Storage API:
 * - archivo => suele traer "id"
 * - carpeta => suele venir sin "id" (o null)
 */
async function listAllFilePathsInBucket(
  client: SupabaseClient,
  currentPath = ''
): Promise<string[]> {
  const collected: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client.storage.from(BUCKET).list(currentPath, {
      limit: LIST_LIMIT,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
      throw new Error(
        `Failed to list bucket "${BUCKET}" at path "${currentPath}": ${error.message}`
      );
    }

    const entries = (data ?? []) as StorageEntry[];

    for (const entry of entries) {
      const fullPath = joinPath(currentPath, entry.name);
      const isFile = !!entry.id;

      if (isFile) {
        collected.push(fullPath);
      } else {
        const childFiles = await listAllFilePathsInBucket(client, fullPath);
        collected.push(...childFiles);
      }
    }

    if (entries.length < LIST_LIMIT) break;
    offset += LIST_LIMIT;
  }

  return collected;
}

/**
 * Obtiene el owner user_id del path:
 * - "uuid/uuid_timestamp.jpg" -> "uuid"
 * - "archivo_suelto.jpg" -> null (no asociado a usuario)
 */
function extractOwnerUserIdFromPath(path: string): string | null {
  const normalized = path.trim().replace(/^\/+/, '');
  if (!normalized) return null;
  const firstSlash = normalized.indexOf('/');
  if (firstSlash <= 0) return null;
  return normalized.slice(0, firstSlash);
}

function countDistinctTopLevelFolders(paths: string[]): number {
  const folders = new Set<string>();
  for (const path of paths) {
    const owner = extractOwnerUserIdFromPath(path);
    if (owner) folders.add(owner);
  }
  return folders.size;
}

async function deleteStoragePaths(
  client: SupabaseClient,
  paths: string[]
): Promise<void> {
  const chunks = chunkArray(paths, REMOVE_CHUNK_SIZE);
  for (const pathChunk of chunks) {
    const { error } = await client.storage.from(BUCKET).remove(pathChunk);
    if (error) {
      console.error('[cleanup-orphan-avatars-by-user-id] Storage delete error:', {
        message: error.message,
        chunkSize: pathChunk.length,
      });
    }
  }
}

async function main() {
  const config = getSupabaseConfig();
  const client = createAdminClient(config);

  console.log('\n[cleanup-orphan-avatars-by-user-id] Loading user IDs from auth.users...');
  const authIds = await getAuthUserIds(client);
  console.log(`[cleanup-orphan-avatars-by-user-id] auth.users IDs: ${authIds.size}`);

  console.log('[cleanup-orphan-avatars-by-user-id] Loading user IDs from public.users...');
  const publicIds = await getPublicUserIds(client);
  console.log(`[cleanup-orphan-avatars-by-user-id] public.users IDs: ${publicIds.size}`);

  const validUserIds = new Set<string>([...authIds, ...publicIds]);
  console.log(
    `[cleanup-orphan-avatars-by-user-id] Total valid IDs (auth ∪ public): ${validUserIds.size}`
  );

  console.log(`[cleanup-orphan-avatars-by-user-id] Scanning bucket "${BUCKET}" recursively...`);
  const allFiles = await listAllFilePathsInBucket(client);
  console.log(`[cleanup-orphan-avatars-by-user-id] Total files found: ${allFiles.length}`);

  const orphanFiles = allFiles.filter((filePath) => {
    const ownerUserId = extractOwnerUserIdFromPath(filePath);
    if (!ownerUserId) return true;
    return !validUserIds.has(ownerUserId);
  });

  const orphanFoldersBefore = countDistinctTopLevelFolders(orphanFiles);

  console.log(
    `[cleanup-orphan-avatars-by-user-id] Orphan files (to delete): ${orphanFiles.length}`
  );

  if (orphanFiles.length === 0) {
    console.log('[cleanup-orphan-avatars-by-user-id] Nothing to delete.\n');
    return;
  }

  if (DRY_RUN) {
    console.log('\n[cleanup-orphan-avatars-by-user-id] DRY_RUN=1 => no deletion performed.');
    console.log('[cleanup-orphan-avatars-by-user-id] Files that would be removed:');
    orphanFiles.forEach((path) => console.log(`  - ${path}`));
    console.log(
      `[cleanup-orphan-avatars-by-user-id] Orphan top-level folders affected: ${orphanFoldersBefore}`
    );
    console.log('');
    return;
  }

  await deleteStoragePaths(client, orphanFiles);

  // Post-check: in Supabase, folders are virtual; if orphan files are gone,
  // orphan folders disappear from listing automatically.
  const filesAfter = await listAllFilePathsInBucket(client);
  const orphanFilesAfter = filesAfter.filter((filePath) => {
    const ownerUserId = extractOwnerUserIdFromPath(filePath);
    if (!ownerUserId) return true;
    return !validUserIds.has(ownerUserId);
  });
  const orphanFoldersAfter = countDistinctTopLevelFolders(orphanFilesAfter);

  console.log('\n[cleanup-orphan-avatars-by-user-id] Finished.');
  console.log(`- Deleted files attempted: ${orphanFiles.length}`);
  console.log(`- Orphan folders before cleanup: ${orphanFoldersBefore}`);
  console.log(`- Remaining orphan files after cleanup: ${orphanFilesAfter.length}`);
  console.log(`- Remaining orphan folders after cleanup: ${orphanFoldersAfter}`);
  console.log('');
}

main().catch((error) => {
  console.error('[cleanup-orphan-avatars-by-user-id] Fatal error:', error);
  process.exit(1);
});
