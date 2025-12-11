# Setup Inicial: Doc Love en Nuevo Entorno

## Contexto

Doc Love es un usuario bot (asistente IA) integrado en la aplicación. Se crea como usuario normal pero se marca como bot para excluirlo del feed y que sus chats no cuenten para el límite de 3 chats activos.

## Checklist de Deployment

### 1. Base de Datos

**Exportar y ejecutar DDL completo desde Supabase**
- El DDL debe incluir la columna `is_bot` en `public.users`
- Si el DDL no incluye `is_bot`, ejecutar la migración: `docs/db/2025-01-XX_add_is_bot_column.sql`

**Nota:** Si exportas el DDL después de aplicar todos los cambios, ya incluirá `is_bot` y no necesitarás la migración.

### 2. Crear Usuario Doc Love

**Registrar Doc Love desde la aplicación** (endpoint `/api/v1/auth/register`):
- Email: `doclove@wodates.com`
- Password: cualquiera (no se usará para login)
- Completar los datos requeridos del registro

Esto crea automáticamente:
- Registro en `auth.users`
- Registro en `public.users`

**Por qué manualmente:** Cumple con los estándares de Supabase y garantiza que se crea correctamente en ambas tablas usando el mismo flujo que los usuarios reales.

### 3. Configurar Doc Love como Bot

**Ejecutar SQL en Supabase:**

```sql
UPDATE public.users
SET is_bot = TRUE,
    show_bio_in_feed = FALSE
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'doclove@wodates.com'
);
```

**Por qué:** Marca a Doc Love como bot para que:
- No aparezca en el feed (`show_bio_in_feed = FALSE`)
- Sus chats no cuenten para el límite de 3 (`is_bot = TRUE`)
- El código pueda identificarlo correctamente

## Verificación

Después del deployment, verificar:

1. Doc Love existe y está marcado como bot:
   ```sql
   SELECT id, is_bot, show_bio_in_feed 
   FROM public.users 
   WHERE id IN (SELECT id FROM auth.users WHERE email = 'doclove@wodates.com');
   ```
   Debe mostrar: `is_bot = TRUE`, `show_bio_in_feed = FALSE`

2. Usuarios nuevos tienen match automático con Doc Love (se crea automáticamente al registrarse)

3. Doc Love no aparece en el feed (`/api/v1/feed`)

4. Chats con Doc Love no cuentan para el límite de 3 chats activos

## Notas

- El código maneja automáticamente la creación de matches con Doc Love para usuarios nuevos
- Si hay usuarios existentes antes de crear Doc Love, ejecutar el script de migración: `backend-api/scripts/create-doc-love-matches.ts`
- El email de Doc Love está definido en `backend-api/src/domain/constants/system-users.ts` (por defecto: `doclove@wodates.com`)

