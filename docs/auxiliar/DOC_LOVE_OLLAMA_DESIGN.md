# Diseño: Integración de Ollama como Proveedor Local de IA

## Contexto

- **Estado actual:** Ya existe arquitectura de AI providers con `OpenAIProvider` implementado
- **Objetivo:** Añadir `LocalOllamaProvider` para desarrollo local usando Ollama + phi3
- **Requisito:** Arquitectura debe permitir añadir OpenAI/Gemini después sin romper el dominio

## Análisis de la Estructura Actual

### ✅ Lo que ya existe y funciona:

1. **Interfaz `IAProvider`** (`backend-api/src/app/ai/providers/IAProvider.ts`)
   - Define contrato común para todos los providers
   - Método `generateReply(request: IAGenerateRequest): Promise<IAResponse>`

2. **`OpenAIProvider`** (`backend-api/src/app/ai/providers/OpenAIProvider.ts`)
   - Implementación completa de `IAProvider`
   - Construye prompts con contexto del usuario
   - Maneja llamadas a OpenAI API

3. **`AIService`** (`backend-api/src/app/ai/AIService.ts`)
   - Orquestador que abstrae detalles del provider
   - Maneja errores y logging
   - Usado por `DocLoveService`

4. **`config.ts`** (`backend-api/src/app/ai/config.ts`)
   - Factory que crea el provider según `AI_PROVIDER` env var
   - Actualmente solo soporta `openai`

5. **`DocLoveService`** (`backend-api/src/app/services/doc-love-service.ts`)
   - Detecta conversaciones con Doc Love
   - Obtiene historial y contexto
   - Llama a `AIService` y guarda respuesta

6. **Integración en `SendMessage`** (`backend-api/src/domain/use-cases/chat/SendMessage.ts`)
   - Ya detecta Doc Love y genera respuestas automáticas
   - No requiere cambios adicionales

7. **Inicialización en `app/index.ts`**
   - Ya crea `AIService` y `DocLoveService` al iniciar
   - Maneja errores gracefully (no falla startup si AI no está disponible)

## Diseño de la Integración de Ollama

### 1. Nuevo Provider: `LocalOllamaProvider`

**Ubicación:** `backend-api/src/app/ai/providers/LocalOllamaProvider.ts`

**Responsabilidades:**
- Implementar `IAProvider`
- Llamar a `http://localhost:11434/api/generate` (configurable)
- Manejar streaming de Ollama (reconstruir texto completo)
- Construir prompt compatible con formato de Ollama
- Usar modelo `phi3` por defecto (configurable)

**Características técnicas:**

1. **API de Ollama:**
   - Endpoint: `POST /api/generate`
   - Body: `{ "model": "phi3", "prompt": "...", "stream": true }`
   - Respuesta: Stream de JSON chunks con `{ "response": "...", "done": false }` hasta `{ "done": true }`

2. **Manejo de Streaming:**
   - Para MVP: reconstruir texto completo en backend
   - Leer todos los chunks hasta `done: true`
   - Concatenar `response` de cada chunk
   - Retornar texto completo una vez terminado

3. **Construcción de Prompt:**
   - Ollama usa formato de prompt simple (no tiene sistema/user/assistant separados)
   - Convertir historial de conversación a formato texto plano
   - Incluir contexto del usuario en el prompt inicial

**Estructura del archivo:**

```typescript
export class LocalOllamaProvider implements IAProvider {
  readonly name = 'ollama';
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl || 'http://localhost:11434';
    this.model = model || 'phi3';
  }

  async generateReply(request: IAGenerateRequest): Promise<IAResponse> {
    // 1. Construir prompt completo
    // 2. Llamar a Ollama API con streaming
    // 3. Reconstruir respuesta completa
    // 4. Retornar IAResponse
  }

  private buildPrompt(request: IAGenerateRequest): string {
    // Convertir historial + contexto a prompt de texto plano
  }

  private async callOllamaAPI(prompt: string): Promise<string> {
    // Manejar streaming y reconstruir texto
  }
}
```

