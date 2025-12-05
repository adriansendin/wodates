# Criterios de Verificación de los Tests - Explicación Conceptual

## Contexto Fundamental

**IMPORTANTE:** Cada conversación siempre tiene **2 personas**:
- **MAIN**: El usuario que se está perfilando (todos sus mensajes tienen `(MAIN)`)
- **CONTEXTO**: El otro usuario (puede ser otro usuario regular o Doc Love)

**Regla de extracción:**
- ✅ **Toda la información extraída** debe venir SOLO de los mensajes del MAIN
- ✅ **Los mensajes del contexto** solo sirven para entender qué dijo el MAIN en respuesta a qué
- ❌ **NUNCA** se debe extraer información de los mensajes del contexto

## ¿Qué Verificamos?

Los tests verifican que el sistema **marca correctamente** los mensajes del usuario principal con `(MAIN)` y que el formato del prompt permite al LLM distinguir entre:
- Mensajes del MAIN (para extracción de información)
- Mensajes del contexto (solo para contexto narrativo)

## Los 5 Criterios de Verificación

### CRITERIO 1: Marcado `(MAIN)` en mensajes del usuario principal

**Qué verificamos:**
- Que los mensajes del usuario principal (MAIN) tienen el marcador `(MAIN)`
- Esto permite al LLM identificar qué mensajes debe usar para extraer información

**Cómo lo verificamos:**
```typescript
// Buscamos el patrón "Adrian (MAIN):" en el prompt
const mainUserPattern = /Adrian\s+\(MAIN\):/gi;
const matches = prompt.match(mainUserPattern);
// ✅ Pasa si: matches.length > 0
// ❌ Falla si: matches.length === 0
```

**Ejemplo:**
```
Prompt generado:
  Adrian (MAIN): Me gusta el queso
  Laura: A mí me gusta el jamón
  Adrian (MAIN): Prefiero la comida italiana

Resultado: ✅ Pasa (encontró 2 veces "Adrian (MAIN):")
```

---

### CRITERIO 2: Mensajes de contexto NO tienen `(MAIN)`

**Qué verificamos:**
- Que los mensajes del otro usuario (contexto narrativo) NO tienen el marcador `(MAIN)`
- Esto permite al LLM identificar que estos mensajes son solo contexto, no para extracción

**Cómo lo verificamos:**
```typescript
// Buscamos el patrón "Laura (MAIN):" (NO debería existir)
const otherUserWithMainPattern = /Laura\s+\(MAIN\):/gi;
const matches = prompt.match(otherUserWithMainPattern);
// ✅ Pasa si: matches.length === 0 (no existe)
// ❌ Falla si: matches.length > 0 (existe - CONTAMINACIÓN)
```

**Ejemplo:**
```
Prompt generado:
  Adrian (MAIN): Me gusta el queso
  Laura: A mí me gusta el jamón  ← Sin (MAIN) ✅

Resultado: ✅ Pasa (no encontró "Laura (MAIN):")
```

**Si fallara (ejemplo de error):**
```
Prompt generado:
  Adrian (MAIN): Me gusta el queso
  Laura (MAIN): A mí me gusta el jamón  ← ERROR: Laura tiene (MAIN) ❌

Resultado: ❌ Falla (encontró "Laura (MAIN):" - CONTAMINACIÓN)
```

---

### CRITERIO 3: El prompt incluye ambos tipos de mensajes

**Qué verificamos:**
- Que el prompt incluye mensajes del MAIN (marcados con `(MAIN)`) para extracción
- Que el prompt incluye mensajes del contexto (sin `(MAIN)`) para contexto narrativo
- Esto permite al LLM tener el contexto completo de la conversación

**Cómo lo verificamos:**
```typescript
// Lista de información que el MAIN debería tener
mainUserShouldHave: ['queso', 'vegetariano']

// Verificamos cada palabra en TODO el prompt
mainUserShouldHave.forEach((info) => {
  const found = prompt.toLowerCase().includes(info.toLowerCase());
  // ✅ Pasa si: found === true
  // ❌ Falla si: found === false
});
```

