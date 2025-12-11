# Cómo Ver Logs de Consola en Chrome iOS (iPhone Físico)

## 🔍 **Método 1: Usar Safari Web Inspector (Recomendado)**

Este es el método más confiable para ver los logs de Chrome en iPhone:

### Pasos:

1. **En tu Mac:**
   - Abre Safari
   - Ve a **Safari > Preferencias > Avanzado**
   - Activa la casilla **"Mostrar el menú Desarrollar en la barra de menú"**

2. **En tu iPhone:**
   - Ve a **Configuración > Safari > Avanzado**
   - Activa **"Web Inspector"**

3. **Conectar iPhone a Mac:**
   - Conecta tu iPhone al Mac con un cable USB
   - Acepta la confianza en el iPhone si aparece el mensaje

4. **Abrir Web Inspector:**
   - En Safari en Mac, ve al menú **"Desarrollar"**
   - Verás tu iPhone listado
   - Selecciona **"iPhone > Chrome"** (o el nombre de tu dispositivo)
   - Se abrirá una ventana de Web Inspector

5. **Ver los logs:**
   - En la ventana de Web Inspector, ve a la pestaña **"Console"**
   - Verás todos los `console.log()`, `console.error()`, etc.
   - Los logs de la app aparecerán con el prefijo `[ImageService]`

### Ventajas:
- ✅ Ver logs en tiempo real
- ✅ Ver errores de red en la pestaña "Network"
- ✅ Inspeccionar elementos HTML
- ✅ Ver todas las peticiones HTTP

---

## 🔍 **Método 2: Usar Chrome DevTools Remoto (Alternativa)**

Si no tienes Mac, puedes usar Chrome DevTools remoto:

### Pasos:

1. **En tu computadora (Windows/Linux/Mac):**
   - Abre Chrome
   - Ve a `chrome://inspect` en la barra de direcciones
   - Activa **"Discover USB devices"**

2. **En tu iPhone:**
   - Conecta el iPhone a la computadora con USB
   - Abre Chrome en el iPhone y navega a tu app

3. **Ver los logs:**
   - En `chrome://inspect` verás tu iPhone
   - Haz clic en **"inspect"** debajo de la sesión de Chrome
   - Se abrirá DevTools con los logs

---

## 🔍 **Método 3: Ver Logs Directamente en el iPhone (Limitado)**

Chrome en iPhone tiene una consola limitada:

1. **Abrir la consola:**
   - En Chrome iOS, abre la app
   - Toca la barra de direcciones
   - Escribe: `javascript:console.log('test')` y presiona Enter
   - Esto no es muy útil, pero confirma que la consola existe

2. **Usar alertas temporales:**
   - Puedes añadir `alert()` temporalmente en el código para ver errores
   - **Nota:** Esto es solo para debugging, quítalo después

---

## 📱 **Método 4: Usar Eruda (Consola Móvil en Pantalla)**

Puedes añadir Eruda, una consola móvil que se muestra en la pantalla:

### Instalación:

```bash
npm install eruda
```

### Uso en desarrollo:

```typescript
// En tu App.tsx o index.tsx, solo en desarrollo
if (__DEV__ && Platform.OS === 'web') {
  import('eruda').then((eruda) => {
    eruda.default.init();
  });
}
```

Esto mostrará una consola flotante en la pantalla del iPhone donde puedes ver los logs directamente.

---

## 🐛 **Qué Buscar en los Logs**

Con el logging mejorado que acabamos de añadir, busca estos mensajes:

### Logs de Inicio:
```
[ImageService] ===== UPLOAD VERIFICATION SELFIE START =====
[ImageService] Platform: web
[ImageService] Is Chrome iOS: true
[ImageService] Image URI type: { startsWithData: true, ... }
```

### Logs de Proceso:
```
[ImageService] 📸 Detected data URI, converting to blob...
[ImageService] ✅ Data URI converted to blob: { blobSize: ..., mimeType: ... }
[ImageService] ✅ File added to FormData: { filename: ..., fileSize: ... }
[ImageService] 📤 Sending POST request to: ...
```

### Logs de Error (si falla):
```
[ImageService] ===== UPLOAD ERROR =====
[ImageService] Error type: AxiosError
[ImageService] Axios error details: { response: { status: ..., data: ... } }
```

---

## 🔧 **Solución de Problemas Comunes**

### "No veo mi iPhone en Safari Web Inspector"
- ✅ Asegúrate de que el iPhone esté desbloqueado
- ✅ Acepta la confianza del dispositivo cuando aparezca
- ✅ Reinicia Safari en Mac
- ✅ Desconecta y vuelve a conectar el cable USB

### "Los logs no aparecen"
- ✅ Asegúrate de que la app esté cargada en Chrome iOS
- ✅ Refresca la página en Chrome iOS
- ✅ Verifica que estés en la pestaña correcta del Web Inspector

### "Veo errores de CORS"
- ✅ Verifica que el backend permita requests desde tu dominio
- ✅ Revisa los headers CORS en el servidor

### "Veo errores 401/403"
- ✅ Verifica que el token de autenticación sea válido
- ✅ Revisa que el header Authorization se esté enviando correctamente

---

## 📝 **Logs Específicos Añadidos**

He añadido logging detallado que muestra:

1. **Información de plataforma:**
   - Tipo de plataforma (web/ios/android)
   - User Agent completo
   - Si es Chrome iOS

2. **Información de la imagen:**
   - Tipo de URI (data/blob/otro)
   - Tamaño de la URI
   - Vista previa de la URI

3. **Proceso de conversión:**
   - Conversión de data URI a blob
   - Tamaño del blob resultante
   - Tipo MIME detectado

4. **FormData:**
   - Archivo añadido al FormData
   - Tamaño del archivo
   - Nombre del archivo

5. **Request HTTP:**
   - URL completa del endpoint
   - Headers enviados
   - Timeout configurado

6. **Errores detallados:**
   - Tipo de error
   - Mensaje completo
   - Detalles de respuesta del servidor (si aplica)
   - Detalles de la request (si aplica)

---

## 🎯 **Próximos Pasos**

1. **Conecta tu iPhone a tu Mac** (o usa otro método)
2. **Abre Web Inspector** en Safari
3. **Intenta subir una foto** de verificación
4. **Copia todos los logs** que aparezcan en la consola
5. **Comparte los logs** para que pueda identificar el problema exacto

Los logs ahora son muy detallados y deberían mostrar exactamente dónde está fallando el proceso.

---

**Fecha**: Enero 2025  
**Status**: ✅ Logging mejorado implementado  
**Próximo paso**: Ver logs en dispositivo físico








