# Textos en Español Encontrados en el Proyecto

Este documento lista todos los textos en español que son visibles para el usuario real en la aplicación.

## 📍 Textos en Archivos de Pruebas (Cypress)

### `mobile-app/cypress/e2e/feed.cy.ts`

**Línea 53, 57**: Selector de accesibilidad para botón de rechazar
- `'[aria-label="Ignorar perfil"]'` → Debería ser: `'[aria-label="Dismiss profile"]'` o `'[aria-label="Not for me"]'`

**Línea 58**: Mensaje cuando no hay más usuarios en el feed
- `'Wodates prioriza calidad sobre cantidad. Mejora tu afinidad hablando con Doc Love'` → Debería ser: `'Wodates prioritizes quality over quantity. Improve your affinity by talking with Doc Love'`

**Línea 109**: Mensaje de prueba en español
- `'Hola, encantada de conocerte!'` → Este es un mensaje de prueba, pero debería estar en inglés: `'Hello, nice to meet you!'`

**Línea 145**: Selector de accesibilidad para botón de like
- `'[aria-label="Dar like al perfil"]'` → Debería ser: `'[aria-label="Like this profile"]'` o `'[aria-label="I want to meet them"]'`

**Línea 152**: Mensaje de prueba en español
- `'Hola Sofia, gracias por tu mensaje!'` → Este es un mensaje de prueba, pero debería estar en inglés: `'Hello Sofia, thanks for your message!'`

### `mobile-app/cypress/e2e/auth.cy.ts`

**Línea 36**: Mensaje de error de prueba
- `'Credenciales incorrectas'` → Este es un mensaje de prueba del backend, pero debería estar en inglés: `'Invalid credentials'`

**Línea 50**: Mensaje de error esperado en la prueba
- `/Credenciales incorrectas|No se pudo iniciar sesion|Unauthorized/i` → Debería buscar: `/Invalid credentials|Couldn't sign in|Unauthorized/i`

## 📝 Notas Importantes

1. **Archivos de Pruebas**: Los textos en español en los archivos de Cypress son problemáticos porque:
   - Las pruebas buscan textos en español que pueden no existir en la aplicación real
   - Si la aplicación está en inglés, estas pruebas fallarán
   - Los mensajes de prueba deberían estar en inglés para consistencia

2. **Comentarios en Código**: Hay muchos comentarios en español en el código (especialmente en `BirthDatePicker.tsx`, `AgeRangePicker.tsx`, etc.), pero estos NO son visibles para el usuario final, solo para desarrolladores.

3. **Textos Ya Corregidos**: Según `docs/TEXTOS_EN_ESPAÑOL.md`, muchos textos ya fueron corregidos en los componentes principales de la aplicación.

## 🔍 Resumen de Textos que Necesitan Corrección

### Archivos de Pruebas (Cypress)

1. ❌ **"Ignorar perfil"** → "Dismiss profile" o "Not for me" (2 ubicaciones en `feed.cy.ts`)
2. ❌ **"Wodates prioriza calidad sobre cantidad. Mejora tu afinidad hablando con Doc Love"** → "Wodates prioritizes quality over quantity. Improve your affinity by talking with Doc Love" (1 ubicación en `feed.cy.ts`)
3. ❌ **"Dar like al perfil"** → "Like this profile" o "I want to meet them" (1 ubicación en `feed.cy.ts`)
4. ❌ **"Hola, encantada de conocerte!"** → "Hello, nice to meet you!" (1 ubicación en `feed.cy.ts` - mensaje de prueba)
5. ❌ **"Hola Sofia, gracias por tu mensaje!"** → "Hello Sofia, thanks for your message!" (1 ubicación en `feed.cy.ts` - mensaje de prueba)
6. ❌ **"Credenciales incorrectas"** → "Invalid credentials" (1 ubicación en `auth.cy.ts` - mensaje de prueba)
7. ❌ **"No se pudo iniciar sesion"** → "Couldn't sign in" (1 ubicación en `auth.cy.ts` - regex de prueba)

## ✅ Verificaciones Realizadas

1. **Backend**: El backend está en inglés. Los mensajes de error como "Credenciales incorrectas" son solo para las pruebas de Cypress, no son mensajes reales del backend.

2. **Componentes principales**: Según `docs/TEXTOS_EN_ESPAÑOL.md`, los textos en español en los componentes principales de la aplicación ya fueron corregidos.

3. **Comentarios en código**: Hay comentarios en español en varios archivos (especialmente `BirthDatePicker.tsx`, `AgeRangePicker.tsx`, `AvatarPicker.tsx`), pero estos NO son visibles para el usuario final.

## 🎯 Recomendaciones

1. **Actualizar pruebas de Cypress**: Todos los textos en español en las pruebas deberían cambiarse a inglés para que las pruebas funcionen correctamente con la aplicación en inglés.

2. **Mensajes de prueba**: Los mensajes de prueba en español deberían cambiarse a inglés para mantener consistencia.

3. **Comentarios en código**: Aunque no son visibles para el usuario, sería bueno mantener los comentarios en inglés para consistencia del proyecto, pero esto es opcional y de menor prioridad.

## 📊 Estadísticas

- **Textos visibles al usuario encontrados**: 7 instancias (todas en archivos de pruebas)
- **Archivos afectados**: 2 archivos de pruebas (`feed.cy.ts`, `auth.cy.ts`)
- **Comentarios en español**: Múltiples (no visibles al usuario)
