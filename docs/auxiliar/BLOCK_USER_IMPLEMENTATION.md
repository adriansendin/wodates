# Implementación de Funcionalidad de Bloqueo de Usuarios

## Resumen

Se ha implementado una funcionalidad completa y profesional de bloqueo de usuarios en la aplicación de citas, siguiendo las mejores prácticas y patrones de diseño del proyecto.

## Características Implementadas

### Backend

#### 1. Entidad BlockedUser
- **Archivo**: `backend-api/src/domain/entities/BlockedUser.ts`
- Define la estructura de datos para un bloqueo entre usuarios
- Campos: blockerId, blockedId, createdAt
- Usa composite primary key (blocker_id, blocked_id) sin id separado
- Validación con Zod schema

#### 2. Repositorio BlockedUser
- **Interface**: `backend-api/src/domain/repositories/BlockedUserRepository.ts`
- **Implementación**: `backend-api/src/data/repositories/SupabaseBlockedUserRepository.ts`
- Métodos:
  - `create()`: Crear un bloqueo
  - `hasBlocked()`: Verificar si A bloqueó a B
  - `isBlocked()`: Verificar bloqueo bidireccional
  - `getBlockedByUser()`: Obtener todos los usuarios bloqueados
  - `delete()`: Desbloquear usuario

#### 3. Use Case BlockUser
- **Archivo**: `backend-api/src/domain/use-cases/chat/BlockUser.ts`
- Validaciones:
  - Previene auto-bloqueo
  - Verifica que el match exista
  - Verifica que ambos usuarios sean parte del match
  - Verifica que no exista un bloqueo previo
- Acciones:
  - Crea el registro de bloqueo
  - El match se mantiene en la BD pero se oculta automáticamente
  - Los mensajes se conservan (Soft Delete)

#### 4. Endpoint de Bloqueo
- **Controlador**: `backend-api/src/app/controllers/chat-controller.ts`
  - Método `blockUser()` añadido
- **Ruta**: `backend-api/src/app/routes/chat-routes.ts`
  - `POST /api/v1/chats/:matchId/block`
  - Body: `{ blockedUserId: string }`
  - Requiere autenticación
  - Retorna: `{ blocked: boolean, blockedUser: { blockerId, blockedId, createdAt } }`
  - Sin campo `id` (usa composite primary key)

#### 5. Filtrado de Matches
- **Servicio**: `backend-api/src/app/services/match-overview-service.ts`
- Modificado para excluir matches donde existe un bloqueo bidireccional
- Los matches bloqueados no aparecen en la lista de ninguno de los dos usuarios

#### 6. Preservación de Matches (Soft Delete)
- **Repositorio**: `backend-api/src/data/repositories/SupabaseMatchRepository.ts`
- Los matches NO se eliminan al bloquear
- Método `delete()` disponible pero NO utilizado por BlockUser
- Los chats y mensajes se conservan para posible recuperación

### Frontend

#### 1. API de Bloqueo
- **Archivo**: `mobile-app/src/data/api/blockApi.ts`
- Clase `BlockApi` con método `blockUser()`
- Manejo de tipos con TypeScript

#### 2. Pantalla de Chat Actualizada
- **Archivo**: `mobile-app/app/chat/[matchId].tsx`

##### UI Añadida:
- **Menú de tres puntos**: Icono en el header (Ionicons)
- **Menú desplegable**: Modal con opción "Bloquear usuario"
- **Modal de confirmación**: 
  - Pregunta: "¿Estás seguro de que quieres bloquear a {nombre}?"
  - Botones: "No" y "Sí"
  - Loading indicator durante el bloqueo

##### Funcionalidad:
- **Bloqueo activo**:
  - Al confirmar, llama al endpoint de bloqueo
  - Muestra indicador de carga
  - Redirige automáticamente a `/matches` tras éxito
  - Manejo de errores con alertas

- **Detección de bloqueo pasivo**:
  - Monitoreo continuo de la lista de matches
  - Detecta cuando el match desaparece (fue bloqueado por el otro usuario)
  - Muestra alerta: "Este chat ya no está disponible"
  - Redirige automáticamente a `/matches`
  - Deshabilita el input de mensajes

#### 3. Pantalla de Matches Actualizada
- **Archivo**: `mobile-app/app/(app)/matches.tsx`
- Pasa el parámetro `otherUserId` al navegar al chat
- Actualización automática cada 5 segundos para reflejar bloqueos

## Comportamiento de la Aplicación

### Cuando el Usuario A Bloquea al Usuario B:

1. **Usuario A (quien bloquea)**:
   - Presiona el menú de tres puntos en el chat
   - Selecciona "Bloquear usuario"
   - Confirma en el modal
   - Es redirigido inmediatamente a la pantalla de matches
   - El chat desaparece de su lista

2. **Usuario B (quien es bloqueado)**:
   - Si tiene el chat abierto:
     - Detecta automáticamente que el match desapareció
     - Recibe una alerta: "Este chat ya no está disponible"
     - Es redirigido automáticamente a matches
     - No puede enviar más mensajes
   - Si no tiene el chat abierto:
     - La próxima vez que revise matches, no verá ese chat
     - Si intenta acceder, será redirigido

3. **Servidor**:
   - Crea el registro en `blocked_users`
   - El chat y mensajes se CONSERVAN en la base de datos (Soft Delete)
   - El match no aparece en ninguna lista de ninguno de los dos usuarios
   - Si se elimina el registro de `blocked_users`, el match reaparece automáticamente

## Flujo Técnico

