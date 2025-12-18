# FASE 1: Inventario Exacto de IA Activa en Backend

**Fecha:** 2025-01-XX  
**Objetivo:** Identificar todos los puntos donde se llama a LLMs en `backend-api` para migrarlos a `ai-service`

---

## 1. CHAT DOCLOVE

### 1.1 Flujo Principal

**Archivo:** `backend-api/src/domain/use-cases/chat/SendMessage.ts`

- **Línea 75-103:** Detecta si es conversación con DocLove y llama a `docLoveChatService.generateAndSaveReply()`
- **Punto de entrada:** Cuando un usuario envía un mensaje en una conversación con DocLove

### 1.2 Servicio de Chat DocLove

**Archivo:** `backend-api/src/app/ai/chat/DocLoveChatService.ts`

- **Línea 63-185:** Método `generateAndSaveReply()`
  - Construye el contexto (historial, user context, active matches)
  - **Línea 140:** **LLAMADA AL LLM** → `this.chatModel.generateChat(chatRequest)`
  - Guarda la respuesta como mensaje en la base de datos

### 1.3 Implementación del Modelo de Chat

**Archivo:** `backend-api/src/app/ai/core/providers/ChatModelOllama.ts`

- **Línea 38-81:** Método `generateChat()`
  - **Línea 51:** Construye el prompt usando `buildPrompt()` (línea 83-129)
  - **Línea 64:** **LLAMADA DIRECTA A OLLAMA** → `this.callOllamaAPI(prompt)`
  - **Línea 190-276:** `callOllamaAPI()` hace fetch a `${baseUrl}/api/generate`

### 1.4 Configuración

**Archivo:** `backend-api/src/app/ai/core/config.ts`
- **Línea 17-44:** `createChatModel()` instancia `ChatModelOllama` o `ChatModelOpenAI`

**Archivo:** `backend-api/src/app/index.ts`
- **Línea 122:** Se crea el `chatModel` usando `createChatModel()`
- **Línea 161:** Se pasa al `DocLoveChatService`

### 1.5 Prompts Utilizados

**Archivo:** `backend-api/src/app/ai/ai-settings.ts`
- **AIConfig.prompt.systemInstructions:** Prompt del sistema para DocLove (personalidad, estilo)

---

## 2. GENERACIÓN DE PERFIL (PROFILE GENERATION)

### 2.1 Flujo Principal - Use Case

**Archivo:** `backend-api/src/domain/use-cases/chat/GenerateUserProfileFromChats.ts`

- **Línea 40-265:** Método `execute()`
  - **Línea 141-142:** **LLAMADA AL LLM** → `this.summarizerModel.generateSummary(summarizerRequest)`
  - **Línea 145-149:** Guarda `summaryIncremental` en `user_ai_profiles.summary_incremental`
  - **Línea 181-184:** Si existe `summary` consolidado, llama a `mergeSummaries()`
  - **Línea 198-203:** Guarda el resultado del merge en `user_ai_profiles.summary` y limpia `summary_incremental`

### 2.2 Merge de Perfiles

**Archivo:** `backend-api/src/domain/use-cases/chat/GenerateUserProfileFromChats.ts`

- **Línea 380-401:** Método privado `mergeSummaries()`
  - **Línea 386-389:** Construye el prompt de merge usando `AIConfig.prompt.summarizerInstructions.mergeSummaries`
  - **Línea 392:** **LLAMADA DIRECTA A OLLAMA** → `this.callLLMForMerge(mergePrompt)`
  - **Línea 453-599:** `callLLMForMerge()` hace fetch a `${baseUrl}/api/generate` con parámetros específicos de merge

### 2.3 Implementación del Modelo Summarizer

**Archivo:** `backend-api/src/app/ai/core/providers/SummarizerModelOllama.ts`

- **Línea 45-104:** Método `generateSummary()`
  - **Línea 49:** Construye el prompt usando `buildPrompt()` (línea 106-305)
  - **Línea 68:** **LLAMADA DIRECTA A OLLAMA** → `this.callOllamaAPI(prompt)`
  - **Línea 306-503:** `callOllamaAPI()` hace fetch a `${baseUrl}/api/generate` con parámetros de summarization

### 2.4 Job Nocturno - Proceso 1 (Chats desde Wodates)

**Archivo:** `backend-api/scripts/jobs/process-user-profiles-job.ts`

