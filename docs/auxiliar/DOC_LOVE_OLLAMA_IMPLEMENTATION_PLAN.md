# Plan de Implementación: Ollama Provider para Doc Love

## 📍 Ubicaciones Exactas en el Código

### Estructura Actual del Módulo AI

```
backend-api/src/app/ai/
├── AIService.ts                    ✅ Ya existe - No modificar
├── config.ts                       ✏️ MODIFICAR - Añadir caso 'ollama'
└── providers/
    ├── IAProvider.ts               ✅ Ya existe - No modificar
    └── OpenAIProvider.ts           ✅ Ya existe - No modificar
```

### Archivo Nuevo a Crear

```
backend-api/src/app/ai/providers/LocalOllamaProvider.ts  🆕 CREAR
```

## 🔍 Análisis de Archivos Existentes

### 1. `backend-api/src/app/ai/providers/IAProvider.ts`

**Estado:** ✅ No modificar

**Contenido relevante:**
```typescript
export interface IAProvider {
  generateReply(request: IAGenerateRequest): Promise<IAResponse>;
  readonly name: string;
}
```

**Uso:** `LocalOllamaProvider` debe implementar esta interfaz.

### 2. `backend-api/src/app/ai/providers/OpenAIProvider.ts`

**Estado:** ✅ No modificar (referencia para implementación)

**Estructura de referencia:**
- Constructor recibe configuración (apiKey, model)
- `generateReply()` implementa la lógica principal
- Métodos privados para construir prompts
- Manejo de errores

**Aplicar mismo patrón en `LocalOllamaProvider`.**

### 3. `backend-api/src/app/ai/config.ts`

**Estado:** ✏️ MODIFICAR

**Ubicación actual:** Líneas 1-44

**Cambios necesarios:**

```typescript
// ANTES (línea 2):
import { OpenAIProvider } from './providers/OpenAIProvider';

// DESPUÉS:
import { OpenAIProvider } from './providers/OpenAIProvider';
import { LocalOllamaProvider } from './providers/LocalOllamaProvider';

// ANTES (línea 15):
const providerName = process.env.AI_PROVIDER || 'openai';

// DESPUÉS:
const defaultProvider = process.env.NODE_ENV === 'development' 
  ? 'ollama' 
  : 'openai';
const providerName = process.env.AI_PROVIDER || defaultProvider;

// ANTES (línea 17):
switch (providerName) {
  case 'openai': { ... }
  default: throw new Error(...)
}

// DESPUÉS:
switch (providerName) {
  case 'ollama': {
    const baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'phi3';
    return new LocalOllamaProvider(baseUrl, model);
  }
  case 'openai': { ... }
  default: throw new Error(
    `Unknown AI provider: ${providerName}. Supported: ollama, openai`
  );
}
```

### 4. `backend-api/src/app/ai/AIService.ts`

**Estado:** ✅ No modificar

**Razón:** Ya abstrae cualquier provider que implemente `IAProvider`. `LocalOllamaProvider` funcionará automáticamente.

### 5. `backend-api/src/app/services/doc-love-service.ts`

**Estado:** ✅ No modificar

**Razón:** Ya usa `AIService`, que abstrae el provider. No necesita saber si es Ollama u OpenAI.

**Línea relevante:** 112
```typescript
const aiResponseResult = await this.aiService.generateReply(aiRequest);
```

### 6. `backend-api/src/domain/use-cases/chat/SendMessage.ts`

**Estado:** ✅ No modificar

**Razón:** Ya está integrado con `DocLoveService`. Funciona con cualquier provider.

**Líneas relevantes:** 58-90 (ya detecta Doc Love y genera respuestas)

### 7. `backend-api/src/app/index.ts`

**Estado:** ✅ No modificar

**Razón:** Ya inicializa `AIService` y `DocLoveService` correctamente. El factory `createAIProvider()` se encargará de crear el provider correcto según configuración.

**Líneas relevantes:** 95-107

