# Resumen Ejecutivo: Doc Love como Chatbot de IA

## Objetivo

Convertir Doc Love de un usuario humano a un chatbot de IA que responda automáticamente a los mensajes de los usuarios.

## Arquitectura Propuesta

### Estructura de Carpetas

```
backend-api/src/app/
├── services/
│   └── doc-love-service.ts         # 🆕 Servicio principal de Doc Love
└── ai/                             # 🆕 Módulo de proveedores de IA
    ├── providers/
    │   ├── IAProvider.ts           # 🆕 Interfaz base
    │   ├── OpenAIProvider.ts       # 🆕 Implementación OpenAI
    │   └── GeminiProvider.ts       # 🆕 Stub futuro (opcional)
    ├── AIService.ts                 # 🆕 Orquestador
    └── config.ts                    # 🆕 Configuración
```

### Flujo de Datos

```
Usuario envía mensaje
  ↓
SendMessage.execute() guarda mensaje
  ↓
Detecta si es conversación con Doc Love
  ↓ (si es Doc Love)
DocLoveService.generateAndSaveReply()
  ├─ Obtiene historial
  ├─ Llama a AIService
  │  └─ AIService → OpenAIProvider → OpenAI API
  └─ Guarda respuesta como mensaje de Doc Love
  ↓
Frontend recibe respuesta (polling/suscripción)
```

### Interfaces Clave

**IAProvider:**
```typescript
interface IAProvider {
  generateReply(request: IAGenerateRequest): Promise<IAResponse>;
  readonly name: string;
}
```

**DocLoveService:**
- `isDocLoveConversation()` - Detecta si un match es con Doc Love
- `generateAndSaveReply()` - Genera y guarda respuesta de IA
- `getConversationHistory()` - Obtiene historial formateado

## Integración

**Modificar `SendMessage` use case:**
- Después de guardar mensaje del usuario
- Si es conversación con Doc Love → llamar a `DocLoveService.generateAndSaveReply()`

**No requiere cambios en:**
- Frontend (sigue funcionando igual)
- Tablas de BBDD (usa `messages` existente)
- Endpoints (reutiliza `/chats/:matchId/messages`)

## Extensibilidad

Para añadir un nuevo proveedor (ej: Gemini):

1. Crear `GeminiProvider` implementando `IAProvider`
2. Añadir caso en `config.ts`
3. Cambiar `AI_PROVIDER=gemini` en `.env`

**Sin modificar:**
- `DocLoveService`
- `SendMessage`
- Controllers
- Frontend

## Variables de Entorno

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
DOC_LOVE_EMAIL=doclove@wodates.com  # Ya existe
```

## Archivos a Crear/Modificar

### Nuevos:
- `backend-api/src/app/ai/providers/IAProvider.ts`
- `backend-api/src/app/ai/providers/OpenAIProvider.ts`
- `backend-api/src/app/ai/AIService.ts`
- `backend-api/src/app/ai/config.ts`
- `backend-api/src/app/services/doc-love-service.ts`

### Modificar:
- `backend-api/src/domain/use-cases/chat/SendMessage.ts`
- `backend-api/src/app/index.ts`
- `backend-api/package.json` (añadir `openai`)

## Ventajas de esta Arquitectura

✅ **KISS:** Simple, sin sobre-ingeniería  
✅ **Extensible:** Añadir proveedores sin tocar dominio  
✅ **Desacoplada:** Capas claras (dominio ↔ proveedores)  
✅ **Reutiliza:** Usa infraestructura existente  
✅ **Testeable:** Fácil de mockear y testear  

## Próximos Pasos

Ver documento completo: `docs/auxiliar/DOC_LOVE_AI_ARCHITECTURE.md`

1. Revisar arquitectura
2. Crear estructura base
3. Implementar OpenAI provider
4. Implementar DocLoveService
5. Integrar en SendMessage
6. Testing y deploy