- **Línea 1084-1151:** Procesa usuarios con mensajes no procesados
  - **Línea 1105:** Llama a `generateUserProfileFromChats.execute(userId)` (use case principal)
  - **Línea 1144:** Después de actualizar el summary, genera embedding: `embeddingService.generateEmbeddingFromSummary(userId)`

### 2.5 Job Nocturno - Proceso 2 (Chats Externos)

**Archivo:** `backend-api/scripts/jobs/process-user-profiles-job.ts`

- **Línea 737-848:** Función `processChatContent()`
  - **Línea 773:** **LLAMADA AL LLM** → `summarizerModel.generateSummary(summarizerRequest)`
  - **Línea 776-780:** Guarda `summaryIncremental`
  - **Línea 799-806:** **LLAMADA DIRECTA A OLLAMA** → `mergeSummaries()` (función helper, línea 612-625)
  - **Línea 843:** Genera embedding: `embeddingService.generateEmbeddingFromSummary(userId)`

### 2.6 Configuración

**Archivo:** `backend-api/src/app/ai/core/config.ts`
- **Línea 46-96:** `createSummarizerModel()` instancia `SummarizerModelOllama`

**Archivo:** `backend-api/src/app/index.ts`
- **Línea 123:** Se crea el `summarizerModel` usando `createSummarizerModel()`

### 2.7 Prompts Utilizados

**Archivo:** `backend-api/src/app/ai/ai-settings.ts`
- **AIConfig.prompt.summarizerInstructions.summarizerInstructions:** Prompt principal para generar perfiles
- **AIConfig.prompt.summarizerInstructions.mergeSummaries:** Prompt para merge de perfiles (línea 369-430)

---

## 3. EMBEDDINGS

### 3.1 Servicio de Embeddings

**Archivo:** `backend-api/src/app/ai/profile/UserAIProfileEmbeddingService.ts`

- **Línea 35-154:** Método `generateEmbeddingFromSummary()`
  - **Línea 45:** Lee `user_ai_profiles.summary` (NO `summary_incremental`)
  - **Línea 81-83:** **LLAMADA AL LLM** → `this.embeddingModel.generateEmbedding({ text: summaryText })`
  - **Línea 113-115:** Actualiza `user_ai_profiles.summary_embedding` con el vector generado

### 3.2 Implementación del Modelo de Embeddings

**Archivo:** `backend-api/src/app/ai/core/providers/EmbeddingModelOllama.ts`

- **Línea 52-108:** Método `generateEmbedding()`
  - **Línea 77:** Construye el payload con prefijo `passage:` (requerido por E5 models)
  - **Línea 80:** **LLAMADA DIRECTA A OLLAMA** → `this.callOllamaAPI(requestBody, controller)`
  - **Línea 126-167:** `callOllamaAPI()` hace fetch a `${baseUrl}/api/embeddings`
  - **Línea 172-219:** Valida que el embedding tenga exactamente 768 dimensiones

### 3.3 Job Nocturno - Generación de Embeddings

**Archivo:** `backend-api/scripts/jobs/process-user-profiles-job.ts`

- **Línea 1144:** Después de procesar chats, genera embedding si el summary cambió
- **Línea 843:** En el proceso 2 (chats externos), también genera embedding

### 3.4 Configuración

**Archivo:** `backend-api/src/app/ai/core/config.ts`
- **Línea 98-120:** `createEmbeddingModel()` instancia `EmbeddingModelOllama`

**Archivo:** `backend-api/src/app/index.ts`
- **Línea 124:** Se crea el `embeddingModel` usando `createEmbeddingModel()`

### 3.5 Origen de Datos

**CONFIRMADO:** Los embeddings se generan desde `user_ai_profiles.summary` (texto consolidado), NO desde `summary_incremental`.

**Evidencia:**
- `UserAIProfileEmbeddingService.generateEmbeddingFromSummary()` línea 45: `profileResult.data`
- Línea 65: Verifica `profile.summary` (no `summaryIncremental`)
- Línea 79: Usa `profile.summary` como texto fuente

---

## 4. RESUMEN DE PUNTOS DE SUSTITUCIÓN

### 4.1 Chat DocLove

| Componente | Archivo | Línea | Acción Requerida |
|------------|---------|-------|------------------|
| **Punto de llamada** | `DocLoveChatService.ts` | 140 | Sustituir `chatModel.generateChat()` por HTTP POST `/chat/generate` |
| **Implementación LLM** | `ChatModelOllama.ts` | 64, 190-276 | **ELIMINAR** llamada directa a Ollama |
| **Prompt** | `ai-settings.ts` | `AIConfig.prompt.systemInstructions` | **MANTENER** (se pasa como `system` en request) |

