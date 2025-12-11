# Guía de Configuración: Subida de Fotos de Perfil

## Descripción

Esta guía documenta la implementación de la funcionalidad de subida de fotos de perfil en Wodates. Los usuarios pueden ahora subir sus fotos de perfil tanto durante el registro como desde su pantalla de perfil, con compresión automática de imágenes que excedan 500KB.

## Características Implementadas

### 1. **Flujo de Registro (Step 6)**
- Nuevo paso al final del flujo de registro para subir foto de perfil
- Los usuarios pueden tomar una foto con la cámara o seleccionar desde su galería
- Este paso es **opcional** - los usuarios pueden omitirlo y añadir su foto más tarde
- La foto se sube a Supabase Storage automáticamente después de crear la cuenta

### 2. **Pantalla de Perfil**
- Los usuarios pueden tocar su foto de perfil para cambiarla en cualquier momento
- Opciones para tomar foto con cámara o seleccionar desde galería
- Feedback visual durante la subida (indicador de carga)
- Mensajes de éxito o error después de la operación

### 3. **Procesamiento de Imágenes**
- **Compresión automática**: Las imágenes que excedan 500KB se comprimen automáticamente
- **Redimensionamiento**: Las imágenes se redimensionan a un máximo de 800px de ancho
- **Formato**: Las imágenes se convierten a JPEG para optimizar el tamaño
- **Calidad adaptativa**: El algoritmo ajusta la calidad hasta lograr el tamaño objetivo

## Configuración del Proyecto

### 1. Variables de Entorno

#### Backend API (`backend-api/.env`)
```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

#### Mobile App (`mobile-app/.env`)
```env
# API Configuration
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1

# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2. Configuración de Supabase Storage

#### Crear el Bucket
1. Ve a Supabase Dashboard > Storage
2. Crea un nuevo bucket llamado `avatars`
3. Configura el bucket como **público**
4. Establece las siguientes políticas de Storage:

```sql
-- Política para permitir a usuarios autenticados subir sus propios avatares
CREATE POLICY "Users can upload their own avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir a usuarios autenticados actualizar sus propios avatares
CREATE POLICY "Users can update their own avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir a usuarios autenticados eliminar sus propios avatares
CREATE POLICY "Users can delete their own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir acceso público de lectura
CREATE POLICY "Public avatar access"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

#### Configuración del Bucket
- **Nombre**: `avatars`
- **Público**: Sí
- **Tamaño máximo por archivo**: 500KB (configurado en el plan gratuito)
- **Tipos de archivo permitidos**: `image/jpeg`, `image/png`, `image/webp`

### 3. Dependencias Instaladas

Las siguientes dependencias fueron añadidas al proyecto mobile-app:

```json
{
  "@supabase/supabase-js": "^2.x.x",
  "expo-image-picker": "^14.x.x",
  "expo-image-manipulator": "^11.x.x"
}
```

## Arquitectura

### Archivos Creados/Modificados

#### Nuevos Archivos
1. **`mobile-app/src/data/api/supabaseClient.ts`**
   - Cliente singleton de Supabase
   - Configuración centralizada de conexión

2. **`mobile-app/src/data/api/imageService.ts`**
   - Servicio de manipulación de imágenes
   - Funciones de selección desde galería y cámara
   - Algoritmo de compresión inteligente
   - Upload y delete de avatares en Supabase Storage

3. **`mobile-app/app/(auth)/register/step6.tsx`**
   - Nuevo paso en el flujo de registro
   - Interfaz para subir foto de perfil
   - Opción de omitir el paso

#### Archivos Modificados
1. **`mobile-app/src/domain/stores/registrationStore.ts`**
   - Añadido campo `avatarUrl` al estado de registro
   - Actualizado máximo de steps a 6

2. **`mobile-app/app/(auth)/register/step5.tsx`**
   - Ahora navega a `step6` en lugar de `complete`

3. **`mobile-app/app/(auth)/register/complete.tsx`**
   - Añadida lógica para subir avatar a Supabase después del registro
   - Actualización del perfil con la URL pública del avatar

4. **`mobile-app/app/(app)/profile.tsx`**
   - Añadida funcionalidad de cambio de avatar
   - Interfaz mejorada con overlay en la foto
   - Indicador de carga durante upload

5. **`mobile-app/app/(auth)/register/step[1-4].tsx`**
   - Actualizada barra de progreso a 6 steps

6. **`mobile-app/env.example` y `backend-api/env.example`**
   - Añadidas variables de entorno de Supabase

## Flujo de Usuario

### Durante el Registro
1. Usuario completa steps 1-5 (datos básicos)
2. Step 6: Se le ofrece subir una foto de perfil
   - Puede tomar una foto con la cámara
   - Puede seleccionar desde su galería
   - Puede omitir este paso
3. Si sube una foto:
   - La imagen se comprime automáticamente si excede 500KB
   - Se guarda localmente hasta completar el registro
4. Al finalizar el registro:
   - Se crea la cuenta del usuario
   - Si hay foto seleccionada, se sube a Supabase Storage
   - Se actualiza el perfil con la URL pública del avatar

### Desde el Perfil
1. Usuario toca su foto de perfil actual
2. Selecciona origen (cámara o galería)
3. Si es necesario, la imagen se comprime
4. La imagen se sube a Supabase Storage
5. El perfil se actualiza automáticamente
6. Se muestra feedback de éxito o error

## Algoritmo de Compresión

```typescript
Inicio con quality = 0.8
Redimensionar a máximo 800px de ancho
Convertir a JPEG