## 📝 Implementación de `LocalOllamaProvider.ts`

### Estructura del Archivo

```typescript
import {
  IAProvider,
  IAResponse,
  IAGenerateRequest,
} from './IAProvider';

export class LocalOllamaProvider implements IAProvider {
  readonly name = 'ollama';
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl || 'http://localhost:11434';
    this.model = model || 'phi3';
  }

  async generateReply(request: IAGenerateRequest): Promise<IAResponse> {
    // 1. Construir prompt
    // 2. Llamar a Ollama API
    // 3. Manejar streaming
    // 4. Retornar respuesta
  }

  private buildPrompt(request: IAGenerateRequest): string {
    // Convertir historial a formato texto plano
  }

  private async callOllamaAPI(prompt: string): Promise<string> {
    // Manejar streaming y reconstruir texto
  }
}
```

### Detalles de Implementación

#### 1. Construcción de Prompt

**Diferencia con OpenAI:**
- OpenAI usa roles separados: `system`, `user`, `assistant`
- Ollama usa prompt de texto plano

**Estrategia:**
```typescript
private buildPrompt(request: IAGenerateRequest): string {
  // Sistema
  let prompt = `Eres Doc Love, un asistente de citas...
  
Contexto:
- Usuario: ${request.userContext?.name || 'Usuario'}
- Bio: ${request.userContext?.bio || 'No disponible'}

Conversación:
`;

  // Historial
  for (const msg of request.conversationHistory) {
    const role = msg.role === 'assistant' ? 'Doc Love' : 'Usuario';
    prompt += `${role}: ${msg.content}\n`;
  }

  // Último mensaje
  prompt += `\nUsuario: ${request.lastUserMessage}\n\nDoc Love: `;

  return prompt;
}
```

#### 2. Llamada a Ollama API

**Endpoint:** `POST {baseUrl}/api/generate`

**Body:**
```json
{
  "model": "phi3",
  "prompt": "...",
  "stream": true
}
```

**Respuesta:** Stream de JSON chunks (NDJSON)
```
{"response": "Hola", "done": false}
{"response": " cómo", "done": false}
{"response": " estás?", "done": true}
```

#### 3. Manejo de Streaming

**Estrategia MVP:**
- Leer todos los chunks hasta `done: true`
- Acumular `response` de cada chunk
- Retornar texto completo

**Implementación:**
```typescript
private async callOllamaAPI(prompt: string): Promise<string> {
  const response = await fetch(`${this.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: this.model,
      prompt: prompt,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';

  if (!reader) {
    throw new Error('Failed to get response reader');
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const json = JSON.parse(line);
        if (json.response) {
          fullResponse += json.response;
        }
        if (json.done) {
          return fullResponse;
        }
      } catch (e) {
        // Ignore malformed JSON lines
      }
    }
  }

  return fullResponse;
}
```

## 🔧 Configuración

### Variables de Entorno

**Archivo:** `.env` o `.env.local`

```bash
# AI Provider (default: 'ollama' en desarrollo, 'openai' en producción)
AI_PROVIDER=ollama

# Ollama Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=phi3

# OpenAI Configuration (solo si AI_PROVIDER=openai)
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini
```

### Verificación de Ollama

**Antes de iniciar el backend:**
```bash
# Verificar que Ollama está corriendo
curl http://localhost:11434/api/tags

