-- Script para migrar nombres de usuarios existentes a auth.users.raw_user_meta_data.display_name
-- 
-- IMPORTANTE: Este script debe ejecutarse si los usuarios fueron creados ANTES de la migración
-- y no tienen display_name en sus metadatos.
--
-- PROBLEMA: Si los usuarios fueron creados cuando 'name' estaba en public.users,
-- sus nombres NO están en auth.users y aparecerá "Usuario" como fallback.
--
-- SOLUCIÓN: Este script NO PUEDE migrar automáticamente porque:
-- 1. Los nombres ya fueron eliminados de public.users
-- 2. No hay forma de recuperarlos si no están en auth.users
--
-- OPCIONES:
-- A) Si tienes un backup de public.users con el campo 'name', restaura esos datos y usa este script
-- B) Pide a los usuarios que actualicen su nombre desde la aplicación
-- C) Asigna nombres por defecto basados en el email

-- OPCIÓN A: Si tienes un backup con nombres
-- (Primero necesitas restaurar la columna name temporalmente en public.users)

-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name_backup TEXT;
-- -- Aquí restaurarías los nombres desde tu backup
-- -- UPDATE public.users SET name_backup = ... FROM backup_table ...

-- Luego actualizarías auth.users (esto requiere una función PL/pgSQL porque 
-- no podemos actualizar auth.users directamente con SQL simple)


-- OPCIÓN B: Script para verificar usuarios sin nombre y generarles uno basado en email
-- Este script genera sentencias UPDATE que deberás ejecutar manualmente o desde código

SELECT 
  'Usuario ' || au.id || ' (' || au.email || ') - necesita actualizar display_name' as info,
  au.id,
  au.email,
  au.raw_user_meta_data
FROM auth.users au
WHERE au.raw_user_meta_data->>'display_name' IS NULL 
   OR au.raw_user_meta_data->>'display_name' = '';


-- OPCIÓN C: Si quieres un script rápido para testing
-- Genera nombres de usuario a partir del email (antes del @)
-- NOTA: Esto debe hacerse desde el backend con el Admin API de Supabase

-- Ejemplo de cómo hacerlo desde el backend (NO es SQL, es TypeScript):
/*
import { createClient } from '@supabase/supabase-js';

async function migrateUserNames() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get all users
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error('Error listing users:', error);
    return;
  }

  for (const user of users) {
    const metadata = user.user_metadata || {};
    
    // Skip if already has display_name
    if (metadata.display_name) {
      console.log(`User ${user.id} already has display_name: ${metadata.display_name}`);
      continue;
    }

    // Generate a display name from email
    const displayName = user.email?.split('@')[0] || 'User';
    
    // Update user metadata
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...metadata,
          display_name: displayName
        }
      }
    );

    if (updateError) {
      console.error(`Error updating user ${user.id}:`, updateError);
    } else {
      console.log(`✅ Updated user ${user.id} with display_name: ${displayName}`);
    }
  }
}

migrateUserNames();
*/

-- VERIFICACIÓN FINAL: Después de ejecutar la migración desde el backend,
-- verifica que todos los usuarios tengan display_name:
SELECT 
  COUNT(*) as usuarios_sin_nombre
FROM auth.users
WHERE raw_user_meta_data->>'display_name' IS NULL 
   OR raw_user_meta_data->>'display_name' = '';

-- Si el resultado es 0, todos los usuarios tienen nombre ✅

