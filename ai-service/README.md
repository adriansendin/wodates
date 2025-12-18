# Wodates AI Service

Microservicio dedicado a operaciones de IA para Wodates. Este servicio orquesta llamadas a LLMs, genera perfiles de usuario, embeddings y explicaciones de afinidad.

## ¿Qué hace este servicio?

El `ai-service` es responsable únicamente de:

- **Orquestar llamadas a LLMs** (vía HTTP, p.ej. Ollama)
- **Generar y fusionar fichas de perfil** desde conversaciones
- **Generar embeddings** para matching semántico
- **Decidir la "siguiente pregunta"** (agente conversacional)
- **Generar explicaciones de afinidad** entre usuarios

## ¿Qué NO hace este servicio?

Este servicio **NO** debe:

- Acceder directamente a base de datos
- Manejar autenticación/autorización
- Aplicar reglas de negocio duras
- Gestionar sesiones de usuario
- Almacenar datos persistentes

El backend principal (Node.js/Fastify) sigue siendo el dueño del sistema y orquesta las llamadas a este servicio.

## Arquitectura

El servicio sigue una arquitectura limpia por capas:

```
ai-service/
├── main.py                 # FastAPI application entry point
├── requirements.txt        # Python dependencies
└── app/
    ├── api/                # HTTP endpoints (FastAPI routers)
    │   ├── agent.py
    │   ├── profile.py
    │   └── explanations.py
    ├── services/           # Lógica de negocio de IA
    │   ├── agent_service.py
    │   ├── profile_service.py
    │   └── explanation_service.py
    ├── llm/                # Abstracción de llamadas a LLMs
    │   └── ollama_client.py
    ├── schemas/            # Modelos Pydantic (requests/responses)
    │   ├── agent.py
    │   ├── profile.py
    │   └── explanations.py
    └── core/               # Configuración y settings
        └── settings.py
```

### Principios de diseño

- **Separación de responsabilidades**: Cada capa tiene una responsabilidad clara
- **SOLID aplicado con sentido común**: Interfaces claras, dependencias inyectadas
- **Clean Architecture ligera**: Sin overengineering, pero con estructura clara
- **No lógica en controladores**: Toda la lógica está en `services/`
- **Tipado fuerte**: Pydantic para validación y contratos claros

## Endpoints

### Agent

- `POST /agent/next-question` - Genera la siguiente pregunta del agente basada en el historial de conversación

### Profile

- `POST /profile/generate` - Genera un perfil desde conversaciones
- `POST /profile/merge` - Fusiona dos perfiles (consolidado + incremental)

### Explanations

- `POST /explanations/generate` - Genera una explicación de afinidad entre dos usuarios

### Utilidades

- `GET /health` - Health check del servicio
- `GET /` - Información del servicio y endpoints disponibles

## Configuración

El servicio se configura mediante variables de entorno (con valores por defecto razonables):

```bash
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:1b
OLLAMA_TIMEOUT=60000

# Embeddings
OLLAMA_EMBEDDING_MODEL=yxchia/multilingual-e5-base
OLLAMA_EMBEDDING_TIMEOUT=30000
EMBEDDING_DIMENSION=768

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

Crea un archivo `.env` en la raíz del servicio para personalizar la configuración.

## Instalación y arranque

### Prerrequisitos

- Python 3.11+
- Ollama instalado y corriendo (o acceso a una instancia remota)

### Instalación

```bash
cd ai-service
pip install -r requirements.txt
```

### Arranque

```bash
uvicorn main:app --reload
```

El servicio estará disponible en `http://localhost:8000` (por defecto).

### Desarrollo

Para desarrollo con recarga automática:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Integración con el backend Node.js

El backend principal (Node.js/Fastify) debe hacer llamadas HTTP a este servicio:

```typescript
// Ejemplo: Generar siguiente pregunta
const response = await fetch('http://localhost:8000/agent/next-question', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversation_history: [
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: 'Hola, ¿cómo estás?' }
    ],
    user_context: { name: 'Juan', bio: 'Desarrollador...' }
  })
});

const { question } = await response.json();
```

### Autenticación

Este servicio **no maneja autenticación**. El backend Node.js debe:
1. Validar la autenticación del usuario
2. Hacer la llamada al `ai-service` con los datos necesarios
3. Procesar la respuesta y almacenarla en la base de datos si es necesario

## Tecnología

- **Lenguaje**: Python 3.11+
- **Framework HTTP**: FastAPI
- **Validación**: Pydantic
- **Cliente HTTP**: httpx (para llamadas a Ollama)

**NO se usan**:
- LangChain
- n8n
- Frameworks agentic
- Planners mágicos

## Estructura de código

### Ejemplo de flujo

1. **Request llega al endpoint** (`app/api/agent.py`)
2. **Endpoint valida con Pydantic** (`app/schemas/agent.py`)
3. **Endpoint delega al servicio** (`app/services/agent_service.py`)
4. **Servicio usa el cliente LLM** (`app/llm/ollama_client.py`)
5. **Cliente hace HTTP a Ollama**
6. **Respuesta fluye de vuelta** (servicio → endpoint → response)

### Buenas prácticas aplicadas

- ✅ No lógica en controladores
- ✅ Tipado claro en todos los modelos
- ✅ Nombres explícitos (no genéricos)
- ✅ Comentarios solo donde aportan contexto de diseño
- ✅ Código legible antes que "ingenioso"
- ✅ Manejo de errores consistente

## Próximos pasos

Este es un módulo profesional mínimo, preparado para crecer:

- [ ] Añadir logging estructurado
- [ ] Implementar métricas/monitoring
- [ ] Añadir tests unitarios para servicios críticos
- [ ] Soporte para múltiples proveedores LLM (OpenAI, etc.)
- [ ] Cache de embeddings
- [ ] Rate limiting
- [ ] Validación más robusta de perfiles generados

## Licencia

Parte del proyecto Wodates.

