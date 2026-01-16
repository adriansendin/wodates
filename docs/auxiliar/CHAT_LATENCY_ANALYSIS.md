# Análisis de Latencia del Sistema de Chat

## Problema Identificado

**Síntoma**: Los mensajes entre usuarios humanos pueden tardar hasta 20 segundos en aparecer para el receptor.

**Causa raíz**: El sistema utiliza **polling cada 30 segundos** sin ningún mecanismo de tiempo real (WebSockets, Server-Sent Events, o notificaciones push).

---

## Estructura Actual del Flujo de Mensajes

### 1. Envío de Mensaje (Usuario A → Backend)

```
Usuario A escribe mensaje
    ↓
[matchId].tsx: handleSendMessageInternal()
    ↓
ChatApi.sendMessage() → POST /api/v1/chats/:matchId/messages
    ↓
ChatController.sendMessage()
    ↓
SendMessage.execute()
    ├─ Valida match existe
    ├─ Verifica usuario es parte del match
    └─ MessageRepository.create() → Guarda en BD (Supabase)
    ↓
Respuesta inmediata al Usuario A (201 Created)
    ↓
Usuario A ve su mensaje inmediatamente (optimistic update)
```

**Tiempo estimado**: ~200-500ms (muy rápido para el emisor)

### 2. Recepción de Mensaje (Backend → Usuario B)

```
Mensaje guardado en BD
    ↓
[ESPERA...]
    ↓
Usuario B hace polling automático cada 30 segundos
    ↓
[matchId].tsx: useEffect() → setInterval(30000ms)
    ↓
loadMessages() → GET /api/v1/chats/:matchId/messages
    ↓
ChatController.getMessages()
    ↓
GetMessages.execute() → MessageRepository.findByMatchId()
    ↓
Respuesta con mensajes nuevos
    ↓
Usuario B ve el mensaje
```

**Tiempo estimado**: **0-30 segundos** (depende de cuándo ocurre el siguiente poll)

---

## Puntos Críticos de Latencia

### 🔴 Problema Principal: Polling de 30 segundos

**Ubicación**: `mobile-app/app/chat/[matchId].tsx:650`

```typescript
const pollInterval = 30000; // 30 seconds

const interval = setInterval(() => {
  if (!isLoadingMessagesRef.current && !isInitialLoad.current && activeChatSession.canLoadMessages()) {
    loadMessages();
  }
}, pollInterval);
```

**Impacto**:
- En el **mejor caso**: Usuario B hace poll justo después de que se envía el mensaje → **~0-1 segundo**
- En el **peor caso**: Usuario B acaba de hacer poll cuando se envía el mensaje → **hasta 30 segundos**
- **Promedio esperado**: ~15 segundos

### ⚠️ Problemas Adicionales

1. **No hay notificaciones push**: El backend no envía notificaciones cuando se crea un mensaje
2. **No hay WebSockets**: No hay conexión persistente para recibir mensajes en tiempo real
3. **Protección contra rate limiting**: Hay un mínimo de 2 segundos entre polls (`activeChatSession.canLoadMessages()`)
4. **Delay inicial**: Hay un delay de 1 segundo antes del primer poll (`setTimeout(..., 1000)`)

---

## Flujo Temporal Detallado

### Escenario: Usuario A envía mensaje a Usuario B

```
T=0s    Usuario A presiona "Send"
T=0.1s  Request HTTP POST enviado
T=0.3s  Backend recibe y valida
T=0.5s  Mensaje guardado en BD
T=0.6s  Usuario A recibe respuesta 201
T=0.7s  Usuario A ve su mensaje (optimistic update)

T=0.5s  Mensaje disponible en BD para Usuario B
        [ESPERANDO POLL...]

T=15s   Usuario B hace poll (si acaba de pasar el intervalo)
        O
T=30s   Usuario B hace poll (si acaba de hacer uno)
        ↓
T=30.2s Usuario B recibe mensajes nuevos
T=30.3s Usuario B ve el mensaje de Usuario A
```

**Latencia total**: **15-30 segundos** (promedio ~22.5 segundos)

---

## Código Relevante

### Frontend: Polling

**Archivo**: `mobile-app/app/chat/[matchId].tsx`

```typescript
// Línea 650: Intervalo de polling
const pollInterval = 30000; // 30 seconds

// Línea 652-662: Polling automático
const interval = setInterval(() => {
  if (!isLoadingMessagesRef.current && !isInitialLoad.current && activeChatSession.canLoadMessages()) {
    loadMessages();
  }
}, pollInterval);
```

### Backend: Envío de Mensaje

**Archivo**: `backend-api/src/domain/use-cases/chat/SendMessage.ts`

