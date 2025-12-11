# Arquitectura: Doc Love como Chatbot de IA

## 1. Análisis de la Estructura Actual

### 1.1 Estructura del Backend

```
backend-api/src/
├── app/                    # Capa de aplicación (HTTP, controllers, routes)
│   ├── controllers/       # Controladores HTTP
│   ├── routes/            # Definición de rutas
│   ├── services/          # Servicios de aplicación
│   └── middleware/        # Middleware (auth, etc.)
├── domain/                # Capa de dominio (lógica de negocio)
│   ├── entities/          # Entidades del dominio
│   ├── use-cases/         # Casos de uso
│   ├── repositories/     # Interfaces de repositorios
│   └── errors/            # Errores del dominio
└── data/                  # Capa de datos (implementaciones)
    └── repositories/      # Implementaciones de repositorios (Supabase)
```

### 1.2 Flujo Actual de Mensajes

**Frontend → Backend:**
1. Usuario escribe mensaje en `mobile-app/app/chat/[matchId].tsx`
2. Llama a `ChatApi.sendMessage()` → `POST /api/v1/chats/:matchId/messages`
3. `ChatController.sendMessage()` → `SendMessage.execute()`
4. `SendMessage` valida match y crea mensaje → `MessageRepository.create()`
5. Mensaje se guarda en tabla `messages` (Supabase)

**Backend → Frontend:**
- Frontend hace polling cada 5 segundos con `chatApi.getMessages()`
- O usa suscripciones en tiempo real (si están implementadas)

### 1.3 Estructura de Datos

**Tabla `messages`:**
- `id` (uuid)
- `chat_id` (uuid) - referencia a `chats.id`
- `sender_id` (uuid) - referencia a `users.id`
- `content` (text)
- `created_at` (timestamptz)

**Tabla `chats`:**
- `id` (uuid)
- `created_at` (timestamptz)

**Tabla `chat_participants`:**
- `chat_id` (uuid)
- `user_id` (uuid)
- `last_read_message_id` (uuid, nullable)
- `joined_at` (timestamptz)

**Entidad `Match`:**
- `id` (uuid)
- `userId1` (uuid)
- `userId2` (uuid)
- `createdAt` (ISO string)

### 1.4 Doc Love Actual

- **Email:** `doclove@wodates.com` (configurable via `DOC_LOVE_EMAIL`)
- **Helper:** `DocLoveHelper.getDocLoveUserId()` obtiene el UUID de Doc Love
- **Identificación:** Doc Love tiene `is_bot = TRUE` en `public.users`
- **Detección:** Un match es con Doc Love si `match.userId1 === docLoveId || match.userId2 === docLoveId`

---

## 2. Arquitectura Propuesta

### 2.1 Principios de Diseño

1. **Separación de Responsabilidades:**
   - Capa de dominio Doc Love: detecta conversaciones con Doc Love, orquesta la generación de respuestas
   - Capa de proveedores de IA: abstrae los detalles de cada proveedor (OpenAI, Gemini, etc.)
   - Capa de servicio de IA: selecciona el proveedor según configuración

2. **Extensibilidad:**
   - Añadir un nuevo proveedor solo requiere:
     - Implementar la interfaz `IAProvider`
     - Registrar el proveedor en la configuración
     - Sin modificar el dominio de Doc Love

3. **KISS:**
   - No sobre-ingeniería
   - Reutilizar infraestructura existente (repositorios, use cases)

### 2.2 Estructura de Carpetas Propuesta

```
backend-api/src/
├── app/
│   ├── services/
│   │   ├── doc-love-helper.ts          # ✅ Ya existe
│   │   └── doc-love-service.ts         # 🆕 Servicio de aplicación para Doc Love
│   │
│   └── ai/                             # 🆕 Módulo de proveedores de IA
│       ├── providers/
│       │   ├── IAProvider.ts           # 🆕 Interfaz/contrato base
│       │   ├── OpenAIProvider.ts       # 🆕 Implementación OpenAI
│       │   └── GeminiProvider.ts        # 🆕 Stub para futuro (opcional)
│       │
│       ├── AIService.ts                 # 🆕 Orquestador de proveedores
│       └── config.ts                    # 🆕 Configuración de proveedores
│
└── domain/
    └── use-cases/
        └── chat/
            ├── SendMessage.ts           # ✅ Ya existe - MODIFICAR para detectar Doc Love
            └── GenerateDocLoveReply.ts  # 🆕 Caso de uso para generar respuesta (opcional)
```

### 2.3 Interfaces y Contratos

#### 2.3.1 Interfaz `IAProvider`

