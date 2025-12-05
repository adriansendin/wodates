# Tests para Process 1 - MAIN Marking Verification

Este directorio contiene tests exhaustivos para verificar que el marcado `(MAIN)` funciona correctamente y previene la contaminación de información entre usuarios.

## Concepto Fundamental

**Cada conversación siempre tiene 2 personas:**
- **MAIN**: El usuario que se está perfilando (todos sus mensajes tienen `(MAIN)`)
- **CONTEXTO**: El otro usuario (puede ser otro usuario regular o Doc Love)

**Regla de extracción:**
- ✅ **Toda la información extraída** debe venir SOLO de los mensajes del MAIN
- ✅ **Los mensajes del contexto** solo sirven para entender qué dijo el MAIN en respuesta a qué (contexto narrativo)
- ❌ **NUNCA** se debe extraer información de los mensajes del contexto

## Archivos

- **`test-process-1-data.ts`**: Datos básicos de prueba
- **`test-process-1-helpers.ts`**: Mocks y helpers para los tests
- **`test-process-1-job.ts`**: Tests de formato (12 tests: 5 básicos + 7 avanzados) - Verifica formato del prompt
- **`test-process-1-advanced-data.ts`**: Escenarios avanzados de prueba
- **`test-process-1-integration-llm.ts`**: Tests de integración con LLM real (3 tests) - Verifica respuesta del LLM

## ¿Qué verifican estos tests?

### Tests Básicos (Tests 1-5)

1. **Basic MAIN marking**: Verifica que los mensajes del usuario principal tienen `(MAIN)`
2. **Case-insensitive comparison**: Verifica que la comparación funciona con diferentes mayúsculas/minúsculas
3. **Whitespace handling**: Verifica que maneja espacios en blanco correctamente
4. **Multiple conversations**: Verifica múltiples conversaciones (con usuarios regulares y Doc Love)
5. **Messages without senderName**: Verifica el manejo de mensajes sin senderName

### Tests Avanzados (Tests 6-12)

Estos tests verifican que:
1. **El prompt incluye ambos tipos de mensajes** (MAIN para extracción, contexto para narrativa)
2. **NO hay contaminación** de información del contexto hacia el MAIN

Escenarios de prueba:

6. **Conflicting preferences**: MAIN dice "queso", contexto dice "jamón" → Verifica que jamón NO aparece en mensajes del MAIN
7. **Personal qualities**: MAIN dice "introvertido", contexto dice "extrovertido" → Verifica que extrovertido NO aparece en mensajes del MAIN
8. **Activities**: MAIN dice "senderismo", contexto dice "fútbol" → Verifica que fútbol NO aparece en mensajes del MAIN
9. **Work and career**: MAIN dice "programador", contexto dice "médico" → Verifica que médico NO aparece en mensajes del MAIN
10. **Relationship preferences**: MAIN dice "serio", contexto dice "casual" → Verifica que casual NO aparece en mensajes del MAIN
11. **Doc Love conversation**: MAIN y Doc Love → Verifica que Doc Love NO tiene (MAIN) y está solo como contexto
12. **Complex multi-topic**: Múltiples temas → Verifica separación correcta en todos los temas

## Tests de integración con LLM real

Los tests de integración (`test-process-1-integration-llm.ts`) verifican que:
1. **El LLM real extrae información del MAIN** correctamente
2. **El LLM NO extrae información del contexto** (no contaminación en el perfil generado)

Estos tests:
- ✅ Llaman al LLM real (Ollama)
- ✅ Generan perfiles reales
- ✅ Verifican el contenido del perfil generado
- ✅ Detectan contaminación si el LLM extrae información del contexto

**Escenarios de prueba:**
1. **Conflicting preferences**: Verifica que el perfil NO contiene "jamón" (del contexto)
2. **Personal qualities**: Verifica que el perfil NO contiene "extrovertido" (del contexto)
3. **Activities**: Verifica que el perfil NO contiene "fútbol" (del contexto)

## Cómo ejecutar los tests

**IMPORTANTE:** Ejecuta los comandos desde el directorio raíz `backend-api`, NO desde dentro de `scripts/testjobs`.

### Tests de formato (rápidos, sin LLM):
```bash
# Desde backend-api/
npx tsx scripts/testjobs/test-process-1-job.ts
```
Estos tests verifican que el formato del prompt es correcto (no llaman al LLM real).

