# Resumen: Integración de Ollama para Doc Love

## 🎯 Objetivo

Añadir **Ollama + phi3** como proveedor de IA local para desarrollo, manteniendo la arquitectura preparada para OpenAI/Gemini.

## 📊 Estado Actual vs. Cambios Necesarios

### ✅ Lo que YA funciona (no tocar):

```
SendMessage (use case)
  ↓
DocLoveService
  ↓
AIService (orquestador)
  ↓
IAProvider (interfaz)
  ↓
OpenAIProvider ✅ (ya implementado)
```

### 🆕 Lo que hay que AÑADIR:

```
AIService
  ↓
IAProvider (interfaz)
  ↓
├─ OpenAIProvider ✅ (ya existe)
└─ LocalOllamaProvider 🆕 (nuevo)
```

## 📁 Archivos a Crear/Modificar

### 🆕 Crear (1 archivo):

```
backend-api/src/app/ai/providers/LocalOllamaProvider.ts
```

**Responsabilidades:**
- Implementar `IAProvider`
- Llamar a `http://localhost:11434/api/generate`
- Manejar streaming de Ollama (reconstruir texto completo)
- Construir prompt de texto plano (Ollama no usa roles separados)

### ✏️ Modificar (1 archivo):

```
backend-api/src/app/ai/config.ts
```

**Cambios:**
- Importar `LocalOllamaProvider`
- Añadir caso `'ollama'` en switch
- Leer `OLLAMA_URL` y `OLLAMA_MODEL` de env vars
- Opcional: hacer `ollama` default en desarrollo

### 📝 Configurar (variables de entorno):

```bash
AI_PROVIDER=ollama              # 'ollama' | 'openai'
OLLAMA_URL=http://localhost:11434  # Default
OLLAMA_MODEL=phi3                  # Default
```

## 🔄 Flujo con Ollama

```
1. Usuario envía mensaje
   ↓
2. SendMessage guarda mensaje ✅
   ↓
3. Detecta Doc Love → DocLoveService.generateAndSaveReply()
   ↓
4. AIService.generateReply()
   ↓
5. LocalOllamaProvider.generateReply()
   ├─ Construye prompt de texto plano
   ├─ POST http://localhost:11434/api/generate
   ├─ Maneja streaming (chunks JSON)
   └─ Reconstruye respuesta completa
   ↓
6. Guarda respuesta como mensaje de Doc Love ✅
   ↓
7. Frontend recibe (polling/suscripción) ✅
```

## 🏗️ Arquitectura (sin cambios en dominio)

```
┌─────────────────────────────────────────┐
│         SendMessage (use case)          │  ← No cambia
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│        DocLoveService                   │  ← No cambia
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│           AIService                      │  ← No cambia
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼────────┐  ┌───────▼────────┐
│ OpenAIProvider │  │LocalOllamaProvider│ 🆕
└────────────────┘  └─────────────────┘
```

## 🔑 Puntos Clave

### ✅ No se modifica:
- `DocLoveService` - Ya funciona con cualquier provider
- `AIService` - Ya abstrae providers
- `SendMessage` - Ya integrado
- `OpenAIProvider` - Sigue funcionando igual
- Frontend - No requiere cambios
- Tablas de BBDD - Usa `messages` existente

### 🆕 Solo se añade:
- `LocalOllamaProvider` - Nueva implementación
- Caso `ollama` en `config.ts` - Factory pattern

### 🔄 Para cambiar de proveedor:
```bash
# Desarrollo local
AI_PROVIDER=ollama

# Producción
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

**Sin tocar código** - Solo cambiar env vars.

## 📋 Checklist de Implementación

- [ ] Crear `LocalOllamaProvider.ts`
  - [ ] Implementar `IAProvider`
  - [ ] Manejar streaming de Ollama
  - [ ] Construir prompt de texto plano
  - [ ] Manejar errores y timeouts

- [ ] Actualizar `config.ts`
  - [ ] Importar `LocalOllamaProvider`
  - [ ] Añadir caso `'ollama'`
  - [ ] Leer env vars `OLLAMA_URL`, `OLLAMA_MODEL`

- [ ] Configurar variables de entorno
  - [ ] `AI_PROVIDER=ollama`
  - [ ] `OLLAMA_URL=http://localhost:11434`
  - [ ] `OLLAMA_MODEL=phi3`

- [ ] Testing
  - [ ] Verificar que Ollama responde
  - [ ] Verificar que streaming funciona
  - [ ] Verificar que mensajes se guardan correctamente

## 🎓 Extensibilidad Futura

**Para añadir Gemini:**
1. Crear `GeminiProvider.ts` (implementa `IAProvider`)
2. Añadir caso en `config.ts`
3. Cambiar `AI_PROVIDER=gemini` en `.env`

**Sin modificar:**
- ✅ `DocLoveService`
- ✅ `AIService`
- ✅ `SendMessage`
- ✅ Otros providers

---

**Ver diseño completo:** `docs/auxiliar/DOC_LOVE_OLLAMA_DESIGN.md`