```typescript
// backend-api/src/app/ai/providers/IAProvider.ts

export interface IAResponse {
  content: string;
  provider: string;
  model?: string;
  tokensUsed?: number;
}

export interface IAMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface IAGenerateRequest {
  userId: string;
  docLoveUserId: string;
  conversationHistory: IAMessage[];
  lastUserMessage: string;
  userContext?: {
    name?: string;
    bio?: string;
    preferences?: any;
  };
  activeMatches?: Array<{
    matchId: string;
    otherUserName: string;
    lastMessage?: string;
  }>;
}

export interface IAProvider {
  /**
   * Genera una respuesta de IA basada en el contexto de la conversación
   * 
   * @param request - Contexto completo de la conversación y usuario
   * @returns Respuesta generada por la IA
   */
  generateReply(request: IAGenerateRequest): Promise<IAResponse>;
  
  /**
   * Nombre del proveedor (para logging y debugging)
   */
  readonly name: string;
}
```

#### 2.3.2 Servicio de IA (`AIService`)

```typescript
// backend-api/src/app/ai/AIService.ts

export class AIService {
  constructor(
    private provider: IAProvider,
    private logger?: any
  ) {}

  async generateReply(request: IAGenerateRequest): Promise<Result<IAResponse, DomainError>> {
    try {
      const response = await this.provider.generateReply(request);
      return success(response);
    } catch (error) {
      return failure(new InternalError('Failed to generate AI reply', error));
    }
  }
}
```

#### 2.3.3 Servicio de Doc Love (`DocLoveService`)

```typescript
// backend-api/src/app/services/doc-love-service.ts

export class DocLoveService {
  constructor(
    private docLoveHelper: DocLoveHelper,
    private aiService: AIService,
    private messageRepository: MessageRepository,
    private matchRepository: MatchRepository
  ) {}

  /**
   * Detecta si un match es con Doc Love
   */
  async isDocLoveConversation(matchId: string): Promise<Result<boolean, DomainError>>;

  /**
   * Genera y guarda una respuesta de Doc Love
   */
  async generateAndSaveReply(
    matchId: string,
    userId: string,
    userMessage: Message
  ): Promise<Result<Message, DomainError>>;

  /**
   * Obtiene el historial de conversación formateado para la IA
   */
  private async getConversationHistory(
    matchId: string,
    limit?: number
  ): Promise<Result<IAMessage[], DomainError>>;
}
```

---

## 3. Flujo de Datos Propuesto

### 3.1 Flujo Principal: Usuario envía mensaje a Doc Love

```
1. Usuario escribe mensaje en frontend
   ↓
2. POST /api/v1/chats/:matchId/messages
   ↓
3. ChatController.sendMessage()
   ↓
4. SendMessage.execute()
   ├─ Valida match
   ├─ Guarda mensaje del usuario en BBDD ✅
   └─ Detecta si es conversación con Doc Love
      ↓ (si es Doc Love)
5. DocLoveService.generateAndSaveReply()
   ├─ Obtiene historial de conversación
   ├─ Obtiene contexto del usuario (opcional)
   ├─ Obtiene matches activos del usuario (opcional)
   ├─ Llama a AIService.generateReply()
   │  └─ AIService selecciona provider según config
   │     └─ OpenAIProvider.generateReply()
   │        └─ Llama a OpenAI API
   ├─ Recibe respuesta de IA
   └─ Guarda respuesta como mensaje de Doc Love en BBDD ✅
   ↓
6. Frontend recibe respuesta (polling o suscripción)
   └─ Renderiza mensaje normalmente
```

### 3.2 Integración en `SendMessage` Use Case

**Opción A: Modificar `SendMessage` directamente (más simple)**
- Después de guardar el mensaje del usuario, detectar si es Doc Love
- Si es Doc Love, llamar a `DocLoveService.generateAndSaveReply()`
- Ventaja: Todo en un solo lugar
- Desventaja: Acopla el caso de uso con Doc Love

**Opción B: Hook/Event después de crear mensaje (más desacoplado)**
- `SendMessage` guarda el mensaje
- Dispara un evento o hook
- `DocLoveService` escucha el evento y procesa si aplica
- Ventaja: Desacoplado, extensible
- Desventaja: Más complejo para un equipo de 1 persona

**Recomendación: Opción A** (KISS principle)

### 3.3 Detección de Conversación con Doc Love

```typescript
// En SendMessage.execute() o DocLoveService

const match = matchResult.data;
const docLoveId = await docLoveHelper.getDocLoveUserId();

const isDocLoveConversation = 
  (match.userId1 === docLoveId && match.userId2 === senderId) ||
  (match.userId1 === senderId && match.userId2 === docLoveId);
```

---

## 4. Implementación de Proveedores

### 4.1 OpenAI Provider (Primera Implementación)

