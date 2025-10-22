# Problema con el Test de Registro

## Descripción
Los tests de registro (`registration.cy.ts`) fallan en el paso 2 (selección de fecha de nacimiento).

## Problema Identificado

### Root Cause
React Native Web renderiza los componentes `TouchableOpacity` como `<div>` elements con event handlers personalizados que no se activan correctamente con los clicks de Cypress.

El problema específico ocurre en:
- **Step 1**: ✅ Funciona con `{force: true}`
- **Step 2**: ❌ El botón "Continuar" no ejecuta el handler `onPress` correctamente

### Error
```
AssertionError: Timed out retrying after 10000ms: expected '/register/step2' to include 'step3'
```

## Soluciones Intentadas

1. ✅ **Usar `{force: true}`** - Funciona para Step 1
2. ❌ **Scroll para hacer visible el botón** - No funciona, el body no es scrollable
3. ❌ **Click nativo con `.then(($btn) => $btn[0].click())`** - No activa el handler
4. ❌ **Dispatch manual de eventos MouseEvent** - No activa el handler de React Native Web

## Recomendaciones

### Opción 1: Agregar testIDs
Modificar los componentes para agregar `testID` attributes que Cypress pueda usar:

```typescript
<TouchableOpacity testID="continuar-button" onPress={handleNext}>
  <Text>Continuar</Text>
</TouchableOpacity>
```

Y en el test:
```typescript
cy.get('[data-testid="continuar-button"]').click({force: true});
```

### Opción 2: Usar Component Testing
En lugar de E2E testing, usar Cypress Component Testing para probar los componentes individuales.

### Opción 3: Simplificar el Flow
Crear un endpoint de API para crear usuarios de prueba y solo testear la UI final, no el flujo completo de registro.

### Opción 4: Usar Testing Library
Considerar usar `@testing-library/react-native` con Jest en lugar de Cypress para tests de componentes React Native Web.

## Estado Actual

El test está configurado con:
- ✅ Todos los botones usan `{force: true}`
- ✅ Waits apropiados entre pasos
- ✅ Verificaciones de existencia antes de click
- ❌ El handler de Step 2 no se activa correctamente

## Próximos Pasos

1. Agregar `testID` a todos los botones "Continuar" en los steps del registro
2. Modificar el test para usar los testIDs
3. Si esto no funciona, considerar las otras opciones mencionadas arriba