**Ejemplo:**
```
Mensajes del MAIN:
  "Me gusta mucho el queso"
  "Soy vegetariano, no como carne"

Prompt generado:
  Adrian (MAIN): Me gusta mucho el queso
  Laura: A mí me encanta el jamón
  Adrian (MAIN): Soy vegetariano, no como carne

Verificación:
  "queso" → ✅ Encontrado en prompt
  "vegetariano" → ✅ Encontrado en prompt

Resultado: ✅ Pasa (ambas palabras encontradas)
```

---

### CRITERIO 4: El MAIN tiene su información

**Qué verificamos:**
- Que la información que el usuario principal (MAIN) dijo está presente en el prompt
- Que está en los mensajes correctamente marcados con `(MAIN)`

### CRITERIO 5: El MAIN NO tiene información del contexto (NO CONTAMINACIÓN)

**Qué verificamos:**
- Que la información que el usuario de contexto dijo NO aparece en los mensajes del MAIN
- Esto previene contaminación: el LLM no debe extraer información del contexto

**Cómo lo verificamos:**
```typescript
// Lista de información que el MAIN NO debería tener (viene del OTHER)
mainUserShouldNotHave: ['jamón', 'carne']

// 1. Extraemos SOLO la sección del MAIN user
const mainUserSection = prompt.match(/Adrian\s+\(MAIN\):[\s\S]*?(?=Laura:|Doc Love:|$)/i)[0];

// 2. Verificamos que cada palabra NO está en la sección del MAIN
mainUserShouldNotHave.forEach((info) => {
  const foundInMainSection = mainUserSection.toLowerCase().includes(info.toLowerCase());
  // ✅ Pasa si: foundInMainSection === false (no está en MAIN)
  // ❌ Falla si: foundInMainSection === true (está en MAIN - CONTAMINACIÓN)
});
```

**Ejemplo CORRECTO:**
```
Mensajes del MAIN:
  "Me gusta mucho el queso"
  "Soy vegetariano, no como carne"

Mensajes del OTHER:
  "A mí me encanta el jamón"
  "Yo como carne todos los días"

Prompt generado:
  Adrian (MAIN): Me gusta mucho el queso
  Laura: A mí me encanta el jamón
  Adrian (MAIN): Soy vegetariano, no como carne
  Laura: Yo como carne todos los días

Sección del MAIN extraída:
  "Adrian (MAIN): Me gusta mucho el queso
   Adrian (MAIN): Soy vegetariano, no como carne"

Verificación:
  "jamón" en sección MAIN → ❌ No encontrado ✅ (correcto)
  "carne" en sección MAIN → ⚠️ Encontrado (pero en contexto negativo "no como carne")

Resultado: ⚠️ Problema detectado - "carne" aparece pero en contexto negativo
```

**Ejemplo de CONTAMINACIÓN (si fallara):**
```
Prompt generado (ERROR):
  Adrian (MAIN): Me gusta mucho el queso
  Adrian (MAIN): A mí me encanta el jamón  ← ERROR: Mensaje del OTHER atribuido al MAIN
  Laura: Yo como carne todos los días

Sección del MAIN extraída:
  "Adrian (MAIN): Me gusta mucho el queso
   Adrian (MAIN): A mí me encanta el jamón"

Verificación:
  "jamón" en sección MAIN → ✅ Encontrado ❌ (CONTAMINACIÓN)

Resultado: ❌ Falla (jamón está en mensajes del MAIN cuando debería estar solo en OTHER)
```

---

## Resumen de Criterios

