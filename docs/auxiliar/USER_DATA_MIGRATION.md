# Migración de Datos de Usuario - Resumen

## ¿Qué cambió?

**Antes**: Los campos `name` y `email` se almacenaban en la tabla `public.users`

**Después**: 
- `email` → `auth.users.email`
- `name` → `auth.users.raw_user_meta_data.display_name`

## ¿Por qué?

- Eliminar duplicación de datos
- Aprovechar la gestión nativa de Supabase Auth
- Mejor seguridad (solo backend accede a auth.users)

## ¿Cómo funciona ahora?

### Registro de Usuario
```typescript
// El nombre se guarda en auth.users.raw_user_meta_data.display_name
user_metadata: {
  display_name: registerRequest.name, // Aquí va el nombre
  // otros datos...
}
```

### Obtener Perfil
```typescript
// Backend combina datos de ambas tablas
const profile = await getProfileFromPublicUsers(userId);  // bio, preferences, etc.
const authData = await getAuthUser(userId);               // name, email
return { ...profile, ...authData };
```

### Acceso Seguro
- **Backend**: Usa `SUPABASE_SERVICE_ROLE_KEY` para acceder a `auth.users`
- **Frontend**: Recibe datos ya combinados del backend
- **Usuarios**: No pueden acceder directamente a `auth.users`

## Archivos Modificados

- `backend-api/src/app/services/supabase-auth-service.ts` - Almacena nombre en display_name
- `backend-api/src/app/services/supabase-user-service.ts` - Lee de auth.users
- `backend-api/src/domain/entities/User.ts` - Documentación actualizada
- `mobile-app/src/domain/entities/User.ts` - Sincronizado con backend

## ¿Qué NO cambió?

- Las APIs siguen retornando `name` y `email` como antes
- El frontend no necesita cambios en su lógica
- Los usuarios no notan diferencia alguna

## Verificación

Para confirmar que todo funciona:
1. Crear un nuevo usuario → verificar que el nombre se almacena en `auth.users.raw_user_meta_data.display_name`
2. Obtener perfil → verificar que retorna name y email correctamente
3. Actualizar perfil → verificar que otros campos se actualizan sin problemas
