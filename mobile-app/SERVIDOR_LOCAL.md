# Cómo servir la app desde tu PC y acceder desde el móvil

## Opción 1: Servir el build de producción (Recomendado para probar PWA)

### En tu PC:

```powershell
cd c:\Projects\wodates\mobile-app

# 1. Asegúrate de tener el build actualizado
npm run build

# 2. Sirve el build de producción en la red local
npx serve dist -p 8080 --host 0.0.0.0
```

Esto mostrará algo como:
```
   ┌──────────────────────────────────────────────────┐
   │                                                  │
   │   Serving!                                       │
   │                                                  │
   │   - Local:    http://localhost:8080             │
   │   - Network:  http://192.168.1.11:8080          │
   │                                                  │
   └──────────────────────────────────────────────────┘
```

### Desde tu móvil (misma red WiFi):

1. Abre el navegador (Chrome para Android, Safari para iOS)
2. Ve a: `http://192.168.1.11:8080`
3. La app debería cargar

**Nota importante para PWA:**
- Para probar la instalación de PWA, necesitas HTTPS (excepto localhost)
- HTTP funciona para desarrollo básico, pero algunas funciones PWA pueden estar limitadas
- Para instalación completa, usa un túnel HTTPS (ver Opción 2)

---

## Opción 2: Servidor de desarrollo Expo (Hot reload)

### En tu PC:

```powershell
cd c:\Projects\wodates\mobile-app

# Inicia el servidor de desarrollo Expo
npm run web
# o
npm start
```

Cuando aparezca el menú de Expo, presiona `w` para abrir en web.

### Desde tu móvil:

1. Abre el navegador
2. Ve a: `http://192.168.1.11:8081` (o el puerto que muestre Expo)
3. La app cargará con hot reload

---

## Opción 3: Túnel HTTPS para probar instalación PWA completa

Para probar la instalación de PWA (Android "Install app", iOS "Add to Home Screen"), necesitas HTTPS.

### Usando ngrok (gratis):

1. **Instala ngrok**: https://ngrok.com/download

2. **En tu PC, en una terminal:**
   ```powershell
   # Terminal 1: Sirve la app
   cd c:\Projects\wodates\mobile-app
   npx serve dist -p 8080
   ```

3. **En otra terminal:**
   ```powershell
   # Terminal 2: Crea túnel HTTPS
   ngrok http 8080
   ```

4. **ngrok mostrará algo como:**
   ```
   Forwarding  https://abc123.ngrok.io -> http://localhost:8080
   ```

5. **Desde tu móvil:**
   - Abre: `https://abc123.ngrok.io`
   - Ahora puedes probar la instalación PWA completa

---

## Verificar que funciona

### Desde tu PC:
- Abre `http://localhost:8080` en tu navegador
- Deberías ver la app funcionando

### Desde tu móvil:
- Abre `http://192.168.1.11:8080` (misma red WiFi)
- Deberías ver la misma app

### Verificar IP de tu PC:

```powershell
# Ver tu IP local
ipconfig | findstr IPv4
```

Busca la IP que empiece con `192.168.` o `10.` - esa es la que debes usar desde el móvil.

---

## Troubleshooting

### "No puedo acceder desde el móvil"

1. **Verifica que están en la misma red WiFi**
   - PC y móvil deben estar en la misma red

2. **Verifica el firewall de Windows**
   ```powershell
   # Permite el puerto 8080 en el firewall
   New-NetFirewallRule -DisplayName "Wodates Dev Server" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
   ```

3. **Verifica la IP**
   - Asegúrate de usar la IP correcta de tu PC
   - Puede cambiar si te conectas a otra red

### "PWA no se puede instalar"

- En desarrollo (HTTP), algunas funciones PWA están limitadas
- Para instalación completa, usa HTTPS (ngrok o servidor con SSL)

---

## Resumen rápido

**Para desarrollo rápido:**
```powershell
npm run build
npx serve dist -p 8080 --host 0.0.0.0
```
Móvil: `http://192.168.1.11:8080`

**Para probar instalación PWA:**
```powershell
npm run build
npx serve dist -p 8080
# En otra terminal:
ngrok http 8080
```
Móvil: `https://[url-de-ngrok]`