```typescript
// Línea 65-69: Guarda mensaje en BD
const messageResult = await this.messageRepository.create({
  matchId,
  senderId,
  content,
});

// Línea 197: Retorna inmediatamente (sin notificar al otro usuario)
return success(savedMessage);
```

**Observación**: El backend **no envía ninguna notificación** al otro usuario cuando se crea un mensaje.

---

## Soluciones Propuestas

### Opción 1: Reducir Intervalo de Polling (Solución Rápida)

**Pros**:
- Implementación inmediata (cambiar un número)
- No requiere cambios en backend

**Contras**:
- Aumenta carga en servidor (más requests)
- Sigue siendo polling (no tiempo real)
- Latencia mínima sigue existiendo (ej: 5 segundos)

**Implementación**:
```typescript
const pollInterval = 5000; // 5 seconds (en lugar de 30)
```

### Opción 2: WebSockets (Solución Ideal)

**Pros**:
- Tiempo real verdadero (< 1 segundo de latencia)
- Menos carga en servidor (una conexión persistente)
- Mejor experiencia de usuario

**Contras**:
- Requiere implementación completa (backend + frontend)
- Más complejo de mantener
- Requiere manejo de reconexión

**Tecnologías sugeridas**:
- Backend: `@fastify/websocket` o Socket.io
- Frontend: `socket.io-client` para React Native

### Opción 3: Server-Sent Events (SSE) (Solución Intermedia)

**Pros**:
- Tiempo real con HTTP simple
- Más fácil que WebSockets
- Mejor que polling

**Contras**:
- No funciona bien en React Native (limitaciones)
- Unidireccional (solo servidor → cliente)

### Opción 4: Notificaciones Push + Polling Reducido (Híbrida)

**Pros**:
- Notifica cuando hay mensajes nuevos
- Polling solo cuando la app está abierta
- Mejor experiencia fuera de la app

**Contras**:
- Requiere configuración de FCM/APNS
- Más complejo que solo polling

---

## Mejoras Implementadas ✅

### Cambios Realizados (2024)

1. **Polling reducido de 30s a 5s**
   - **Antes**: Polling cada 30 segundos
   - **Ahora**: Polling cada 5 segundos
   - **Impacto**: Latencia máxima reducida de 30s a 5s

2. **Polling agresivo después de enviar mensaje**
   - Poll inmediato a los 1 segundo después de enviar
   - Poll de seguimiento a los 2 segundos después de enviar
   - **Impacto**: Si ambos usuarios están en el chat, el receptor verá el mensaje en ~1-2 segundos

### Nuevas Métricas Esperadas

- **Latencia mínima**: ~1-2 segundos (con polling agresivo)
- **Latencia promedio**: ~2-3 segundos
- **Latencia máxima**: ~5 segundos (en lugar de 30s)
- **Frecuencia de polling**: Cada 5 segundos (en lugar de 30s)
- **Requests por minuto por chat activo**: 12 requests/minuto (en lugar de 2)

---

## Recomendación Futura

### Mediano Plazo (Próximo Mes)
1. **Implementar WebSockets** para tiempo real verdadero (< 1 segundo)
2. **Mantener polling como fallback** si WebSocket falla

### Largo Plazo
1. **Notificaciones push** para cuando la app está en background
2. **Optimización de BD** con índices apropiados para queries de mensajes

---

## Métricas Anteriores (Antes de las Mejoras)

- **Latencia mínima**: ~0-1 segundo (si poll coincide)
- **Latencia promedio**: ~15-22 segundos
- **Latencia máxima**: ~30 segundos
- **Frecuencia de polling**: Cada 30 segundos
- **Requests por minuto por chat activo**: 2 requests/minuto

## Métricas Actuales (Después de las Mejoras)

- **Latencia mínima**: ~1-2 segundos (con polling agresivo)
- **Latencia promedio**: ~2-3 segundos
- **Latencia máxima**: ~5 segundos
- **Frecuencia de polling**: Cada 5 segundos
- **Requests por minuto por chat activo**: 12 requests/minuto

---

## Archivos Clave para Modificar

1. **Frontend Polling**: `mobile-app/app/chat/[matchId].tsx` (línea 650)
2. **Backend Send Message**: `backend-api/src/domain/use-cases/chat/SendMessage.ts`
3. **Backend Routes**: `backend-api/src/app/routes/chat-routes.ts`
4. **API Client**: `mobile-app/src/data/api/chatApi.ts`

---

## Notas Técnicas

- El sistema tiene protección contra múltiples polls simultáneos (`activeChatSession`)
- Hay un delay mínimo de 2 segundos entre polls (`canLoadMessages()`)
- El polling solo ocurre cuando el chat está activo y no está en carga inicial
- Los mensajes se muestran inmediatamente al emisor (optimistic update)
