# WODATES App Routing

```
app/
|- _layout.tsx               # Root stack + shared providers (SafeArea, StatusBar)
|- index.tsx                 # Marketing landing page + auth-aware redirect
|- +not-found.tsx            # 404 fallback
|- (auth)/                   # Public-only routes
|  |- _layout.tsx           # Redirects authenticated users to the protected area
|  |- login.tsx             # Sign-in flow
|- (app)/                    # Authenticated tabs
|  |- _layout.tsx           # Bottom tabs (Feed, Matches)
|  |- feed.tsx              # Swipe feed + matchmaking actions
|  |- matches.tsx           # Matches list with navigation to chat
`- chat/
   `- [matchId].tsx         # Chat detail screen, nested in the root stack
```

- Nested stacks & tabs are handled exclusively via Expo Router layouts.
- Route guards live inside the respective `_layout.tsx` files to keep auth logic close to the routes.
- Screen components now live inside `/app`, aligning with Expo Router best practices.


## ############################
Excelente pregunta. Te explico cómo funciona Expo Router:

## 1. **¿Qué archivo se lanza?**

**`app/index.tsx`** - Este es el archivo principal que se ejecuta cuando arrancas el proyecto.

## 2. **¿Dónde está configurado?**

### **En `App.tsx`** (archivo raíz):
```tsx
export { default } from 'expo-router/entry';
```

### **En `package.json`**:
```json
"main": "expo-router/entry"
```

### **En `app.json`**:
```json
{
  "expo": {
    "scheme": "wodates",
    "web": {
      "bundler": "metro"
    }
  }
}
```

## **Cómo funciona Expo Router:**

1. **`App.tsx`** → redirige a `expo-router/entry`
2. **`expo-router/entry`** → busca el archivo `app/index.tsx`
3. **`app/index.tsx`** → se ejecuta como pantalla principal

## **Estructura de navegación:**

```
app/
├── index.tsx          ← PANTALLA PRINCIPAL (Home)
├── _layout.tsx        ← Layout raíz
├── (auth)/
│   ├── _layout.tsx    ← Layout para auth
│   └── login.tsx      ← Pantalla de login
└── (app)/
    ├── _layout.tsx    ← Layout para app
    ├── feed.tsx       ← Pantalla de feed
    └── matches.tsx    ← Pantalla de matches
```

## **Flujo de navegación:**

1. **Arranca** → `app/index.tsx` (Home)
2. **Si no hay usuario** → `app/(auth)/login.tsx`
3. **Si hay usuario** → `app/(app)/feed.tsx`

## **¿Por qué `app/index.tsx`?**

- **Expo Router** usa **file-based routing**
- **`index.tsx`** = ruta raíz (`/`)
- **`(auth)/login.tsx`** = ruta `/login`
- **`(app)/feed.tsx`** = ruta `/feed`

¿Te queda claro cómo funciona la navegación en Expo Router?