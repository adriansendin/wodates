# Solución al Problema del Range Slider de Edad

## Problema Identificado

El range slider para el rango de edad en la página de perfil presentaba dos problemas críticos:
1. Las bolitas del slider volvían a su posición original, imposibilitando cambiar el rango
2. Discrepancias entre lo que se mostraba en la pantalla del móvil y lo que se almacenaba en Supabase

### Causas Raíz

1. **API Incorrecta del Componente**: El componente tenía dos callbacks separados (`onMinAgeChange` y `onMaxAgeChange`) para un valor que debería ser atómico (un rango).

2. **Race Conditions**: Cuando el slider cambiaba ambos valores simultáneamente, los handlers se llamaban por separado, cada uno con el valor viejo del otro campo.

3. **Actualización Prematura del Estado**: El estado del formulario se actualizaba inmediatamente, causando re-renders que reseteaban el slider antes de que se guardara en BD.

4. **Sincronización Problemática**: El `useEffect` en el componente hijo sincronizaba con las props del padre, pero estas cambiaban antes de guardar, causando el "salto" del slider.

## Solución Implementada

### 1. Cambios en `AgeRangePicker.tsx`

**A. Cambio de API: Un solo callback para el rango completo**

```typescript
// ANTES ❌
interface AgeRangePickerProps {
  minAge: number;
  maxAge: number;
  onMinAgeChange: (age: number) => void;  // Dos callbacks separados
  onMaxAgeChange: (age: number) => void;
  disabled?: boolean;
  style?: any;
}

// DESPUÉS ✅
interface AgeRangePickerProps {
  minAge: number;
  maxAge: number;
  onRangeChange: (min: number, max: number) => void;  // Un solo callback atómico
  disabled?: boolean;
  style?: any;
}
```

**B. Estado local para interacción fluida (líneas 27-35)**

```typescript
// Estado local para el slider (móvil) - permite interacción fluida
const [localMinAge, setLocalMinAge] = useState(minAge);
const [localMaxAge, setLocalMaxAge] = useState(maxAge);

// Sincronizar estado local cuando cambian las props (desde la BD)
useEffect(() => {
  setLocalMinAge(minAge);
  setLocalMaxAge(maxAge);
}, [minAge, maxAge]);
```

**C. Doble callback en MultiSlider (líneas 79-91)**

```typescript
<MultiSlider
  values={[localMinAge, localMaxAge]}  // ✅ Usa estado local
  onValuesChange={(values) => {
    if (disabled) return;
    const [min, max] = values as [number, number];
    // Actualizar estado local inmediatamente para UI fluida
    setLocalMinAge(min);
    setLocalMaxAge(max);
  }}
  onValuesChangeFinish={(values) => {
    if (disabled) return;
    const [min, max] = values as [number, number];
    // Notificar al padre con AMBOS valores juntos
    onRangeChange(min, max);  // ✅ Un solo callback con ambos valores
  }}
/>
```

**Beneficios**: 
- **Atomicidad**: El rango se trata como una unidad, ambos valores se pasan juntos
- **UI fluida**: El slider responde inmediatamente al arrastre usando estado local
- **Sin race conditions**: No hay conflicto entre min y max
- **Guardado eficiente**: Solo notifica al padre cuando el usuario termina

### 2. Cambios en `profile.tsx`

#### A. Nueva función `autoSaveAgeRange` (líneas 267-330)

Función especializada que:
- **Guarda ambos valores juntos** (min_age y max_age) en una sola llamada API
- **Implementa debouncing** (800ms) para evitar múltiples requests
- **Valida** que min_age <= max_age antes de guardar
- **Actualiza el formulario** con los valores confirmados de la BD
- **Maneja errores** y muestra feedback al usuario
- **Logs detallados** para debugging

```typescript
const autoSaveAgeRange = useCallback((minAge: number, maxAge: number) => {
  // Limpiar timeout anterior si existe
  if (ageRangeTimeoutRef.current) {
    clearTimeout(ageRangeTimeoutRef.current);
  }

  // Debounce: esperar 800ms antes de guardar
  ageRangeTimeoutRef.current = setTimeout(async () => {
    // ... validación y guardado atómico
    const payload: UpdateUserProfile = {
      min_age: minAge,
      max_age: maxAge,
    };
    
    const result = await profileApi.updateProfile(payload, tokens.accessToken);
    
    if (result.success) {
      // Actualizar el formulario con los valores confirmados de la BD
      setForm(prev => ({
        ...prev,
        min_age: updatedProfile.min_age ?? 18,
        max_age: updatedProfile.max_age ?? 99,
      }));
    }
  }, 800);
}, [profileApi, tokens?.accessToken, isAutoSaving]);
```

