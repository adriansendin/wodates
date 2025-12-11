# 📱 Instrucciones para Aplicar la Corrección del Teclado en Android

## ⚠️ IMPORTANTE: Debes reconstruir la app

Como modificamos el `AndroidManifest.xml`, **NO es suficiente con hot reload**. Debes reconstruir completamente la aplicación Android.

---

## 🔧 Pasos para Reconstruir

### Opción 1: Reconstruir con Expo (Recomendado)

```bash
cd mobile-app

# Limpiar cache y reconstruir
npx expo start --clear

# En otra terminal, o después de detener el servidor:
npx expo run:android
```

### Opción 2: Reconstruir con Gradle Directamente

```bash
cd mobile-app/android

# Windows PowerShell:
.\gradlew.bat clean

# Linux/Mac o Git Bash:
./gradlew clean

cd ..
npx expo run:android
```

### Opción 3: Desde Android Studio

1. Abrir `mobile-app/android` en Android Studio
2. Menu: **Build → Clean Project**
3. Menu: **Build → Rebuild Project**
4. Run desde Android Studio o usar:
   ```bash
   cd mobile-app
   npx expo run:android
   ```

---

## 📋 Cambios Realizados

### 1. **Login** - `mobile-app/app/(auth)/login.tsx`
- ✅ Cambiado `behavior` a `"height"` para Android
- ✅ Agregado `paddingBottom: 100` en Android
- ✅ Agregado `keyboardVerticalOffset: 20` para Android

### 2. **Registro Step1** - `mobile-app/app/(auth)/register/step1.tsx`
- ✅ Cambiado `behavior` a `"height"` para Android
- ✅ Agregado `paddingBottom: 100` en Android
- ✅ Agregado `keyboardVerticalOffset: 20` para Android

### 3. **Chat** - `mobile-app/app/chat/[matchId].tsx`
- ✅ Cambiado `behavior` a `"height"` para Android
- ✅ Mantenido `keyboardVerticalOffset: 0` para Android

### 4. **AndroidManifest.xml** - `mobile-app/android/app/src/main/AndroidManifest.xml`
- ✅ Cambiado `android:windowSoftInputMode="adjustResize"` → `"adjustPan"`

---

## 🧪 Verificación Después de Reconstruir

### ✅ Checklist de Testing:

#### Login:
- [ ] Abrir app → Ir a Login
- [ ] Tocar campo Email → ¿Se ve completo?
- [ ] Tocar campo Password → ¿Se ve el campo Y el botón Login?
- [ ] Escribir password → ¿Puedes ver lo que escribes?
- [ ] Intentar login → ¿Funciona?

#### Registro:
- [ ] Ir a Registro → Step 1
- [ ] Tocar campo Nombre → ¿Se ve?
- [ ] Tocar campo Email → ¿Se ve?
- [ ] Tocar campo Contraseña → ¿Se ve el campo Y el botón Continuar?
- [ ] Completar datos → ¿Todo visible?

#### Chat:
- [ ] Abrir un chat con alguien
- [ ] Tocar la caja de texto → ¿La caja está sobre el teclado?
- [ ] Escribir mensaje → ¿Ves lo que escribes?
- [ ] Enviar mensaje → ¿El chat hace scroll?
- [ ] Recibir mensajes → ¿Se ve correctamente?

---

## 🚨 Troubleshooting

### Problema: "Todavía se tapa el input"

**Solución 1:** Aumentar el padding
```typescript
// En los styles de cada pantalla
paddingBottom: Platform.OS === 'android' ? 150 : 40,
```

**Solución 2:** Volver a `adjustResize`
```xml
<!-- En AndroidManifest.xml -->
android:windowSoftInputMode="adjustResize"
```

**Solución 3:** Probar con KeyboardAwareScrollView
```bash
npm install react-native-keyboard-aware-scroll-view
```

### Problema: "La app no se reconstruye"

1. Cerrar completamente Metro Bundler (Ctrl+C varias veces)
2. Cerrar la app en el dispositivo
3. Ejecutar:
   ```bash
   cd mobile-app
   rm -rf node_modules/.cache
   npx expo start --clear
   npx expo run:android
   ```

### Problema: "Error al compilar"

1. Verificar que tienes las últimas dependencias:
   ```bash
   cd mobile-app
   npm install
   ```

2. Limpiar completamente:
   ```bash
   cd mobile-app/android
   ./gradlew clean
   cd ..
   rm -rf android/app/build
   npx expo run:android
   ```

---

## 📊 Antes vs Después

### Antes ❌
```
[Usuario toca Password]
→ Teclado aparece
→ Password queda OCULTO debajo del teclado
→ Usuario escribe "a ciegas"
→ NO puede ver si escribió correctamente
```

### Después ✅
```
[Usuario toca Password]
→ Teclado aparece
→ La vista se AJUSTA automáticamente
→ Password VISIBLE sobre el teclado
→ Usuario VE lo que escribe
→ Experiencia fluida y profesional
```

---

## 💡 Recordatorio

- ✅ **Siempre probar en dispositivo físico** (el emulador puede comportarse diferente)
- ✅ **Reconstruir después de cambiar AndroidManifest.xml**
- ✅ **Limpiar cache si hay problemas**: `npx expo start --clear`

---

## 🎯 Resultado Esperado

Después de reconstruir, deberías tener:
- ✅ Login con ambos campos visibles al escribir
- ✅ Registro con los 3 campos siempre visibles
- ✅ Chat con input siempre sobre el teclado
- ✅ Transiciones suaves sin saltos
- ✅ Experiencia idéntica en Android e iOS

---

## 📞 Si Algo No Funciona

Si después de seguir todos estos pasos aún tienes problemas:

1. Toma una captura de pantalla del problema
2. Revisa los logs en la consola
3. Comprueba que realmente reconstruiste (cierra la app completamente)
4. Verifica la versión de Expo: `npx expo --version`
5. Asegúrate de estar usando un dispositivo físico, no solo emulador

---

**¡Mucha suerte! 🚀**

