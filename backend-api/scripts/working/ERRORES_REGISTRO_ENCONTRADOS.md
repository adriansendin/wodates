# ERRORES ENCONTRADOS EN EL FLUJO DE REGISTRO

## 🔴 PROBLEMA PRINCIPAL: Los usuarios tienen `gender: NULL` y `looking_for: NULL` en la base de datos

## 📋 ERRORES IDENTIFICADOS:

### 1. **ERROR CRÍTICO: Valor por defecto en `complete.tsx` línea 23**
```typescript
const gender = (rawUser.gender ?? 'male') as Gender;
```
**Problema**: Cuando el usuario se registra y el backend devuelve `gender: null` o `gender: undefined`, esta función lo convierte en `'male'` por defecto. Esto NO afecta la base de datos, pero puede causar confusión en el frontend.

**Ubicación**: `mobile-app/app/(auth)/register/complete.tsx:23`

---

### 2. **ERROR CRÍTICO: Conversión de cadenas vacías a `undefined` en `complete.tsx` línea 62-65**
```typescript
gender: (data.gender && data.gender !== '') ? data.gender : undefined,
lookingFor: (data.lookingFor && data.lookingFor !== '') ? data.lookingFor : undefined,
```
**Problema**: Si `data.gender` o `data.lookingFor` son cadenas vacías `''`, se convierten en `undefined`, que luego se convierte en `NULL` en la base de datos.

**Ubicación**: `mobile-app/app/(auth)/register/complete.tsx:62-65`

**Flujo del error**:
1. Usuario completa step4 pero no selecciona género (aunque ahora está validado, podría haber casos edge)
2. `data.gender = ''` (cadena vacía)
3. En `complete.tsx`: `data.gender || undefined` → `undefined`
4. Se envía `undefined` al backend
5. Backend recibe `undefined` y lo convierte en `NULL` en la base de datos

---

### 3. **ERROR CRÍTICO: Backend convierte `undefined` en `NULL` en `supabase-auth-service.ts` línea 118 y 121**
```typescript
gender: registerRequest.gender || null,
looking_for: registerRequest.lookingFor || null,
```
**Problema**: Si `registerRequest.gender` es `undefined` o cadena vacía `''`, se convierte en `null` y se guarda como `NULL` en la base de datos.

**Ubicación**: `backend-api/src/app/services/supabase-auth-service.ts:118,121`

**Flujo del error**:
1. Frontend envía `gender: undefined` o `gender: ''`
2. Backend recibe `undefined` o `''`
3. `registerRequest.gender || null` → `null`
4. Se guarda `NULL` en la base de datos

---

### 4. **PROBLEMA MENOR: Navegación incorrecta en `step4.tsx` línea 40**
```typescript
router.push('/(auth)/register/step2');
```
**Problema**: Según el flujo actual, step4 va a step2, lo cual es correcto según el orden de los steps. PERO el `ProgressBar` muestra `currentStep={2}` cuando debería mostrar el step correcto según el orden lógico.

**Ubicación**: `mobile-app/app/(auth)/register/step4.tsx:40`

**Nota**: El flujo real es:
- step3 (ciudad) → step4 (género/looking_for) → step2 (fecha/edad) → step5 (plan familiar) → step6 (hábitos) → step1 (credenciales) → step7 (avatar) → complete

---

### 5. **PROBLEMA MENOR: Validación en `step4.tsx`**
**Estado actual**: Ya se corrigió para validar ambos campos, pero hay que asegurarse de que:
- No haya valores por defecto
- No se pueda avanzar sin seleccionar ambos campos
- Los valores se guarden correctamente en el store

**Ubicación**: `mobile-app/app/(auth)/register/step4.tsx`

---

## 🔍 FLUJO COMPLETO DEL ERROR:

1. **Usuario completa step4**:
   - Selecciona género y lookingFor
   - Se guardan en el store: `{ gender: 'male', lookingFor: 'female' }`

2. **Usuario navega por los steps**:
   - Los datos permanecen en el store ✅

3. **Usuario llega a `complete.tsx`**:
   - `data.gender = 'male'` ✅
   - `data.lookingFor = 'female'` ✅
   - Se prepara `registerData`:
     ```typescript
     gender: (data.gender && data.gender !== '') ? data.gender : undefined
     // Si data.gender = 'male' → gender = 'male' ✅
     ```

4. **Se envía al backend**:
   - `registerRequest.gender = 'male'` ✅
   - `registerRequest.lookingFor = 'female'` ✅

5. **Backend guarda en la base de datos**:
   ```typescript
   gender: registerRequest.gender || null
   // Si registerRequest.gender = 'male' → gender = 'male' ✅
   ```

**PERO** si en algún momento `data.gender` o `data.lookingFor` son cadenas vacías `''` o `undefined`, se convierten en `NULL`.

---

## 🎯 CAUSAS RAÍCES:

1. **Falta de validación estricta**: Aunque ahora se valida en step4, si el usuario navega hacia atrás y modifica los datos, podría perder los valores.

2. **Conversión implícita**: El uso de `||` para valores por defecto puede convertir valores válidos pero "falsy" en `null`.

3. **Falta de validación en el backend**: El backend no valida que `gender` y `lookingFor` sean valores válidos antes de guardarlos.

---

## ✅ SOLUCIONES NECESARIAS:

1. **Eliminar valor por defecto en `normalizeUser`** (línea 23 de complete.tsx)
2. **Mejorar validación en `complete.tsx`** antes de enviar al backend
3. **Agregar validación en el backend** antes de guardar en la base de datos
4. **Asegurar que el store siempre tenga valores válidos** (no cadenas vacías)
5. **Validar que los valores sean del tipo correcto** antes de guardar