#### B. Handler unificado (líneas 246-261)

Un solo handler que recibe ambos valores juntos:

```typescript
// ANTES ❌ - Dos handlers separados con valores potencialmente desactualizados
const handleMinAgeChange = (minAge: number) => {
  setForm((prev) => ({ ...prev, min_age: minAge }));
  autoSaveAgeRange(minAge, form.max_age);  // ❌ form.max_age puede ser viejo
};

const handleMaxAgeChange = (maxAge: number) => {
  setForm((prev) => ({ ...prev, max_age: maxAge }));
  autoSaveAgeRange(form.min_age, maxAge);  // ❌ form.min_age puede ser viejo
};

// DESPUÉS ✅ - Un handler con ambos valores correctos
const handleAgeRangeChange = (minAge: number, maxAge: number) => {
  // Actualizar ambos valores juntos en el formulario
  setForm((prev) => ({
    ...prev,
    min_age: minAge,
    max_age: maxAge,  // ✅ Ambos valores actualizados juntos
  }));
  setFormErrors((prev) => {
    const next = { ...prev };
    delete next.min_age;
    delete next.max_age;
    return next;
  });
  // Auto-save con ambos valores correctos
  autoSaveAgeRange(minAge, maxAge);  // ✅ Ambos valores son los correctos
};
```

#### C. Mejora en `autoSave` general (líneas 409-468)

Ahora actualiza el formulario después de guardar exitosamente:

```typescript
if (result.success) {
  const updatedProfile = result.data;
  setProfile(updatedProfile);
  
  // Actualizar el formulario con los valores confirmados de la BD
  setForm(mapProfileToForm(updatedProfile));
  
  console.log(`[Profile] ${field} saved successfully`);
}
```

#### D. Cleanup de timeout (líneas 185-192)

Limpia el timeout cuando el componente se desmonta:

```typescript
useEffect(() => {
  return () => {
    if (ageRangeTimeoutRef.current) {
      clearTimeout(ageRangeTimeoutRef.current);
    }
  };
}, []);
```

## Beneficios de la Solución

### 1. **Atomicidad**
El rango de edad se guarda como una unidad atómica, evitando race conditions.

### 2. **Consistencia**
El formulario siempre refleja los valores confirmados de la base de datos.

### 3. **Validación**
Se valida que min_age <= max_age antes de guardar.

### 4. **Mejor UX**
- Solo guarda cuando el usuario termina de interactuar
- Debouncing evita requests innecesarios
- Feedback claro en caso de error

### 5. **Debugging**
Logs detallados facilitan identificar problemas:
```
[Profile] Auto-saving age range: {min_age: 25, max_age: 35}
[Profile] Age range saved successfully: {min_age: 25, max_age: 35}
```

### 6. **Manejo de Errores**
Muestra mensajes claros al usuario si algo falla.

### 7. **Performance**
Reduce significativamente el número de requests HTTP.

## Principios Aplicados

- **SOLID**: Responsabilidad única (función específica para rango de edad)
- **DRY**: Reutilización de lógica de validación y guardado
- **KISS**: Solución simple y directa al problema
- **Error Handling**: Manejo consistente de errores con feedback al usuario

## Testing Recomendado

1. **Móvil (iOS/Android)**:
   - Arrastrar el slider rápidamente
   - Verificar que solo se guarda al soltar
   - Verificar logs en consola
   - Verificar valores en Supabase

2. **Web**:
   - Cambiar valores en los pickers
   - Verificar debouncing (espera 800ms)
   - Verificar sincronización con BD

3. **Edge Cases**:
   - Intentar establecer min_age > max_age
   - Verificar comportamiento con red lenta
   - Verificar cleanup al cambiar de pantalla

## Archivos Modificados

1. `mobile-app/src/components/AgeRangePicker.tsx`
   - Cambio de `onValuesChange` a `onValuesChangeFinish`

2. `mobile-app/app/(app)/profile.tsx`
   - Agregado `useRef` import
   - Nueva función `autoSaveAgeRange` con debouncing
   - Actualización de handlers
   - Mejora en `autoSave` general
   - Cleanup de timeout

## Fecha de Implementación

22 de octubre de 2025

