# Explicación Conceptual: ¿Cómo verificamos que los tests funcionan?

## El Problema que Resolvemos

Cuando el LLM genera un perfil de usuario, necesita saber **qué mensajes son del usuario principal (MAIN)** y **qué mensajes son de otros usuarios**. Si no puede distinguirlos:

- ❌ Puede atribuir información de otros usuarios al usuario principal
- ❌ Puede mezclar cualidades de diferentes personas
- ❌ Puede generar un perfil incorrecto

## La Solución: Marcado con `(MAIN)`

El sistema marca los mensajes del usuario principal con `(MAIN)` en el prompt:

```
Adrian (MAIN): Me gusta el queso
Laura: A mí me gusta el jamón
Adrian (MAIN): Prefiero la comida italiana
```

## ¿Qué Verifican los Tests?

### 1. Verificación del Marcado `(MAIN)`

**Qué verificamos:**
- Que los mensajes del usuario principal tienen `(MAIN)`
- Que los mensajes de otros usuarios NO tienen `(MAIN)`

**Cómo lo verificamos:**
```typescript
// Buscamos el patrón "Adrian (MAIN):" en el prompt
const mainUserPattern = /Adrian\s+\(MAIN\):/i;
if (!mainUserPattern.test(prompt)) {
  // FALLA: Los mensajes del MAIN no tienen (MAIN)
}
```

**Ejemplo del prompt generado:**
```
CONVERSACIONES:

Conversación con Laura:
Adrian (MAIN): Me gusta el queso
Laura: A mí me gusta el jamón
Adrian (MAIN): Prefiero la comida italiana
```

✅ **Pasa** porque:
- "Adrian (MAIN):" aparece en el prompt
- "Laura:" NO tiene (MAIN)

### 2. Verificación de Contaminación (Tests Avanzados)

**Qué verificamos:**
- Que la información del usuario principal está en sus mensajes marcados con `(MAIN)`
- Que la información de otros usuarios NO aparece en los mensajes del MAIN

**Cómo lo verificamos:**

#### Paso 1: Extraer la sección del MAIN user
```typescript
// Buscamos todo el bloque de mensajes del MAIN user
const mainUserSection = prompt.match(/adrian\s+\(main\):[\s\S]*?(?=laura:|doc love:|$)/i);
```

Esto extrae algo como:
```
Adrian (MAIN): Me gusta el queso
Adrian (MAIN): Prefiero la comida italiana
```

#### Paso 2: Verificar que el MAIN tiene su información
```typescript
// Verificamos que "queso" está en la sección del MAIN
if (!mainUserSection.includes("queso")) {
  // FALLA: El MAIN debería tener "queso"
}
```

#### Paso 3: Verificar que el MAIN NO tiene información del OTHER
```typescript
// Verificamos que "jamón" NO está en la sección del MAIN
if (mainUserSection.includes("jamón")) {
  // FALLA: CONTAMINACIÓN - El MAIN tiene información del OTHER
}
```

## Ejemplo Concreto: Test de Conflicting Preferences

### Datos de Entrada:

**Mensajes del MAIN (Adrian):**
```
msg-1: "Me gusta mucho el queso"
msg-2: "Soy vegetariano, no como carne"
```

**Mensajes del OTHER (Laura):**
```
msg-3: "A mí me encanta el jamón"
msg-4: "Yo como carne todos los días"
```

### Prompt Generado (lo que el LLM recibe):

```
CONVERSACIONES:

Conversación con Laura:
Adrian (MAIN): Me gusta mucho el queso
Laura: A mí me encanta el jamón
Adrian (MAIN): Soy vegetariano, no como carne
Laura: Yo como carne todos los días
```

### Verificaciones del Test:

#### ✅ Verificación 1: MAIN tiene su información
```typescript
mainUserShouldHave: ['queso', 'vegetariano']

// Buscamos en TODO el prompt (no solo MAIN section)
prompt.includes('queso') → ✅ true
prompt.includes('vegetariano') → ✅ true
```

#### ✅ Verificación 2: MAIN NO tiene información del OTHER
```typescript
mainUserShouldNotHave: ['jamón', 'carne']

// Extraemos solo la sección del MAIN
mainUserSection = "Adrian (MAIN): Me gusta mucho el queso\nAdrian (MAIN): Soy vegetariano, no como carne"

// Verificamos que NO contiene información del OTHER
mainUserSection.includes('jamón') → ❌ false (CORRECTO - no está)
mainUserSection.includes('carne') → ⚠️ true (PROBLEMA - está en "no como carne")
```

**Problema detectado:** La palabra "carne" aparece en el mensaje del MAIN ("no como carne"), pero eso es correcto porque el MAIN está diciendo que NO come carne. El test necesita ser más inteligente.

### Mejora del Test:

El test actual tiene una limitación: busca palabras simples sin contexto. Debería verificar:

1. ✅ Que "jamón" NO aparece en mensajes del MAIN
2. ✅ Que "carne" puede aparecer en mensajes del MAIN si el contexto es negativo ("no como carne")

## Criterios de Éxito de los Tests

### Test Básico: ✅ Pasa si
1. El prompt contiene `Adrian (MAIN):` al menos una vez
2. El prompt contiene `Laura:` sin `(MAIN)`
3. No hay `Laura (MAIN):` en el prompt

### Test Avanzado: ✅ Pasa si
1. **Presencia correcta:** Las palabras del MAIN aparecen en el prompt
2. **Ausencia de contaminación:** Las palabras del OTHER NO aparecen en la sección del MAIN
3. **Separación correcta:** Cada usuario tiene su información en su propia sección

## Limitaciones Actuales

Los tests actuales verifican:
- ✅ Que el marcado `(MAIN)` existe
- ✅ Que las palabras aparecen en el prompt
- ⚠️ **NO verifican el contexto** (ej: "no como carne" vs "como carne")
- ⚠️ **NO verifican que el LLM realmente use solo los mensajes con (MAIN)**

## Lo que REALMENTE deberíamos verificar

Para una verificación completa, necesitaríamos:

1. **Verificación del prompt:**
   - ✅ Marcado `(MAIN)` correcto
   - ✅ Separación de mensajes por usuario

2. **Verificación del output del LLM:**
   - ✅ El perfil generado contiene información del MAIN
   - ✅ El perfil generado NO contiene información del OTHER
   - ⚠️ Esto requeriría llamar al LLM real (no mock)

3. **Verificación semántica:**
   - ✅ Entender contexto ("no como carne" ≠ "como carne")
   - ⚠️ Esto requeriría NLP más avanzado

## Conclusión

Los tests actuales verifican que:
- ✅ El sistema marca correctamente con `(MAIN)`
- ✅ El prompt separa correctamente los mensajes
- ⚠️ **NO verifican** que el LLM realmente respete el marcado (eso requeriría tests de integración con el LLM real)

Los tests son útiles para verificar que el **formato del prompt es correcto**, pero para verificar que el **LLM respeta el marcado**, necesitaríamos tests de integración más complejos.

