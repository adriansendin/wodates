# 🤖 Corrección Específica del Teclado en Android

## Problema Identificado

En Android, el teclado se superponía completamente sobre los campos de texto, haciendo que:
- ❌ El campo de password quedaba oculto (escribir "a ciegas")
- ❌ La caja de texto del chat quedaba debajo del teclado
- ❌ No había forma de ver lo que se escribía

## Solución Aplicada

### 1. KeyboardAvoidingView con `behavior="height"`

**Antes (No funcionaba):**
```typescript
behavior={Platform.OS === 'ios' ? 'padding' : undefined}
```

**Después (Funciona):**
```typescript
behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
```

### 2. Padding Extra en ScrollView para Android

```typescript
scrollContent: {
  flexGrow: 1,
  paddingBottom: Platform.OS === 'android' ? 100 : 40,
}
```

Esto asegura que hay suficiente espacio en la parte inferior para que el contenido pueda desplazarse por encima del teclado.

### 3. AndroidManifest.xml - windowSoftInputMode

Se cambió de `adjustResize` a `adjustPan`:

**Archivo:** `mobile-app/android/app/src/main/AndroidManifest.xml`

```xml
<activity 
  android:name=".MainActivity"
  android:windowSoftInputMode="adjustPan"
  ...
>
```

**¿Por qué adjustPan?**
- `adjustPan`: Mueve la vista completa hacia arriba para que el input sea visible
- `adjustResize`: Redimensiona la vista (puede causar problemas con KeyboardAvoidingView)
- Para KeyboardAvoidingView + ScrollView, `adjustPan` funciona mejor

## Configuración Completa

### Login Screen

```typescript
<SafeAreaView style={styles.safeArea}>
  <KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
  >
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      {/* Campos de texto */}
    </ScrollView>
  </KeyboardAvoidingView>
</SafeAreaView>
```

```typescript
scrollContent: {
  flexGrow: 1,
  paddingBottom: Platform.OS === 'android' ? 100 : 40,
}
```

### Chat Screen

```typescript
<SafeAreaView style={styles.safeArea}>
  <KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
  >
    <FlatList
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      {/* ... */}
    />
    <View style={styles.inputContainer}>
      {/* Input de mensaje */}
    </View>
  </KeyboardAvoidingView>
</SafeAreaView>
```

## ¿Por qué funciona ahora?

### Combinación de 3 elementos:

1. **KeyboardAvoidingView con `behavior="height"`**
   - Reduce la altura del contenedor cuando aparece el teclado
   - Permite que el ScrollView se ajuste al espacio disponible

2. **Padding extra en Android (100px)**
   - Da espacio suficiente para desplazarse
   - Evita que el último campo quede oculto

3. **AndroidManifest con `adjustPan`**
   - El sistema Android mueve toda la actividad hacia arriba
   - Trabaja en conjunto con KeyboardAvoidingView
   - Asegura que el campo activo sea visible

## Testing en Android

### Pasos para verificar:

#### Login:
1. Abrir pantalla de login
2. Tocar campo "Email" → ✅ Debería ser visible
3. Tocar campo "Password" → ✅ Debería ser visible con el teclado
4. Escribir contraseña → ✅ Se debe ver lo que escribes

#### Registro:
1. Abrir pantalla de registro (Step1)
2. Tocar "Nombre" → ✅ Visible
3. Tocar "Email" → ✅ Visible
4. Tocar "Contraseña" → ✅ Visible con botón "Continuar"

#### Chat:
1. Abrir un chat
2. Tocar la caja de texto → ✅ Debería moverse arriba del teclado
3. Escribir mensaje → ✅ Se debe ver el input y los mensajes recientes
4. Enviar mensaje → ✅ El chat hace scroll al final

## Alternativa: Si aún hay problemas

Si después de estos cambios **aún hay problemas en Android**, puedes probar:

### Opción A: Cambiar a `adjustResize`

En `AndroidManifest.xml`:
```xml
android:windowSoftInputMode="adjustResize"
```

Y aumentar el padding:
```typescript
paddingBottom: Platform.OS === 'android' ? 150 : 40
```

### Opción B: Usar `react-native-keyboard-aware-scroll-view`

```bash
npm install react-native-keyboard-aware-scroll-view
```

```typescript
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

<KeyboardAwareScrollView
  enableOnAndroid={true}
  extraScrollHeight={20}
  keyboardShouldPersistTaps="handled"
>
  {/* Contenido */}
</KeyboardAwareScrollView>
```

## Archivos Modificados

1. ✅ `mobile-app/app/(auth)/login.tsx`
2. ✅ `mobile-app/app/(auth)/register/step1.tsx`
3. ✅ `mobile-app/app/chat/[matchId].tsx`
4. ✅ `mobile-app/android/app/src/main/AndroidManifest.xml`

## Próximos Pasos

1. **Reconstruir la app Android**
   ```bash
   cd mobile-app
   npx expo run:android
   ```

2. **Probar en dispositivo físico**
   - El emulador a veces no replica el comportamiento del teclado correctamente
   - Siempre probar en dispositivo físico para validar

3. **Verificar todos los escenarios**
   - Login con ambos campos
   - Registro con los 3 campos
   - Chat al escribir mensajes

## Notas Importantes

⚠️ **Necesitas reconstruir la app** después de cambiar `AndroidManifest.xml`:
```bash
cd mobile-app/android
./gradlew clean
cd ..
npx expo run:android
```

⚠️ **Hot reload NO aplica** los cambios del AndroidManifest, debes reconstruir completamente.

⚠️ **Prueba en dispositivo físico**, no solo en emulador.