| Criterio | Qué Verifica | Cómo lo Verifica | Ejemplo de Éxito | Ejemplo de Falla |
|----------|--------------|------------------|------------------|------------------|
| **1. Marcado MAIN** | MAIN tiene `(MAIN)` | Busca `"Adrian (MAIN):"` en prompt | Encuentra 2+ veces | Encuentra 0 veces |
| **2. Contexto sin MAIN** | Contexto NO tiene `(MAIN)` | Busca `"Laura (MAIN):"` en prompt | Encuentra 0 veces | Encuentra 1+ veces |
| **3. Ambos tipos presentes** | Prompt tiene MAIN y contexto | Verifica ambos tipos de mensajes | Ambos presentes | Falta alguno |
| **4. Info del MAIN** | MAIN tiene su info | Busca palabras del MAIN en prompt | "queso" encontrado | "queso" no encontrado |
| **5. NO contaminación** | MAIN NO tiene info del contexto | Busca palabras del contexto en sección MAIN | "jamón" no en MAIN | "jamón" sí en MAIN |

---

## Limitaciones de los Tests Actuales

### ✅ Lo que SÍ verifican:
1. Que el marcado `(MAIN)` existe correctamente
2. Que los mensajes están separados por usuario
3. Que las palabras aparecen en el prompt
4. Que no hay contaminación obvia (palabras del OTHER en sección MAIN)

### ⚠️ Lo que NO verifican:
1. **Contexto semántico**: No distinguen "no como carne" vs "como carne"
2. **Uso real del LLM**: No verifican que el LLM realmente respete el marcado `(MAIN)`
3. **Calidad del perfil**: No verifican que el perfil generado sea correcto

---

## ¿Por Qué los Tests "Pasan"?

Los tests pasan porque:

1. ✅ **El sistema genera el prompt correctamente** con `(MAIN)` marcado
2. ✅ **Los mensajes están separados** por usuario
3. ✅ **No hay contaminación obvia** (palabras del OTHER no aparecen en sección MAIN)

**PERO** esto solo verifica el **formato del prompt**, no que el **LLM realmente respete** el marcado.

Para verificar que el LLM respeta el marcado, necesitaríamos:
- Tests de integración con el LLM real
- Verificar el perfil generado (no solo el prompt)
- Análisis semántico del contenido

---

## Estructura Correcta del Prompt

El prompt debe tener esta estructura:

```
CONVERSACIONES:

Conversación con [Nombre del contexto]:
[Nombre del contexto]: [mensaje de contexto - solo para entender la conversación]
Adrian (MAIN): [mensaje del MAIN - información a extraer]
[Nombre del contexto]: [mensaje de contexto - solo para entender la conversación]
Adrian (MAIN): [mensaje del MAIN - información a extraer]
```

**Ejemplo real:**
```
CONVERSACIONES:

Conversación con Doc Love:
Doc Love: ¿Qué tipo de comida prefieres?
Adrian (MAIN): Me gusta la comida italiana
Doc Love: ¿Y qué te gusta hacer los fines de semana?
Adrian (MAIN): Me encanta hacer senderismo
```

**Información que el LLM debe extraer:**
- ✅ "Le gusta la comida italiana" (del mensaje del MAIN)
- ✅ "Le encanta hacer senderismo" (del mensaje del MAIN)
- ❌ NO extraer: "pregunta sobre comida" (eso es contexto de Doc Love)
- ❌ NO extraer: "pregunta sobre fines de semana" (eso es contexto de Doc Love)

## Conclusión

Los tests actuales verifican que:
- ✅ El sistema marca correctamente con `(MAIN)` los mensajes del usuario principal
- ✅ Los mensajes del contexto NO tienen `(MAIN)`
- ✅ El prompt incluye ambos tipos de mensajes (MAIN para extracción, contexto para narrativa)
- ✅ El formato permite al LLM distinguir qué mensajes usar para extracción
- ✅ No hay contaminación obvia en el formato

Los tests NO verifican que:
- ❌ El LLM realmente respeta el marcado `(MAIN)` (necesitaría tests de integración con LLM real)
- ❌ El perfil generado es correcto (necesitaría verificar el output del LLM)
- ❌ El contexto semántico es correcto (necesitaría análisis más profundo)

**Esto es suficiente para verificar que el sistema está funcionando correctamente a nivel de formato y estructura del prompt**, asegurando que el LLM tiene toda la información necesaria para distinguir entre mensajes de extracción (MAIN) y mensajes de contexto.

