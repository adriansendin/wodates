-- ============================================================================
-- Configuración del Bucket de Avatares en Supabase Storage
-- ============================================================================
-- 
-- Este script configura el bucket 'avatars' con las políticas de seguridad
-- necesarias para la funcionalidad de subida de fotos de perfil.
-- 
-- IMPORTANTE: Ejecutar en Supabase SQL Editor después de crear el bucket manualmente
-- 
-- Fecha: 2025-10-12
-- Versión: 1.0.0
-- ============================================================================

-- ============================================================================
-- PASO 1: Crear el bucket manualmente desde Supabase Dashboard
-- ============================================================================
-- 1. Ve a Dashboard > Storage > Create bucket
-- 2. Nombre: avatars
-- 3. Público: SÍ
-- 4. File size limit: 500 KB (configurado en el plan gratuito)
-- 5. Allowed MIME types: image/jpeg, image/png, image/webp
-- ============================================================================

-- ============================================================================
-- PASO 2: Ejecutar las siguientes políticas
-- ============================================================================

-- Política 1: Permitir a usuarios autenticados subir sus propios avatares
-- Los archivos deben estar en una carpeta con el nombre del user_id
CREATE POLICY "Users can upload their own avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política 2: Permitir a usuarios autenticados actualizar sus propios avatares
CREATE POLICY "Users can update their own avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política 3: Permitir a usuarios autenticados eliminar sus propios avatares
CREATE POLICY "Users can delete their own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política 4: Permitir acceso público de lectura a todos los avatares
-- Esto permite que las fotos de perfil sean visibles por todos
CREATE POLICY "Public avatar access"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- Para verificar que las políticas se crearon correctamente, ejecuta:
--
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%avatar%';
--
-- Deberías ver 4 políticas creadas.
-- ============================================================================

-- ============================================================================
-- ESTRUCTURA DE ARCHIVOS
-- ============================================================================
-- Los archivos se guardarán con la siguiente estructura:
--
-- avatars/
--   └── {user_id}/
--       └── {user_id}_{timestamp}.jpg
--
-- Ejemplo:
-- avatars/550e8400-e29b-41d4-a716-446655440000/550e8400-e29b-41d4-a716-446655440000_1697123456789.jpg
-- ============================================================================

-- ============================================================================
-- LÍMITES Y RESTRICCIONES
-- ============================================================================
-- Tamaño máximo por archivo: 500 KB
-- Tipos de archivo permitidos: JPEG, PNG, WEBP
-- Plan gratuito de Supabase: 1 GB de almacenamiento total
-- ============================================================================

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================
-- 
-- Problema: "new row violates row-level security policy"
-- Solución: Verifica que el usuario esté autenticado y que las políticas
--           estén activas. Ejecuta: SHOW row_security;
-- 
-- Problema: "Bucket not found"
-- Solución: Asegúrate de haber creado el bucket 'avatars' desde el Dashboard
-- 
-- Problema: "Permission denied"
-- Solución: Verifica que el usuario tenga un auth.uid() válido
-- ============================================================================

-- ============================================================================
-- ROLLBACK (si es necesario deshacer los cambios)
-- ============================================================================
-- Para eliminar todas las políticas creadas, ejecuta:
--
-- DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
-- DROP POLICY IF EXISTS "Public avatar access" ON storage.objects;
--
-- IMPORTANTE: Esto eliminará las políticas pero no el bucket ni los archivos.
-- Para eliminar el bucket, hazlo desde el Dashboard de Supabase.
-- ============================================================================


