-- ============================================================================
-- Configuración del Bucket external_conversations en Supabase Storage
-- ============================================================================
-- 
-- Este script configura el bucket 'external_conversations' con las políticas
-- de seguridad necesarias para la funcionalidad de subida de archivos ZIP
-- desde Doc Love.
-- 
-- IMPORTANTE: Ejecutar en Supabase SQL Editor después de crear el bucket manualmente
-- 
-- Fecha: 2025-01-XX
-- Versión: 1.0.0
-- ============================================================================

-- ============================================================================
-- PASO 1: Crear el bucket manualmente desde Supabase Dashboard
-- ============================================================================
-- 1. Ve a Dashboard > Storage > Create bucket
-- 2. Nombre: external_conversations
-- 3. Público: NO (bucket privado)
-- 4. File size limit: 500 KB
-- 5. Allowed MIME types: application/zip
-- ============================================================================

-- ============================================================================
-- PASO 2: Ejecutar la política de INSERT (mínimo necesario)
-- ============================================================================

-- Política: Permitir a usuarios autenticados subir archivos ZIP en su propia carpeta
-- Los archivos deben estar en: external_conversations/{userId}/{uuid}/upload.zip
CREATE POLICY "Users can upload ZIP files to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'external_conversations' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND name LIKE '%.zip'
);

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- Para verificar que la política se creó correctamente, ejecuta:
--
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%external_conversations%';
--
-- Deberías ver 1 política creada (solo INSERT).
-- ============================================================================

-- ============================================================================
-- ESTRUCTURA DE ARCHIVOS
-- ============================================================================
-- Los archivos se guardarán con la siguiente estructura:
--
-- external_conversations/
--   └── {user_id}/
--       └── {uuid}/
--           └── upload.zip
--
-- Ejemplo:
-- external_conversations/550e8400-e29b-41d4-a716-446655440000/a1b2c3d4-e5f6-7890-abcd-ef1234567890/upload.zip
-- ============================================================================

-- ============================================================================
-- LÍMITES Y RESTRICCIONES
-- ============================================================================
-- Tamaño máximo por archivo: 500 KB
-- Tipo de archivo permitido: application/zip
-- Bucket: Privado (no público)
-- Acceso: Solo el propietario puede acceder a sus archivos
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
-- Solución: Asegúrate de haber creado el bucket 'external_conversations' desde el Dashboard
-- 
-- Problema: "Permission denied"
-- Solución: Verifica que el usuario tenga un auth.uid() válido y que la ruta
--           del archivo siga el formato: external_conversations/{userId}/{uuid}/upload.zip
-- ============================================================================

-- ============================================================================
-- ROLLBACK (si es necesario deshacer los cambios)
-- ============================================================================
-- Para eliminar la política creada, ejecuta:
--
-- DROP POLICY IF EXISTS "Users can upload ZIP files to their own folder" ON storage.objects;
--
-- IMPORTANTE: Esto eliminará la política pero no el bucket ni los archivos.
-- Para eliminar el bucket, hazlo desde el Dashboard de Supabase.
-- ============================================================================