```
Usuario presiona "Bloquear" 
  → Modal de confirmación
  → Confirma
  → POST /api/v1/chats/:matchId/block
  → BlockUser use case
    → Valida permisos
    → Crea registro en blocked_users
    → Match se conserva pero se filtra automáticamente
  → Retorna éxito
  → Frontend redirige a /matches
  → Actualización periódica de matches
  → Usuario bloqueado detecta ausencia del match
  → Redirige automáticamente
```

## Seguridad y Validaciones

### Backend:
- ✅ Autenticación requerida en todos los endpoints
- ✅ Validación de que el usuario es parte del match
- ✅ Validación de que el usuario bloqueado es parte del match
- ✅ Prevención de auto-bloqueo
- ✅ Prevención de bloqueos duplicados
- ✅ RLS (Row Level Security) en Supabase para `blocked_users`

### Frontend:
- ✅ Validación de parámetros antes de llamar API
- ✅ Manejo de errores con mensajes al usuario
- ✅ Loading states durante operaciones
- ✅ Deshabilitar UI durante operaciones en curso
- ✅ Prevención de envío de mensajes en chats bloqueados

## Arquitectura

La implementación sigue los principios SOLID y la arquitectura limpia del proyecto:

- **Separación de capas**: Domain → Use Cases → Controllers → Routes
- **Inyección de dependencias**: Repositorios inyectados en use cases
- **Inversión de dependencias**: Use cases dependen de interfaces
- **Single Responsibility**: Cada clase tiene una responsabilidad única
- **Validación en capas**: Zod schemas + validación de negocio

## Estilos y UX

### Diseño:
- ✅ Iconos consistentes con el resto de la app (Ionicons)
- ✅ Paleta de colores mantenida (#e91e63 para acciones primarias)
- ✅ Modales con overlay semi-transparente
- ✅ Sombras y elevaciones para jerarquía visual
- ✅ Tipografía consistente
- ✅ Espaciado uniforme

### UX:
- ✅ Confirmación explícita antes de bloquear
- ✅ Feedback visual inmediato (loading, redirects)
- ✅ Mensajes claros y en español
- ✅ Navegación automática después de acciones
- ✅ Estados deshabilitados claros visualmente
- ✅ Prevención de acciones duplicadas

## Testing Sugerido

### Backend:
```bash
# Verificar creación de bloqueo
curl -X POST http://localhost:3000/api/v1/chats/{matchId}/block \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"blockedUserId": "{userId}"}'

# Verificar que el match no aparece después de bloquear
curl http://localhost:3000/api/v1/matches \
  -H "Authorization: Bearer {token}"
```

### Frontend:
1. Crear un match entre dos usuarios
2. Usuario A abre el chat con Usuario B
3. Usuario A presiona el menú de tres puntos
4. Usuario A selecciona "Bloquear usuario"
5. Verificar que aparece el modal de confirmación
6. Usuario A confirma el bloqueo
7. Verificar redirección automática a matches
8. Verificar que el chat no aparece en la lista
9. Usuario B intenta acceder al chat
10. Verificar que ve el mensaje "Chat no disponible"
11. Verificar que es redirigido automáticamente

## Archivos Modificados/Creados

### Backend (10 archivos):
1. ✅ `backend-api/src/domain/entities/BlockedUser.ts` (nuevo)
2. ✅ `backend-api/src/domain/repositories/BlockedUserRepository.ts` (nuevo)
3. ✅ `backend-api/src/data/repositories/SupabaseBlockedUserRepository.ts` (nuevo)
4. ✅ `backend-api/src/domain/use-cases/chat/BlockUser.ts` (nuevo)
5. ✅ `backend-api/src/app/controllers/chat-controller.ts` (modificado)
6. ✅ `backend-api/src/app/routes/chat-routes.ts` (modificado)
7. ✅ `backend-api/src/app/index.ts` (modificado)
8. ✅ `backend-api/src/app/services/match-overview-service.ts` (modificado)
9. ✅ `backend-api/src/domain/repositories/MatchRepository.ts` (modificado)
10. ✅ `backend-api/src/data/repositories/SupabaseMatchRepository.ts` (modificado)

### Frontend (3 archivos):
1. ✅ `mobile-app/src/data/api/blockApi.ts` (nuevo)
2. ✅ `mobile-app/app/chat/[matchId].tsx` (modificado)
3. ✅ `mobile-app/app/(app)/matches.tsx` (modificado)

## Próximos Pasos Opcionales

- [ ] Implementar funcionalidad de desbloqueo (UI para gestionar usuarios bloqueados)
- [ ] Añadir pantalla de usuarios bloqueados en configuración
- [ ] Implementar reportar usuario (además de bloquear)
- [ ] Añadir analytics para rastrear bloqueos
- [ ] Implementar notificaciones push cuando se recibe un bloqueo
- [ ] Añadir razones de bloqueo (opcional)
- [ ] Implementar limpieza automática de matches muy antiguos bloqueados

## Notas Técnicas

- La tabla `blocked_users` usa composite primary key (blocker_id, blocked_id) sin columna id
- Tiene CHECK constraint para prevenir auto-bloqueo a nivel de base de datos
- **Soft Delete**: Los chats y mensajes se conservan en la base de datos
- El bloqueo es unidireccional pero el match se oculta para ambos usuarios
- Los matches bloqueados se pueden recuperar eliminando el registro de `blocked_users`
- La sincronización es en tiempo real a través del polling cada 5 segundos
- Los estados de carga previenen operaciones duplicadas
- Las foreign keys con CASCADE eliminan automáticamente bloqueos si se elimina un usuario

---

**Implementación completada exitosamente** ✅

Todos los requisitos funcionales han sido implementados siguiendo las mejores prácticas de la aplicación.