```typescript
// backend-api/src/app/ai/providers/OpenAIProvider.ts

import OpenAI from 'openai';
import { IAProvider, IAResponse, IAGenerateRequest } from './IAProvider';

export class OpenAIProvider implements IAProvider {
  readonly name = 'openai';
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateReply(request: IAGenerateRequest): Promise<IAResponse> {
    // Construir mensajes para OpenAI
    const messages = this.buildMessages(request);
    
    // Llamar a OpenAI
    const completion = await this.client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = completion.choices[0]?.message?.content || '';
    
    return {
      content,
      provider: this.name,
      model: completion.model,
      tokensUsed: completion.usage?.total_tokens,
    };
  }

  private buildMessages(request: IAGenerateRequest): Array<{role: string, content: string}> {
    const systemPrompt = this.buildSystemPrompt(request);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...request.conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    ];
    return messages;
  }

  private buildSystemPrompt(request: IAGenerateRequest): string {
    // Construir prompt del sistema con contexto del usuario
    // Incluir información sobre matches activos, preferencias, etc.
    return `Eres Doc Love, un asistente de citas amigable y profesional...`;
  }
}
```

### 4.2 Configuración de Proveedores

```typescript
// backend-api/src/app/ai/config.ts

import { IAProvider } from './providers/IAProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
// import { GeminiProvider } from './providers/GeminiProvider'; // Futuro

export function createAIProvider(): IAProvider {
  const providerName = process.env.AI_PROVIDER || 'openai';
  
  switch (providerName) {
    case 'openai':
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required');
      }
      return new OpenAIProvider(apiKey);
    
    // case 'gemini':
    //   return new GeminiProvider(process.env.GEMINI_API_KEY!);
    
    default:
      throw new Error(`Unknown AI provider: ${providerName}`);
  }
}
```

### 4.3 Variables de Entorno Necesarias

```bash
# .env

# AI Provider Configuration
AI_PROVIDER=openai  # 'openai' | 'gemini' (futuro)

# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini  # o gpt-4, gpt-3.5-turbo, etc.

# Doc Love (ya existe)
DOC_LOVE_EMAIL=doclove@wodates.com
```

---

## 5. Formato del Historial de Conversación

### 5.1 Transformación de Mensajes a Formato IA

```typescript
// En DocLoveService.getConversationHistory()

async getConversationHistory(
  matchId: string,
  limit: number = 20
): Promise<Result<IAMessage[], DomainError>> {
  // Obtener mensajes del repositorio
  const messagesResult = await this.messageRepository.findByMatchId(matchId, limit);
  if (!messagesResult.success) {
    return failure(messagesResult.error);
  }

  const docLoveId = await this.docLoveHelper.getDocLoveUserId();
  
  // Transformar a formato IA
  const history: IAMessage[] = messagesResult.data.map(msg => ({
    role: msg.senderId === docLoveId ? 'assistant' : 'user',
    content: msg.content,
  }));

  return success(history);
}
```

### 5.2 Contexto Adicional para la IA

**Información del usuario:**
- Nombre, bio, preferencias (desde `public.users`)
- Tipo de relación buscada (desde `preferences` o `looking_for`)

**Matches activos:**
- Máximo 3 matches activos (excluyendo Doc Love)
- Nombre del otro usuario, último mensaje intercambiado

**Ejemplo de prompt del sistema:**
```
Eres Doc Love, un asistente de citas amigable y profesional que ayuda a los usuarios a encontrar relaciones serias y duraderas.

El usuario se llama [nombre] y está buscando [tipo de relación]. Su bio dice: [bio].

Actualmente tiene [N] conversaciones activas:
- Con [nombre1]: último mensaje sobre [tema]
- Con [nombre2]: último mensaje sobre [tema]

Responde de manera empática, profesional y útil. Ayuda al usuario a reflexionar sobre sus relaciones y a comunicarse mejor.
```

---

## 6. Manejo de Errores

### 6.1 Errores de Proveedor de IA

- **Timeout:** Si la IA tarda > 30s, retornar error
- **Rate limit:** Retornar error específico, no guardar mensaje de Doc Love
- **API error:** Loggear error, retornar mensaje genérico o fallback

### 6.2 Fallback Strategy

Si la IA falla:
1. Loggear el error
2. **NO** guardar un mensaje de Doc Love (mejor silencio que error)
3. El usuario puede seguir escribiendo
4. Opcional: Notificar al usuario que Doc Love está temporalmente no disponible

---

## 7. Testing

### 7.1 Tests Unitarios

- `OpenAIProvider.test.ts`: Mock de OpenAI SDK
- `DocLoveService.test.ts`: Mock de repositorios y AI service
- `AIService.test.ts`: Mock de provider

### 7.2 Tests de Integración

- End-to-end: Enviar mensaje a Doc Love → Verificar respuesta guardada
- Verificar que mensajes normales (no Doc Love) no disparan IA

---

## 8. Plan de Implementación

### Fase 1: Estructura Base
1. ✅ Crear carpeta `backend-api/src/app/ai/`
2. ✅ Crear interfaz `IAProvider`
3. ✅ Crear `AIService` (orquestador)
4. ✅ Crear `config.ts` para selección de proveedor