### 4.2 Generación de Perfil

| Componente | Archivo | Línea | Acción Requerida |
|------------|---------|-------|------------------|
| **Punto de llamada** | `GenerateUserProfileFromChats.ts` | 141-142 | Sustituir `summarizerModel.generateSummary()` por HTTP POST `/profile/generate` |
| **Implementación LLM** | `SummarizerModelOllama.ts` | 68, 306-503 | **ELIMINAR** llamada directa a Ollama |
| **Merge interno** | `GenerateUserProfileFromChats.ts` | 392, 453-599 | Sustituir `callLLMForMerge()` por HTTP POST `/profile/merge` |
| **Job Proceso 2** | `process-user-profiles-job.ts` | 773, 799 | Sustituir llamadas directas por HTTP |
| **Prompts** | `ai-settings.ts` | `AIConfig.prompt.summarizerInstructions.*` | **MANTENER** (se pasan en requests) |

### 4.3 Embeddings

| Componente | Archivo | Línea | Acción Requerida |
|------------|---------|-------|------------------|
| **Punto de llamada** | `UserAIProfileEmbeddingService.ts` | 81-83 | Sustituir `embeddingModel.generateEmbedding()` por HTTP POST `/embeddings/generate` |
| **Implementación LLM** | `EmbeddingModelOllama.ts` | 80, 126-167 | **ELIMINAR** llamada directa a Ollama |
| **Origen datos** | `UserAIProfileEmbeddingService.ts` | 45, 65, 79 | **CONFIRMADO:** Usa `user_ai_profiles.summary` |

---

## 5. ENDPOINTS DISPONIBLES EN AI-SERVICE

### 5.1 Chat

**Endpoint:** `POST /chat/generate`  
**Archivo:** `ai-service/app/api/chat.py`  
**Schema Request:** `GenerateChatRequest` (messages, system)  
**Schema Response:** `GenerateChatResponse` (content)

### 5.2 Profile

**Endpoint:** `POST /profile/generate`  
**Archivo:** `ai-service/app/api/profile.py`  
**Schema Request:** `GenerateProfileRequest` (conversations, main_user_marker)  
**Schema Response:** `GenerateProfileResponse` (profile)

**Endpoint:** `POST /profile/merge`  
**Archivo:** `ai-service/app/api/profile.py`  
**Schema Request:** `MergeProfilesRequest` (consolidated_profile, incremental_profile)  
**Schema Response:** `MergeProfilesResponse` (merged_profile)

### 5.3 Embeddings

**Endpoint:** `POST /embeddings/generate`  
**Archivo:** `ai-service/app/api/embeddings.py`  
**Schema Request:** `GenerateEmbeddingRequest` (text)  
**Schema Response:** `GenerateEmbeddingResponse` (embedding: list[float], dimension: 768)

---

## 6. NOTAS CRÍTICAS

### 6.1 Transformación de Datos

- **Chat:** El backend construye el prompt completo. En ai-service, debe pasar `messages` + `system` prompt.
- **Profile:** El backend transforma chats a `SummarizerRequest`. En ai-service, debe pasar `conversations` (formato diferente).
- **Merge:** El backend usa `AIConfig.prompt.summarizerInstructions.mergeSummaries`. En ai-service, solo pasa los dos perfiles.

### 6.2 Persistencia

- **NO cambiar:** Toda la lógica de persistencia permanece en el backend.
- **NO cambiar:** La estructura de tablas (`user_ai_profiles`) permanece igual.
- **NO cambiar:** La lógica de cuándo generar/mergear permanece en el backend.

### 6.3 Prompts

- Los prompts están en `ai-settings.ts` y se pasarán como parte de los requests HTTP.
- El ai-service ya tiene sus propios prompts internos, pero el backend puede sobrescribirlos si es necesario.

---

## 7. PRÓXIMOS PASOS (FASE 2)

1. Crear clientes HTTP en `backend-api/src/app/ai/clients/`:
   - `AiServiceChatClient.ts`
   - `AiServiceProfileClient.ts`
   - `AiServiceEmbeddingClient.ts`

2. Cada cliente debe:
   - Hacer HTTP POST al endpoint correspondiente
   - Transformar datos del formato backend al formato ai-service
   - Manejar errores básicos
   - NO contener lógica de negocio

3. Configurar URL base de ai-service vía env var: `AI_SERVICE_URL`