### 2. Actualización de `config.ts`

**Ubicación:** `backend-api/src/app/ai/config.ts`

**Cambios necesarios:**

1. Importar `LocalOllamaProvider`
2. Añadir caso `'ollama'` en el switch
3. Cambiar default a `'ollama'` en desarrollo local (o mantener `'openai'` y documentar)
4. Leer variables de entorno:
   - `OLLAMA_URL` (default: `http://localhost:11434`)
   - `OLLAMA_MODEL` (default: `phi3`)

**Código propuesto:**

```typescript
export function createAIProvider(): IAProvider {
  // En desarrollo local, usar 'ollama' por defecto si no está especificado
  const defaultProvider = process.env.NODE_ENV === 'development' 
    ? 'ollama' 
    : 'openai';
  
  const providerName = process.env.AI_PROVIDER || defaultProvider;

  switch (providerName) {
    case 'ollama': {
      const baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      const model = process.env.OLLAMA_MODEL || 'phi3';
      return new LocalOllamaProvider(baseUrl, model);
    }

    case 'openai': {
      // ... código existente
    }

    default:
      throw new Error(
        `Unknown AI provider: ${providerName}. Supported: ollama, openai`
      );
  }
}
```

### 3. Variables de Entorno

**Nuevas variables necesarias:**

```bash
# AI Provider Configuration
AI_PROVIDER=ollama  # 'ollama' | 'openai' | 'gemini' (futuro)

# Ollama Configuration (solo si AI_PROVIDER=ollama)
OLLAMA_URL=http://localhost:11434  # Default
OLLAMA_MODEL=phi3                   # Default

# OpenAI Configuration (solo si AI_PROVIDER=openai)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

**Nota:** En desarrollo local, si `AI_PROVIDER` no está definido, usar `ollama` por defecto.

### 4. Manejo de Streaming de Ollama

**Estrategia MVP:**

1. Hacer request a Ollama con `stream: true`
2. Leer respuesta como stream de texto (NDJSON - Newline Delimited JSON)
3. Parsear cada línea como JSON
4. Acumular `response` de cada chunk
5. Cuando `done: true`, retornar texto completo

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

### 5. Construcción de Prompt para Ollama

**Diferencia clave:** Ollama no tiene roles separados (system/user/assistant), usa prompt de texto plano.

**Estrategia:**

1. Incluir instrucciones del sistema al inicio
2. Formatear historial como conversación:
   ```
   Usuario: [mensaje]
   Doc Love: [respuesta]
   ```
3. Añadir último mensaje del usuario
4. Indicar que Doc Love debe responder

**Ejemplo:**

```typescript
private buildPrompt(request: IAGenerateRequest): string {
  let prompt = `Eres Doc Love, un asistente de citas amigable y profesional...

Contexto del usuario:
- Nombre: ${request.userContext?.name || 'Usuario'}
- Bio: ${request.userContext?.bio || 'No disponible'}

Historial de conversación:
`;

  // Añadir historial
  for (const msg of request.conversationHistory) {
    const role = msg.role === 'assistant' ? 'Doc Love' : 'Usuario';
    prompt += `${role}: ${msg.content}\n`;
  }

  // Añadir último mensaje
  prompt += `\nUsuario: ${request.lastUserMessage}\n\nDoc Love: `;

  return prompt;
}
```

## Archivos a Crear/Modificar

### Archivos Nuevos:

1. **`backend-api/src/app/ai/providers/LocalOllamaProvider.ts`**
   - Implementación completa del provider Ollama
   - Manejo de streaming
   - Construcción de prompts

### Archivos a Modificar:

1. **`backend-api/src/app/ai/config.ts`**
   - Importar `LocalOllamaProvider`
   - Añadir caso `'ollama'` en switch
   - Cambiar default a `'ollama'` en desarrollo (opcional)

2. **`.env.example` o documentación**
   - Documentar nuevas variables `OLLAMA_URL` y `OLLAMA_MODEL`

## Flujo Completo con Ollama

```
Usuario envía mensaje a Doc Love
  ↓