# Verificar que phi3 está disponible
curl http://localhost:11434/api/show -d '{"name": "phi3"}'
```

## ✅ Checklist de Implementación

### Fase 1: Crear Provider
- [ ] Crear `backend-api/src/app/ai/providers/LocalOllamaProvider.ts`
- [ ] Implementar `IAProvider` interface
- [ ] Implementar `buildPrompt()` (formato texto plano)
- [ ] Implementar `callOllamaAPI()` (con streaming)
- [ ] Manejar errores y timeouts

### Fase 2: Integrar en Config
- [ ] Importar `LocalOllamaProvider` en `config.ts`
- [ ] Añadir caso `'ollama'` en switch
- [ ] Leer `OLLAMA_URL` y `OLLAMA_MODEL` de env vars
- [ ] Actualizar mensaje de error con providers soportados

### Fase 3: Configuración
- [ ] Añadir variables de entorno a `.env`
- [ ] Verificar que Ollama está corriendo localmente
- [ ] Verificar que modelo `phi3` está disponible

### Fase 4: Testing
- [ ] Test unitario: `buildPrompt()` genera formato correcto
- [ ] Test unitario: `callOllamaAPI()` maneja streaming correctamente
- [ ] Test de integración: Enviar mensaje a Doc Love y verificar respuesta
- [ ] Verificar que mensajes se guardan en BBDD correctamente

### Fase 5: Documentación
- [ ] Actualizar `.env.example` con nuevas variables
- [ ] Documentar setup de Ollama en README
- [ ] Verificar que documentación de arquitectura está actualizada

## 🚨 Puntos de Atención

### 1. Streaming de Ollama
- **Importante:** Ollama devuelve chunks, no respuesta completa
- **Solución:** Acumular `response` hasta `done: true`
- **Edge case:** ¿Qué pasa si stream se corta? Manejar timeout

### 2. Formato de Prompt
- **Diferencia clave:** Ollama no usa roles separados
- **Solución:** Convertir historial a formato texto plano
- **Consideración:** Mantener contexto del sistema al inicio

### 3. Errores de Conexión
- **Escenario:** Ollama no está corriendo en `localhost:11434`
- **Solución:** Error claro en logs, no fallar startup del backend
- **Ya implementado:** `app/index.ts` maneja errores gracefully (líneas 108-113)

### 4. Timeout
- **Consideración:** Ollama puede tardar varios segundos
- **Solución:** Configurar timeout razonable (30-60s)
- **Implementación:** Usar `AbortController` con timeout

## 📊 Flujo de Datos Completo

```
┌─────────────────────────────────────────────────────────┐
│ Usuario envía mensaje en mobile-app                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ POST /api/v1/chats/:matchId/messages                    │
│ (ChatController.sendMessage)                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ SendMessage.execute()                                    │
│ - Valida match                                           │
│ - Guarda mensaje del usuario ✅                          │
│ - Detecta Doc Love                                      │
└────────────────────┬────────────────────────────────────┘
                     │ (si es Doc Love)
                     ▼
┌─────────────────────────────────────────────────────────┐
│ DocLoveService.generateAndSaveReply()                    │
│ - Obtiene historial (últimos 20 mensajes)               │
│ - Obtiene contexto del usuario                          │
│ - Construye IAGenerateRequest                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ AIService.generateReply()                               │
│ - Llama a provider.generateReply()                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ LocalOllamaProvider.generateReply() 🆕                   │
│ - buildPrompt() → texto plano                           │
│ - callOllamaAPI() → POST localhost:11434/api/generate   │
│ - Maneja streaming → reconstruye texto                   │
│ - Retorna IAResponse                                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ DocLoveService                                           │
│ - Recibe IAResponse                                      │
│ - Guarda como mensaje de Doc Love ✅                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Frontend recibe respuesta (polling/suscripción)          │
│ - Renderiza mensaje normalmente ✅                       │
└─────────────────────────────────────────────────────────┘
```

## 🎯 Resumen Ejecutivo

**Archivos a crear:** 1
- `backend-api/src/app/ai/providers/LocalOllamaProvider.ts`

**Archivos a modificar:** 1
- `backend-api/src/app/ai/config.ts`

**Archivos que NO se tocan:** Todos los demás
- `DocLoveService`, `AIService`, `SendMessage`, `OpenAIProvider`, etc.

**Configuración:** Variables de entorno
- `AI_PROVIDER=ollama`
- `OLLAMA_URL=http://localhost:11434`
- `OLLAMA_MODEL=phi3`

**Resultado:** Doc Love funcionará con Ollama local, manteniendo arquitectura extensible para OpenAI/Gemini.