Mientras tamaño > 500KB y attempts < 5:
  Comprimir con calidad actual
  Si tamaño <= 500KB:
    Usar esta imagen
    Salir
  Reducir calidad en 0.15
  Incrementar attempts

Si quality < 0.1:
  Usar la mejor compresión lograda
```

## Seguridad

### Validaciones Implementadas
- ✅ Solo usuarios autenticados pueden subir avatares
- ✅ Los usuarios solo pueden modificar sus propios avatares
- ✅ Los archivos se guardan en carpetas por usuario ID
- ✅ Tamaño máximo de archivo: 500KB
- ✅ Tipos de archivo permitidos: JPEG, PNG, WEBP
- ✅ Nombres de archivo únicos con timestamp

### Permisos Requeridos
- **iOS/Android**: Permiso de cámara
- **iOS/Android**: Permiso de acceso a fotos

## Manejo de Errores

La aplicación maneja los siguientes casos de error:

1. **Permisos denegados**: Mensaje al usuario solicitando habilitar permisos
2. **Error de red**: Mensaje de reintento
3. **Error de Supabase**: Mensaje específico del error
4. **Compresión fallida**: Se usa la mejor compresión lograda
5. **Cancelación por usuario**: Se cierra el selector sin acción

## Pruebas Recomendadas

### Casos de Prueba
1. ✅ Subir foto durante el registro
2. ✅ Omitir foto durante el registro
3. ✅ Cambiar foto desde el perfil
4. ✅ Tomar foto con cámara
5. ✅ Seleccionar foto desde galería
6. ✅ Subir imagen < 500KB (sin compresión)
7. ✅ Subir imagen > 500KB (con compresión)
8. ✅ Probar sin permisos de cámara
9. ✅ Probar sin permisos de galería
10. ✅ Probar sin conexión a internet

## Próximas Mejoras

### Sugerencias para el Futuro
- [ ] Permitir recortar la imagen antes de subir
- [ ] Añadir filtros o efectos a las fotos
- [ ] Soporte para múltiples fotos de perfil
- [ ] Caché local de avatares para mejor rendimiento
- [ ] Opción de eliminar avatar
- [ ] Previsualización antes de subir
- [ ] Progreso de subida más detallado
- [ ] Soporte para imágenes en formato AVIF

## Troubleshooting

### Problema: "Missing Supabase configuration"
**Solución**: Verifica que las variables `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` estén configuradas en tu archivo `.env`

### Problema: "Permission denied"
**Solución**: 
1. Ve a Configuración del dispositivo
2. Encuentra la app Wodates
3. Habilita permisos de Cámara y Fotos

### Problema: "Upload failed"
**Solución**: 
1. Verifica tu conexión a internet
2. Confirma que el bucket `avatars` existe en Supabase
3. Verifica que las políticas de Storage estén configuradas correctamente

### Problema: La imagen no se comprime
**Solución**: La compresión es automática solo si la imagen excede 500KB. Verifica el tamaño de la imagen original.

## Contacto y Soporte

Para preguntas o problemas relacionados con esta funcionalidad, por favor:
1. Revisa esta documentación
2. Consulta los logs de la aplicación
3. Verifica la configuración de Supabase

---

**Última actualización**: Octubre 2025
**Versión**: 1.0.0


