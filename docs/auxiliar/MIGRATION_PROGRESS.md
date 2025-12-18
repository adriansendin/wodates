# Progreso de Migración: Backend → AI-Service

**Fecha:** 2025-01-XX  
**Estado:** FASE 3 completada - Listo para pruebas

---

## ✅ Fases Completadas

### FASE 1: Inventario ✅
- Documentado en `docs/auxiliar/MIGRATION_INVENTORY.md`
- Todos los puntos de llamada a LLM identificados
- Endpoints de ai-service mapeados

### FASE 2: Clientes HTTP ✅
- `AiServiceChatClient.ts` - Cliente para `/chat/generate`
- `AiServiceProfileClient.ts` - Cliente para `/profile/generate` y `/profile/merge`
- `AiServiceEmbeddingClient.ts` - Cliente para `/embeddings/generate`
- Configuración agregada en `AIConfig.aiService`

### FASE 3: Sustitución Progresiva ✅

#### 3.1 Chat DocLove ✅
**Archivo:** `backend-api/src/app/ai/chat/DocLoveChatService.ts`
- ✅ Feature flag `USE_AI_SERVICE` implementado
- ✅ Transformación de `ChatRequest` → `messages + system` para ai-service
- ✅ Código legacy mantenido para rollback
- ✅ Métodos helper: `buildSystemPrompt()`, `buildMessages()`

#### 3.2 Generación de Perfil ✅
**Archivo:** `backend-api/src/domain/use-cases/chat/GenerateUserProfileFromChats.ts`
- ✅ Feature flag `USE_AI_SERVICE` implementado
- ✅ Transformación de `SummarizerRequest` → `conversations[]` para ai-service
- ✅ Merge sustituido por `AiServiceProfileClient.mergeProfiles()`
- ✅ Código legacy mantenido para rollback
- ✅ Método helper: `transformToAiServiceConversations()`

#### 3.3 Embeddings ✅
**Archivo:** `backend-api/src/app/ai/profile/UserAIProfileEmbeddingService.ts`
- ✅ Feature flag `USE_AI_SERVICE` implementado
- ✅ Sustitución directa de `EmbeddingModel` → `AiServiceEmbeddingClient`
- ✅ Código legacy mantenido para rollback

---

## 🔧 Cómo Activar la Migración

### Paso 1: Configurar Variables de Entorno

Agregar al `.env` del backend-api:

```bash
# Activar migración a ai-service
USE_AI_SERVICE=true

# URL del ai-service (default: http://localhost:8000)
AI_SERVICE_URL=http://localhost:8000

# Timeout para operaciones de ai-service (default: 600000ms = 10 minutos)
AI_SERVICE_TIMEOUT=600000
```

### Paso 2: Verificar que ai-service esté corriendo

```bash
# En el directorio ai-service
python -m uvicorn main:app --reload --port 8000

# Verificar salud
curl http://localhost:8000/health
```

### Paso 3: Reiniciar backend-api

```bash
# El backend detectará USE_AI_SERVICE=true y usará ai-service
npm run dev
```

### Paso 4: Verificar Logs

Buscar en los logs del backend:
```
DocLoveChatService: Using ai-service for chat generation
GenerateUserProfileFromChats: Using ai-service for profile generation
UserAIProfileEmbeddingService: Using ai-service for embedding generation
```

---

## 🔄 Reversibilidad

Para volver al código legacy (directo a LLM):

```bash
# En .env
USE_AI_SERVICE=false
# o simplemente eliminar la variable
```

El backend automáticamente usará `ChatModel`, `SummarizerModel`, y `EmbeddingModel` directamente.

---

## 📝 Notas Importantes

### Job Nocturno (process-user-profiles-job.ts)

**Estado:** Parcialmente migrado

- ✅ **Proceso 1** (chats desde Wodates): Usa `GenerateUserProfileFromChats`, que ya está migrado
- ⚠️ **Proceso 2** (chats externos): Todavía usa `mergeSummaries()` directo (línea 799)

