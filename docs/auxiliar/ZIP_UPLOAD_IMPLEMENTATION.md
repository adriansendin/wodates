# Implementación MVP "Adjuntar ZIP" en Doc Love

## Resumen

Se ha implementado la funcionalidad para adjuntar y subir archivos ZIP en el chat de Doc Love, siguiendo las buenas prácticas de programación y respetando la arquitectura existente del proyecto.

## Archivos Creados/Modificados

### Backend

1. **`backend-api/src/app/services/storage-service.ts`** (NUEVO)
   - Servicio para crear signed URLs de Supabase Storage
   - Método `createSignedUploadUrl()` para generar URLs firmadas

2. **`backend-api/src/app/controllers/storage-controller.ts`** (NUEVO)
   - Controlador para manejar solicitudes de signed URLs
   - Validación de contentType (solo application/zip)
   - Validación de bucket (solo external_conversations)
   - Validación de path y userId

3. **`backend-api/src/app/controllers/imported-conversations-controller.ts`** (NUEVO)
   - Controlador para registrar uploads en la tabla `imported_conversations`
   - Validación de permisos y formato de path

4. **`backend-api/src/app/routes/storage-routes.ts`** (NUEVO)
   - Rutas para `/storage/signed-url` y `/storage/register-upload`
   - Middleware de autenticación aplicado

5. **`backend-api/src/app/index.ts`** (MODIFICADO)
   - Registro de las nuevas rutas de storage

### Frontend

1. **`mobile-app/src/data/api/zipUploadService.ts`** (NUEVO)
   - Servicio para seleccionar y subir archivos ZIP
   - Validación de tipo MIME y tamaño (≤500KB)
   - Integración con signed URLs del backend
   - Registro automático en `imported_conversations`

2. **`mobile-app/app/chat/[matchId].tsx`** (MODIFICADO)
   - Icono de clip visible solo cuando `isBot === true`
   - Función `handleAttachZip()` para manejar la subida
   - Estado `isUploadingZip` para feedback visual
   - Indicador de carga durante la subida

3. **`mobile-app/package.json`** (MODIFICADO)
   - Añadida dependencia `expo-document-picker`

### Base de Datos

1. **`docs/db/2025-01-XX_create_imported_conversations_table.sql`** (NUEVO)
   - Migración SQL para crear la tabla `imported_conversations`
   - Políticas RLS configuradas
   - Índices para optimización

2. **`docs/db/2025-01-XX_setup_external_conversations_bucket.sql`** (NUEVO)
   - Configuración del bucket `external_conversations` en Supabase Storage
   - Políticas de seguridad para usuarios autenticados
   - Bucket configurado como privado

## Configuración Requerida

### 1. Instalar Dependencias

```bash
cd mobile-app
npm install
```

### 2. Configurar Supabase Storage

#### Crear el Bucket `external_conversations`
1. Ve a Supabase Dashboard > Storage > Create bucket
2. Nombre: `external_conversations`
3. Público: **NO** (bucket privado)
4. File size limit: 500 KB
5. Allowed MIME types: `application/zip`

#### Ejecutar Políticas SQL
Ejecutar el archivo `docs/db/2025-01-XX_setup_external_conversations_bucket.sql` en el SQL Editor de Supabase.

### 3. Crear Tabla `imported_conversations`
Ejecutar el archivo `docs/db/2025-01-XX_create_imported_conversations_table.sql` en el SQL Editor de Supabase.

## Flujo de Funcionamiento

1. **Usuario pulsa el icono de clip** (solo visible en Doc Love)
2. **Se abre el selector de documentos** del sistema
3. **Validación en cliente**:
   - Tipo MIME: `application/zip`
   - Tamaño: ≤ 500 KB
4. **Backend genera signed URL**:
   - Endpoint: `POST /api/v1/storage/signed-url`
   - Path: `external_conversations/{userId}/{uuid}/upload.zip`
   - Expiración: 60 segundos
5. **Frontend sube el archivo** usando PUT a la signed URL
6. **Backend registra el upload**:
   - Endpoint: `POST /api/v1/storage/register-upload`
   - Inserta fila en `imported_conversations`
7. **Mensaje de éxito**: "Subido con éxito."

## Seguridad

- ✅ Bucket privado (no público)
- ✅ Validación de contentType en backend
- ✅ Validación de userId en path
- ✅ Signed URLs con expiración corta (60 segundos)
- ✅ RLS en tabla `imported_conversations` (solo el dueño ve sus registros)
- ✅ Políticas de Storage restringidas por userId

## Mensajes de Error

- **Tipo inválido**: "Archivo no válido (debe ser .zip)"
- **Tamaño excedido**: "Máximo permitido: 500 KB"
- **Error de red**: "No se pudo subir. Inténtalo de nuevo."
- **Éxito**: "Subido con éxito."

## Notas de Implementación

- El icono de clip solo aparece cuando `isBot === true` (Doc Love)
- La validación se realiza tanto en cliente como en servidor
- El UUID se genera en el frontend para cada adjunto
- La estructura de paths es: `external_conversations/{userId}/{uuid}/upload.zip`
- El registro en BD se hace después de la subida exitosa

## Próximos Pasos (Opcional)

- [ ] Añadir indicador de progreso de subida
- [ ] Permitir cancelar la subida en curso
- [ ] Mostrar historial de archivos subidos
- [ ] Procesar el contenido del ZIP (fuera del scope del MVP)