SendMessage.execute() guarda mensaje del usuario ✅
  ↓
Detecta conversación con Doc Love
  ↓
DocLoveService.generateAndSaveReply()
  ├─ Obtiene historial (últimos 20 mensajes)
  ├─ Obtiene contexto del usuario (opcional)
  ├─ Construye IAGenerateRequest
  ├─ Llama a AIService.generateReply()
  │  └─ AIService → LocalOllamaProvider.generateReply()
  │     ├─ Construye prompt de texto plano
  │     ├─ Llama a http://localhost:11434/api/generate
  │     ├─ Maneja streaming (reconstruye texto completo)
  │     └─ Retorna IAResponse con contenido
  ├─ Recibe respuesta de IA
  └─ Guarda respuesta como mensaje de Doc Love ✅
  ↓
Frontend recibe respuesta (polling/suscripción)
  └─ Renderiza mensaje normalmente
```

## Consideraciones de Implementación

### 1. Manejo de Errores

- **Ollama no disponible:** Si `localhost:11434` no responde, `LocalOllamaProvider` debe lanzar error claro
- **Timeout:** Considerar timeout de 30-60 segundos para requests a Ollama
- **Streaming interrumpido:** Manejar caso donde stream se corta antes de `done: true`

### 2. Logging

- Loggear cuando se usa Ollama (provider name)
- Loggear tiempo de respuesta
- No loggear contenido completo de mensajes (privacidad)

### 3. Testing

- Mock de fetch para tests unitarios
- Tests de integración con Ollama real (opcional, solo en desarrollo)
- Verificar que streaming se maneja correctamente

### 4. Extensibilidad Futura

**Para añadir OpenAI después:**
- ✅ Ya existe `OpenAIProvider`
- ✅ Solo cambiar `AI_PROVIDER=openai` en `.env`
- ✅ No requiere cambios en `DocLoveService` ni `SendMessage`

**Para añadir Gemini después:**
- Crear `GeminiProvider` implementando `IAProvider`
- Añadir caso en `config.ts`
- Cambiar `AI_PROVIDER=gemini` en `.env`
- ✅ Sin tocar `DocLoveService`, `SendMessage`, ni otros providers

## Ventajas de esta Arquitectura

✅ **Desacoplada:** `DocLoveService` no sabe si usa Ollama u OpenAI  
✅ **Extensible:** Añadir providers sin modificar dominio  
✅ **KISS:** Implementación simple, sin sobre-ingeniería  
✅ **Desarrollo local:** Ollama permite desarrollo sin costos de API  
✅ **Producción:** Fácil cambiar a OpenAI/Gemini cuando sea necesario  

## Resumen de Cambios

### Crear:
- `backend-api/src/app/ai/providers/LocalOllamaProvider.ts`

### Modificar:
- `backend-api/src/app/ai/config.ts` (añadir caso `ollama`)

### Configurar:
- Variables de entorno: `AI_PROVIDER`, `OLLAMA_URL`, `OLLAMA_MODEL`

### No modificar:
- ✅ `DocLoveService` (ya funciona con cualquier provider)
- ✅ `AIService` (ya abstrae providers)
- ✅ `SendMessage` (ya integrado)
- ✅ `OpenAIProvider` (sigue funcionando igual)
- ✅ Frontend (no requiere cambios)

## Próximos Pasos

1. ✅ **Análisis y diseño** (este documento)
2. ⏳ **Implementación:**
   - Crear `LocalOllamaProvider.ts`
   - Actualizar `config.ts`
   - Probar con Ollama local
3. ⏳ **Testing:**
   - Tests unitarios del provider
   - Verificar integración end-to-end
4. ⏳ **Documentación:**
   - Actualizar `.env.example`
   - Documentar setup de Ollama