### Fase 2: OpenAI Provider
1. ✅ Instalar `openai` package
2. ✅ Implementar `OpenAIProvider`
3. ✅ Implementar construcción de prompts
4. ✅ Tests unitarios básicos

### Fase 3: Doc Love Service
1. ✅ Crear `DocLoveService`
2. ✅ Implementar detección de conversación con Doc Love
3. ✅ Implementar obtención de historial
4. ✅ Implementar generación y guardado de respuesta

### Fase 4: Integración
1. ✅ Modificar `SendMessage` para detectar Doc Love
2. ✅ Integrar `DocLoveService` en el flujo
3. ✅ Configurar variables de entorno
4. ✅ Tests de integración

### Fase 5: Frontend (Verificación)
1. ✅ Verificar que mensajes de Doc Love se renderizan correctamente
2. ✅ Verificar que no se rompe nada existente
3. ✅ Verificar polling/suscripciones funcionan

### Fase 6: Documentación y Deploy
1. ✅ Documentar variables de entorno
2. ✅ Actualizar README
3. ✅ Deploy y verificación en producción

---

## 9. Extensibilidad: Añadir Gemini (Ejemplo Futuro)

### 9.1 Crear `GeminiProvider`

```typescript
// backend-api/src/app/ai/providers/GeminiProvider.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import { IAProvider, IAResponse, IAGenerateRequest } from './IAProvider';

export class GeminiProvider implements IAProvider {
  readonly name = 'gemini';
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateReply(request: IAGenerateRequest): Promise<IAResponse> {
    const model = this.client.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = this.buildPrompt(request);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    return {
      content,
      provider: this.name,
      model: 'gemini-pro',
    };
  }

  private buildPrompt(request: IAGenerateRequest): string {
    // Construir prompt para Gemini
    // ...
  }
}
```

### 9.2 Actualizar Configuración

```typescript
// backend-api/src/app/ai/config.ts

import { GeminiProvider } from './providers/GeminiProvider';

export function createAIProvider(): IAProvider {
  const providerName = process.env.AI_PROVIDER || 'openai';
  
  switch (providerName) {
    case 'openai':
      // ...
    case 'gemini':
      return new GeminiProvider(process.env.GEMINI_API_KEY!);
    default:
      throw new Error(`Unknown AI provider: ${providerName}`);
  }
}
```

### 9.3 Cambiar Proveedor

Solo cambiar variable de entorno:
```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=...
```

**Sin modificar:**
- ✅ `DocLoveService`
- ✅ `SendMessage` use case
- ✅ Controllers
- ✅ Frontend

---

## 10. Consideraciones de Seguridad

1. **API Keys:** Nunca exponer en frontend, solo en backend
2. **Rate Limiting:** Aplicar rate limits a endpoints que usan IA
3. **Validación:** Validar contenido de mensajes antes de enviar a IA
4. **Sanitización:** Sanitizar respuestas de IA antes de guardar
5. **Logging:** No loggear contenido completo de mensajes (privacidad)

---

## 11. Métricas y Monitoreo

- Tiempo de respuesta de IA
- Tasa de errores de proveedores
- Tokens consumidos (costos)
- Satisfacción del usuario (futuro)

---

## 12. Resumen de Archivos a Crear/Modificar

### Archivos Nuevos:
- `backend-api/src/app/ai/providers/IAProvider.ts`
- `backend-api/src/app/ai/providers/OpenAIProvider.ts`
- `backend-api/src/app/ai/providers/GeminiProvider.ts` (stub opcional)
- `backend-api/src/app/ai/AIService.ts`
- `backend-api/src/app/ai/config.ts`
- `backend-api/src/app/services/doc-love-service.ts`

### Archivos a Modificar:
- `backend-api/src/domain/use-cases/chat/SendMessage.ts` - Añadir detección Doc Love
- `backend-api/src/app/index.ts` - Inicializar servicios de IA
- `backend-api/src/app/controllers/chat-controller.ts` - (posiblemente, si necesitamos cambios)
- `backend-api/package.json` - Añadir dependencia `openai`

### Archivos de Configuración:
- `.env.example` - Documentar nuevas variables
- `README.md` - Actualizar con instrucciones

---

## 13. Próximos Pasos

Cuando estés listo para implementar:

1. Revisar y aprobar esta arquitectura
2. Crear los archivos base (estructura de carpetas)
3. Implementar `OpenAIProvider` primero
4. Implementar `DocLoveService`
5. Integrar en `SendMessage`
6. Testing
7. Deploy

**Nota:** Esta arquitectura está diseñada para ser extensible sin romper código existente. Añadir un segundo proveedor solo requiere implementar `IAProvider` y actualizar la configuración.