### Tests de integración con LLM (lentos, requieren Ollama):
```bash
# Desde backend-api/
# Requiere Ollama corriendo en http://localhost:11434
npx tsx scripts/testjobs/test-process-1-integration-llm.ts
```
Estos tests llaman al LLM real y verifican que el perfil generado NO contiene información del contexto.

**Para saltar los tests de LLM:**
```bash
SKIP_LLM_TESTS=true npx tsx scripts/testjobs/test-process-1-integration-llm.ts
```

**Si estás dentro de `scripts/testjobs/`, primero haz:**
```bash
cd ../..  # Volver a backend-api/
```

## Seguridad

✅ **100% seguro ejecutar repetidamente**:
- Todos los repositorios están mockeados (solo memoria, sin base de datos)
- DocLoveHelper está mockeado (sin consultas a BD)
- SummarizerModel está mockeado (sin llamadas al LLM real)
- No se escribe nada en base de datos ni servicios externos
- Todos los datos de prueba están en memoria y se resetean en cada ejecución

## Qué verifican los tests avanzados

Los tests avanzados verifican específicamente que:

1. ✅ Los mensajes del MAIN están correctamente marcados con `(MAIN)` (para extracción)
2. ✅ Los mensajes del contexto NO están marcados con `(MAIN)` (solo para narrativa)
3. ✅ El prompt incluye ambos tipos de mensajes (MAIN + contexto)
4. ✅ La información del contexto NO aparece en los mensajes del MAIN (no contaminación)
5. ✅ El formato del prompt permite al LLM distinguir qué mensajes usar para extracción

### Ejemplo de verificación:

**Conversación:**
- MAIN dice: "Me gusta el queso"
- Contexto dice: "A mí me gusta el jamón"
- MAIN dice: "Soy vegetariano"

**Prompt generado:**
```
Adrian (MAIN): Me gusta el queso
Laura: A mí me gusta el jamón
Adrian (MAIN): Soy vegetariano
```

**Verificaciones del test:**
- ✅ El prompt contiene "queso" en los mensajes de MAIN (marcados con `(MAIN)`)
- ✅ El prompt contiene "jamón" en los mensajes del contexto (sin `(MAIN)`)
- ✅ El prompt contiene "vegetariano" en los mensajes de MAIN
- ❌ El prompt NO contiene "jamón" en los mensajes del MAIN (no contaminación)
- ✅ Ambos tipos de mensajes están presentes (MAIN para extracción, contexto para narrativa)

## Estructura de los escenarios

Cada escenario avanzado contiene:

```typescript
{
  mainUserMessages: [...],      // Mensajes del usuario principal
  otherUserMessages: [...],     // Mensajes del otro usuario (opcional)
  docLoveMessages: [...],       // Mensajes de Doc Love (opcional)
  expectedInPrompt: {
    mainUserShouldHave: [...],      // Info que MAIN debe tener
    mainUserShouldNotHave: [...],   // Info que MAIN NO debe tener (de OTHER)
    otherUserShouldHave: [...],     // Info que OTHER debe tener
  }
}
```

## Salida de los tests

Los tests muestran:
- ✅ Tests que pasaron
- ❌ Tests que fallaron (con detalles del error)
- 📋 Snippets del prompt cuando hay errores (para debugging)
- 📊 Resumen final con estadísticas

## Agregar nuevos tests

Para agregar un nuevo escenario:

1. Agrega el escenario en `test-process-1-advanced-data.ts`
2. Crea una función de test en `test-process-1-advanced-job.ts`
3. Agrega la llamada en `runAdvancedTests()`

Ejemplo:

```typescript
// En test-process-1-advanced-data.ts
export const SCENARIO_MI_NUEVO_TEST = {
  mainUserMessages: [...],
  otherUserMessages: [...],
  expectedInPrompt: {
    mainUserShouldHave: ['info1', 'info2'],
    mainUserShouldNotHave: ['info3', 'info4'],
  },
};

// En test-process-1-advanced-job.ts
async function testMiNuevoTest(): Promise<TestResult> {
  // ... implementación similar a otros tests
}

// En runAdvancedTests()
results.push(await testMiNuevoTest());
```

