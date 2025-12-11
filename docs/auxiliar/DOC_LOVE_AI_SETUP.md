# Configuración de Doc Love como Chatbot de IA

## Variables de Entorno Requeridas

Añade estas variables a tu archivo `backend-api/.env`:

```env
# AI Provider Configuration
AI_PROVIDER=openai  # Por ahora solo 'openai' está disponible

# OpenAI Configuration (requerido si AI_PROVIDER=openai)
OPENAI_API_KEY=sk-...  # Tu API key de OpenAI
OPENAI_MODEL=gpt-4o-mini  # Modelo a usar (gpt-4o-mini, gpt-4, gpt-3.5-turbo, etc.)

# Doc Love Configuration (ya existente)
DOC_LOVE_EMAIL=doclove@wodates.com  # Email de Doc Love (opcional, tiene valor por defecto)
```

## Instalación de Dependencias

Después de añadir las variables de entorno, instala las dependencias:

```bash
cd backend-api
npm install
```

Esto instalará automáticamente el paquete `openai` que se añadió a `package.json`.

## Verificación

1. **Inicia el servidor:**
   ```bash
   npm run dev
   ```

2. **Verifica en los logs:**
   Deberías ver un mensaje como:
   ```
   AI provider initialized: openai
   ```

   Si hay un error, verás:
   ```
   Failed to initialize AI services (Doc Love will be disabled): ...
   ```

3. **Prueba enviando un mensaje a Doc Love:**
   - Abre el chat con Doc Love en la app móvil
   - Envía un mensaje
   - Doc Love debería responder automáticamente

## Troubleshooting

### Error: "OPENAI_API_KEY is required"
- Verifica que `OPENAI_API_KEY` esté en tu `.env`
- Asegúrate de que el archivo `.env` esté en `backend-api/` (no en la raíz del proyecto)

### Error: "Unknown AI provider"
- Verifica que `AI_PROVIDER=openai` (en minúsculas)
- Por ahora solo 'openai' está soportado

### Doc Love no responde
- Verifica los logs del servidor para ver si hay errores
- Asegúrate de que Doc Love existe en la base de datos y está marcado como bot
- Verifica que el match con Doc Love existe

### Error de API de OpenAI
- Verifica que tu API key sea válida
- Verifica que tengas créditos en tu cuenta de OpenAI
- Revisa los límites de rate limit de OpenAI

## Próximos Pasos

Para añadir otro proveedor de IA (ej: Gemini):

1. Implementa `GeminiProvider` siguiendo el patrón de `OpenAIProvider`
2. Añade el caso en `backend-api/src/app/ai/config.ts`
3. Añade la variable `GEMINI_API_KEY` a tu `.env`
4. Cambia `AI_PROVIDER=gemini` en tu `.env`

Ver `docs/auxiliar/DOC_LOVE_AI_ARCHITECTURE.md` para más detalles sobre la arquitectura.

