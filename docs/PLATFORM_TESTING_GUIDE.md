# Guía de Pruebas por Plataforma - Subida de Avatares

## Resumen

La funcionalidad de subida de fotos de perfil está diseñada para funcionar en dispositivos móviles (iOS y Android). En el navegador web, la funcionalidad está deshabilitada con mensajes informativos apropiados.

## Comportamiento por Plataforma

### 🌐 **Navegador Web (Windows/Mac/Linux)**
- ❌ **Cámara**: No disponible
- ❌ **Galería**: No disponible
- ✅ **Mensajes informativos**: Sí
- ✅ **Navegación**: Funciona normalmente
- ✅ **Omitir paso**: Disponible en registro

**Mensajes mostrados:**
- En perfil: "La subida de fotos no está disponible en el navegador web. Para subir tu foto de perfil, usa la aplicación móvil en iOS o Android."
- En registro: "La subida de fotos no está disponible en el navegador web. Puedes omitir este paso y añadir tu foto más tarde desde la aplicación móvil."

### 📱 **iOS (Simulador/Dispositivo)**
- ✅ **Cámara**: Disponible
- ✅ **Galería**: Disponible
- ✅ **ActionSheet nativo**: Sí
- ✅ **Permisos**: Se solicitan automáticamente
- ✅ **Compresión**: Funciona

### 🤖 **Android (Emulador/Dispositivo)**
- ✅ **Cámara**: Disponible
- ✅ **Galería**: Disponible
- ✅ **Dialog nativo**: Sí
- ✅ **Permisos**: Se solicitan automáticamente
- ✅ **Compresión**: Funciona

## Cómo Probar

### 1. **En Navegador Web (Desarrollo)**
```bash
cd mobile-app
npm start
# Seleccionar 'w' para web
```

**Qué esperar:**
- Los botones de avatar muestran "Solo móvil" con icono 🌐
- Al hacer clic, aparece un mensaje explicativo
- En el registro, puedes omitir el paso 6
- La navegación funciona normalmente

### 2. **En iOS Simulador**
```bash
cd mobile-app
npm start
# Seleccionar 'i' para iOS
```

**Qué esperar:**
- ActionSheet nativo con opciones "Tomar foto" y "Elegir de galería"
- En simulador, la cámara usará fotos de muestra
- La galería mostrará fotos del simulador

### 3. **En Android Emulador**
```bash
cd mobile-app
npm start
# Seleccionar 'a' para Android
```

**Qué esperar:**
- Dialog nativo con opciones "Tomar foto" y "Elegir de galería"
- En emulador, la cámara usará fotos de muestra
- La galería mostrará fotos del emulador

### 4. **En Dispositivo Real**
```bash
cd mobile-app
npm start
# Escanear QR con Expo Go
```

**Qué esperar:**
- Funcionalidad completa de cámara y galería
- Permisos reales solicitados
- Compresión real de imágenes
- Upload real a Supabase Storage

## Configuración de Pruebas

### Para iOS Simulador
1. Abrir Simulator
2. Ir a Device > Photos
3. Añadir algunas fotos de prueba
4. Ejecutar la app y probar la galería

### Para Android Emulador
1. Abrir Android Studio
2. Crear un emulador con Google Play
3. En el emulador, abrir Galería
4. Añadir algunas fotos de prueba
5. Ejecutar la app y probar la galería

## Casos de Prueba

### ✅ **Casos que Funcionan en Web**
- [x] Navegación entre pantallas
- [x] Registro completo (omitiendo foto)
- [x] Edición de perfil (sin foto)
- [x] Mensajes informativos
- [x] Botones de omitir

### ✅ **Casos que Funcionan en Móvil**
- [x] Selección de foto desde galería
- [x] Captura de foto con cámara
- [x] Compresión automática
- [x] Upload a Supabase Storage
- [x] Actualización de perfil
- [x] Manejo de permisos
- [x] Manejo de errores

### ❌ **Casos que NO Funcionan en Web**
- [x] Acceso a cámara
- [x] Acceso a galería
- [x] Upload de archivos
- [x] Compresión de imágenes

## Solución de Problemas

### Problema: "No pasa nada al hacer clic"
**Causa**: Estás en navegador web
**Solución**: Usar dispositivo móvil o emulador

### Problema: "Permission denied"
**Causa**: Permisos no concedidos
**Solución**: 
1. iOS: Settings > Privacy > Camera/Photos > Expo Go
2. Android: Settings > Apps > Expo Go > Permissions

### Problema: "Upload failed"
**Causa**: Configuración de Supabase
**Solución**: Verificar variables de entorno y políticas de Storage

### Problema: "Image too large"
**Causa**: Imagen > 500KB
**Solución**: La compresión debería manejarlo automáticamente

## Desarrollo y Debugging

### Logs Útiles
```javascript
// En imageService.ts
console.log('[ImageService] Platform:', Platform.OS);
console.log('[ImageService] Image size:', size);
console.log('[ImageService] Upload result:', result);
```

### Verificar Plataforma
```javascript
import { Platform } from 'react-native';

console.log('Current platform:', Platform.OS);
// 'web' | 'ios' | 'android'
```

### Simular Diferentes Plataformas
```bash
# Forzar plataforma en desarrollo
npx expo start --web
npx expo start --ios
npx expo start --android
```

## Mejores Prácticas

### Para Desarrollo
1. **Desarrolla en web** para UI/UX rápidas
2. **Prueba en móvil** para funcionalidades nativas
3. **Usa emuladores** para pruebas consistentes
4. **Prueba en dispositivos reales** para casos finales

### Para Testing
1. **Prueba todos los flujos** en cada plataforma
2. **Verifica mensajes de error** apropiados
3. **Confirma permisos** funcionan correctamente
4. **Valida compresión** con imágenes grandes

### Para Producción
1. **Configura Supabase** correctamente
2. **Establece políticas** de seguridad
3. **Prueba en dispositivos reales**
4. **Monitorea logs** de errores

## Conclusión

La funcionalidad está diseñada para ser **progresiva**:
- ✅ **Web**: Navegación y mensajes informativos
- ✅ **Móvil**: Funcionalidad completa

Esto permite a los usuarios usar la app en web para navegación básica, pero necesitan la app móvil para funcionalidades avanzadas como subir fotos.

---

**Última actualización**: Octubre 2025  
**Versión**: 1.0.0







