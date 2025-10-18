# 🎯 Solución Android - Paso a Paso

## 📸 Problema que Reportaste

En la captura de pantalla de Android viste que:
- ❌ El campo de **password** queda OCULTO debajo del teclado
- ❌ En el **chat**, la caja de texto también queda debajo del teclado
- ❌ Tienes que escribir "a ciegas" sin ver lo que escribes

---

## ✅ Solución Aplicada

He modificado **4 archivos** para solucionar esto:

### 1️⃣ Login (`mobile-app/app/(auth)/login.tsx`)
```typescript
// Cambiado para Android:
behavior="height" (antes era undefined)
keyboardVerticalOffset={20} (antes era 0)
paddingBottom: 100 (antes era 40)
```

### 2️⃣ Registro (`mobile-app/app/(auth)/register/step1.tsx`)
```typescript
// Cambiado para Android:
behavior="height"
keyboardVerticalOffset={20}
paddingBottom: 100
```

### 3️⃣ Chat (`mobile-app/app/chat/[matchId].tsx`)
```typescript
// Cambiado para Android:
behavior="height"
keyboardVerticalOffset={0}
```

### 4️⃣ AndroidManifest.xml (`mobile-app/android/app/src/main/AndroidManifest.xml`)
```xml
<!-- Cambiado de adjustResize a: -->
android:windowSoftInputMode="adjustPan"
```

---

## 🚀 QUÉ DEBES HACER AHORA

### ⚠️ PASO CRÍTICO: Debes reconstruir la app

Como modifiqué el `AndroidManifest.xml`, **hot reload NO es suficiente**.

### Opción A: Con Expo (MÁS FÁCIL)

```bash
cd mobile-app
npx expo run:android
```

Espera a que compile y se instale en tu dispositivo.

### Opción B: Limpiar y Reconstruir

```bash
cd mobile-app

# Limpiar cache
npx expo start --clear

# En otra terminal:
npx expo run:android
```

---

## 🧪 Cómo Verificar que Funciona

### Test 1: Login
1. Abrir la app
2. Ir a pantalla de Login
3. Tocar campo **Email** → ✅ Debe verse completo
4. Tocar campo **Password** → ✅ Debe verse SOBRE el teclado
5. Escribir contraseña → ✅ Debes VER lo que escribes

### Test 2: Registro
1. Ir a Registro (Step 1)
2. Tocar **Nombre** → ✅ Visible
3. Tocar **Email** → ✅ Visible
4. Tocar **Contraseña** → ✅ Visible CON el botón "Continuar"

### Test 3: Chat
1. Abrir un chat
2. Tocar la caja de texto → ✅ La caja debe SUBIR sobre el teclado
3. Escribir mensaje → ✅ Debes ver el input y los mensajes

---

## 🎯 Resultado Esperado

### Antes (tu captura) ❌
```
Login:
[Campo Email visible]
[Teclado aparece]
[Campo Password OCULTO] ← Problema
[Escribes sin ver nada] ← Problema
```

### Después (con la corrección) ✅
```
Login:
[Campo Email visible]
[Teclado aparece]
[Vista se AJUSTA automáticamente]
[Campo Password VISIBLE sobre el teclado] ← Solucionado
[Ves todo lo que escribes] ← Solucionado
```

---

## 🔍 Si Aún No Funciona

### 1. Asegúrate de haber reconstruido
```bash
# Cierra la app COMPLETAMENTE en el dispositivo
# Luego ejecuta:
cd mobile-app
npx expo run:android
```

### 2. Limpia la build
```bash
cd mobile-app/android
./gradlew clean
cd ..
npx expo run:android
```

### 3. Verifica que estás usando el dispositivo físico
- El emulador a veces se comporta diferente
- Siempre prueba en tu dispositivo Android físico

### 4. Aumenta el padding si es necesario
Si todavía se tapa un poco, puedes aumentar el padding:

**En login.tsx y step1.tsx:**
```typescript
paddingBottom: Platform.OS === 'android' ? 150 : 40, // Aumentado a 150
```

---

## 📋 Resumen de Cambios

| Archivo | Cambio Principal |
|---------|-----------------|
| `login.tsx` | `behavior="height"` + padding 100px |
| `step1.tsx` | `behavior="height"` + padding 100px |
| `[matchId].tsx` | `behavior="height"` para Android |
| `AndroidManifest.xml` | `adjustPan` en lugar de `adjustResize` |

---

## 💡 Por Qué Funciona Ahora

**Combinación de 3 factores:**

1. **`behavior="height"`** → Reduce la altura del contenedor cuando aparece el teclado
2. **`paddingBottom: 100`** → Da espacio extra para desplazar el contenido
3. **`adjustPan`** → Android mueve toda la vista hacia arriba automáticamente

Estos 3 elementos trabajando juntos aseguran que **SIEMPRE** veas el campo donde estás escribiendo.

---

## ✨ Documentación Adicional

He creado 3 documentos con más detalles:

1. **`ANDROID_KEYBOARD_FIX.md`** → Explicación técnica detallada
2. **`INSTRUCCIONES_REBUILD_ANDROID.md`** → Guía completa de reconstrucción
3. **`KEYBOARD_FIX_SUMMARY.md`** → Resumen general para ambas plataformas

---

## 🎉 Próximos Pasos

1. ✅ **Reconstruir**: `npx expo run:android`
2. ✅ **Probar Login**: Tocar password y verificar que se ve
3. ✅ **Probar Registro**: Tocar contraseña y verificar
4. ✅ **Probar Chat**: Tocar input y verificar
5. ✅ **Celebrar**: ¡Todo debería funcionar! 🚀

---

**¿Necesitas ayuda adicional?**
- Si después de reconstruir aún hay problemas, toma otra captura
- Verifica que cerraste completamente la app antes de probar
- Asegúrate de estar en un dispositivo físico Android

**¡Éxito! 💪**

