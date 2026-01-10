# Textos en Español de Cara al Usuario

Este documento lista todos los textos en español que aparecen de cara al usuario real en la aplicación móvil.

## 📍 Ubicaciones de Textos en Español

### 1. Feed Screen (`app/(app)/feed.tsx`)

**Línea 71**: Hint de accesibilidad para botón de rechazar
- `accessibilityHint="Descarta este perfil sugerido"` → Debería ser: `"Discards this suggested profile"`

**Línea 99**: Label de accesibilidad para botón de aceptar
- `accessibilityLabel="Quiero conocerle"` → Debería ser: `"I want to meet them"`

**Línea 100**: Hint de accesibilidad para botón de aceptar
- `accessibilityHint="Muestra interés en esta persona"` → Debería ser: `"Shows interest in this person"`

**Línea 839**: Mensaje cuando no hay más usuarios en el feed
- `'Wodates prioriza calidad sobre cantidad. Mejora tu afinidad hablando con Doc Love'` → Debería ser: `'Wodates prioritizes quality over quantity. Improve your affinity by talking with Doc Love'`

**Línea 937**: Hint de accesibilidad para icono de bio
- `accessibilityHint="Muestra la bio del usuario"` → Debería ser: `"Shows the user's bio"`

### 2. Discover Action Buttons (`src/components/DiscoverActionButtons.tsx`)

**Línea 26**: Hint de accesibilidad para botón de rechazar
- `accessibilityHint="Descarta este perfil sugerido"` → Debería ser: `"Discards this suggested profile"`

**Línea 39**: Hint de accesibilidad para botón de aceptar
- `accessibilityHint="Muestra interés en esta persona"` → Debería ser: `"Shows interest in this person"`

### 3. Profile Screen (`app/(app)/profile.tsx`)

**Línea 1096**: Fallback cuando no hay nombre de usuario
- `{profile?.name ?? user?.name ?? 'Usuario'}` → Debería ser: `{profile?.name ?? user?.name ?? 'User'}`

### 4. Formateo de Fechas en Chat (`app/chat/[matchId].tsx`)

**✅ YA CORREGIDO** - Las fechas ahora están en inglés (líneas 142, 146, 150-152)

### 5. Nombre de Usuario por Defecto en Matches (`app/(app)/matches.tsx`)

**✅ YA CORREGIDO** - Ahora usa 'Someone' en lugar de 'Alguien' (línea 150)

### 6. Mensaje de Plataforma (`src/components/PlatformInfo.tsx`)

**✅ YA CORREGIDO** - Ahora usa texto en inglés (línea 21)

## 🔍 Resumen de Textos que Necesitan Traducción

**✅ TODOS LOS TEXTOS HAN SIDO TRADUCIDOS**

Todos los textos en español han sido corregidos y traducidos al inglés:

1. ✅ **"Descarta este perfil sugerido"** → "Dismiss this suggested profile" (2 ubicaciones)
2. ✅ **"Quiero conocerle"** → "I want to meet them"
3. ✅ **"Muestra interés en esta persona"** → "Show interest in this person" (2 ubicaciones)
4. ✅ **"Wodates prioriza calidad sobre cantidad. Mejora tu afinidad hablando con Doc Love"** → "Wodates prioritizes quality over quantity. Improve your affinity by talking with Doc Love."
5. ✅ **"Muestra la bio del usuario"** → "View the user's bio"
6. ✅ **"Usuario"** → "User"

## 📝 Notas

- Los textos de accesibilidad (`accessibilityLabel` y `accessibilityHint`) son importantes para usuarios con discapacidades visuales que usan lectores de pantalla.
- El mensaje en el feed (línea 839) se muestra cuando no hay más usuarios disponibles para mostrar.
- El texto "Usuario" se usa como fallback cuando no hay nombre de usuario disponible en el perfil.
- Algunos textos ya han sido corregidos (fechas en chat, nombre en matches, mensaje de plataforma).

## 🎯 Recomendación

Se recomienda crear un sistema de internacionalización (i18n) para manejar todos estos textos de forma centralizada y facilitar futuras traducciones a otros idiomas.
