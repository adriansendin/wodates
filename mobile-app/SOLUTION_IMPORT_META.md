# Solución al error "Cannot use 'import.meta' outside a module"

## Problema
En Expo SDK 54, la versión web usa **Metro bundler** (no Webpack). Cuando Metro resuelve el paquete `zustand`, selecciona la versión ESM (`.mjs`) que utiliza `import.meta`, lo cual causa un error en el navegador porque el código no se está transformando correctamente.

## Causa raíz
- **Expo SDK 54** usa Metro como bundler por defecto para web (Webpack ya no es soportado)
- **Zustand 4.4.1** tiene exportaciones duales: ESM (`.mjs` con `import.meta`) y CommonJS (`.js`)
- Metro estaba eligiendo la versión ESM que usa `import.meta`
- `import.meta` no es compatible con todos los bundlers/navegadores sin transformación

## Solución implementada

### 1. Configuración de Metro (`metro.config.js`)
Se agregó un `resolveRequest` personalizado que **fuerza** a Metro a usar la versión CommonJS de Zustand cuando se bundlea para web:

```javascript
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'zustand') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/zustand/index.js'),
      type: 'sourceFile',
    };
  }
  
  return context.resolveRequest(context, moduleName, platform);
};
```

### 2. Configuración de app.json
Mantenemos Metro como bundler:
```json
"web": {
  "bundler": "metro"
}
```

### 3. Archivos eliminados
- **webpack.config.js** - No se usa en Expo SDK 54
- **babel-plugin-transform-import-meta** - Ya no es necesario

## Cómo probar la solución

1. **Detener el servidor** si está corriendo (Ctrl+C)

2. **Limpiar caché y reiniciar**:
   ```bash
   npx expo start --clear
   ```

3. **Abrir en web**:
   - Presiona `w` en la terminal, o
   - Abre el navegador en `http://localhost:8081`

4. **Verificar que funcione**:
   - El botón de login debería funcionar
   - No debería aparecer el error de `import.meta` en la consola de Chrome

## Notas técnicas

### ¿Por qué funciona?
- La versión CommonJS (`index.js`) usa `require()` en lugar de `import.meta`
- Metro puede procesar esta versión sin problemas
- El código sigue funcionando igual en iOS/Android (usan la versión nativa)

### Exportaciones de Zustand
```json
"exports": {
  ".": {
    "import": "./esm/index.mjs",  // ESM con import.meta ❌
    "default": "./index.js"        // CommonJS ✅
  }
}
```

### Archivos modificados
- ✅ `metro.config.js` - Agregado resolveRequest personalizado
- ✅ `babel.config.js` - Simplificado (removidos plugins innecesarios)
- ✅ `app.json` - Confirmado uso de Metro
- ❌ `webpack.config.js` - Eliminado (no compatible con SDK 54)

## Si el problema persiste

1. Verificar que no haya otros paquetes usando `import.meta`:
   ```bash
   grep -r "import.meta" node_modules/
   ```

2. Limpiar completamente:
   ```bash
   rm -rf node_modules .expo web-build
   npm install
   npx expo start --clear
   ```

3. Verificar versiones:
   - Expo: ~54.0.0 ✅
   - Zustand: ^4.4.1 ✅
   - React: 18.2.0 ✅

## Referencias
- [Expo Metro Config](https://docs.expo.dev/guides/customizing-metro/)
- [Zustand Package Exports](https://github.com/pmndrs/zustand/blob/main/package.json)
- [Metro Resolver](https://metrobundler.dev/docs/resolution)