**Recomendación:** El proceso 2 también debería usar `AiServiceProfileClient.mergeProfiles()`, pero puede actualizarse después de validar el proceso 1.

### Transformación de Datos

1. **Chat:** El backend construye `system` prompt incluyendo user context y active matches. Los `messages` son el historial + último mensaje.

2. **Profile:** El backend transforma `ProcessedChatSummary[]` a `conversations[]` plano, marcando mensajes del usuario principal con `(MAIN)`.

3. **Embeddings:** Transformación directa - solo pasa el texto del summary.

---

## 🧪 Verificación

### Checklist de Pruebas

#### Chat DocLove
- [ ] Login con usuario
- [ ] Enviar mensaje a DocLove
- [ ] Verificar respuesta generada
- [ ] Verificar que se guarda en base de datos
- [ ] Verificar logs indican uso de ai-service

#### Generación de Perfil
- [ ] Ejecutar endpoint manual de generación de perfil
- [ ] Verificar que `summary_incremental` se genera
- [ ] Verificar que merge funciona si existe `summary` consolidado
- [ ] Verificar que `summary` se actualiza correctamente
- [ ] Verificar logs indican uso de ai-service

#### Embeddings
- [ ] Ejecutar job nocturno manualmente
- [ ] Verificar que embeddings se generan desde `summary`
- [ ] Verificar que `summary_embedding` se actualiza
- [ ] Verificar logs indican uso de ai-service

---

## 🚨 Troubleshooting

### Error: "ai-service /chat/generate timeout"
- Verificar que ai-service esté corriendo
- Verificar `AI_SERVICE_URL` en .env
- Aumentar `AI_SERVICE_TIMEOUT` si es necesario

### Error: "ai-service returned invalid response format"
- Verificar que ai-service esté respondiendo correctamente
- Revisar logs de ai-service para errores

### Fallback a código legacy
- Si `USE_AI_SERVICE=true` pero hay errores, el código legacy NO se activa automáticamente
- Para rollback manual: cambiar `USE_AI_SERVICE=false` y reiniciar

---

## 📊 Próximos Pasos (FASE 4 y 5)

### FASE 4: Coexistencia Controlada
- [ ] Validar todas las funcionalidades con `USE_AI_SERVICE=true`
- [ ] Monitorear errores y performance
- [ ] Ajustar timeouts si es necesario

### FASE 5: Ejecución Real del Sistema
- [ ] Levantar frontend + backend + ai-service
- [ ] Ejecutar pruebas end-to-end
- [ ] Validar comportamiento idéntico al sistema actual

### Post-Migración
- [ ] Actualizar job nocturno proceso 2 para usar ai-service
- [ ] Eliminar código legacy comentado (después de validación completa)
- [ ] Documentar arquitectura final

---

## 📚 Archivos Modificados

### Nuevos Archivos
- `backend-api/src/app/ai/clients/AiServiceChatClient.ts`
- `backend-api/src/app/ai/clients/AiServiceProfileClient.ts`
- `backend-api/src/app/ai/clients/AiServiceEmbeddingClient.ts`
- `backend-api/src/app/ai/clients/index.ts`

### Archivos Modificados
- `backend-api/src/app/ai/ai-settings.ts` - Agregada configuración `aiService`
- `backend-api/src/app/ai/chat/DocLoveChatService.ts` - Migrado a ai-service
- `backend-api/src/domain/use-cases/chat/GenerateUserProfileFromChats.ts` - Migrado a ai-service
- `backend-api/src/app/ai/profile/UserAIProfileEmbeddingService.ts` - Migrado a ai-service

### Documentación
- `docs/auxiliar/MIGRATION_INVENTORY.md` - Inventario completo
- `docs/auxiliar/MIGRATION_PROGRESS.md` - Este archivo
