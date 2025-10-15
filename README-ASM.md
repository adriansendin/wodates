# README — Wodates (formato oficial)

## Índice
0. Ficha del proyecto  
1. Descripción general del producto  
2. Arquitectura del sistema  
3. Modelo de datos  
4. Especificación de la API  
5. Historias de usuario  
6. Tickets de trabajo  
7. Pull requests

---

## 0. Ficha del proyecto
**0.1. Tu nombre completo:** _Adrián Sendín (ASM)_  
**0.2. Nombre del proyecto:** _Wodates_  
**0.3. Descripción breve del proyecto:** App de citas enfocada en deportistas. Registro por pasos, feed tipo swipe (like/pass), match, y chat entre matches. Backend en Fastify/Node, frontend con Expo React Native y Supabase para Auth/DB/Storage.  
**0.4. URL del proyecto:** _[pendiente / privado]_  
**0.5. URL o archivo comprimido del repositorio:** _[pendiente / privado]_  
> Si es privado, comparte acceso de forma segura (p. ej. onetimesecret) a alvaro@lidr.co.

---

## 1. Descripción general del producto
**1.1. Objetivo**  
Wodates ayuda a deportistas a encontrar compañero/a de entrenamiento compatible (disciplina/nivel/edad/ciudad), reduciendo fricción para iniciar actividad conjunta.

**1.2. Características y funcionalidades principales**
- Registro y login (Supabase Auth) con **onboarding por pasos** (nombre/email → fecha de nacimiento → ubicación → género → avatar → resumen). Validación de edad **18–99**.
- **Perfil** (bio, ciudad, preferencias de búsqueda, avatar).
- **Feed** tipo swipe (like / pass) excluyendo perfiles ya evaluados.
- **Match** cuando hay like mutuo.
- **Chat 1:1** entre matches (polling periódico desde el cliente).
- **Subida de avatar** a Supabase Storage (bucket `avatars`).

**1.3. Diseño y experiencia de usuario**  
UI limpia y minimalista. Paleta neutra + acento coral `#F45C5C`. Propuesta de icono: “W” formada por dos corazones.  
*Evidencias (añadir rutas o enlaces):*
- `/docs/screenshots/login.png`
- `/docs/screenshots/stepper.png`
- `/docs/screenshots/feed.png`
- `/docs/screenshots/match.png`
- `/docs/screenshots/chat.png`
- `/docs/screenshots/supabase-rls.png`
- `/docs/screenshots/bucket-avatars.png`

**1.4. Instrucciones de instalación**
**Prerequisitos**: Node.js 20, npm 10, Expo CLI (`npm i -g expo`), cuenta Supabase.

**Variables de entorno mínimas**
- `backend-api/.env`
```env
PORT=3000
NODE_ENV=development
# JWT (si aplica)
JWT_SECRET=change-me
JWT_EXPIRES_IN=7d
# CORS (dev)
CORS_ORIGIN=*
# Rate limit (dev)
RATE_LIMIT_MAX=100
RATE_LIMIT_TIME_WINDOW=60000
LOG_LEVEL=info
# Supabase (server-only)
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DB_URL=postgresql://postgres:YOUR-PASSWORD@db.YOUR-PROJECT.supabase.co:5432/postgres
```
- `mobile-app/.env`
```env
# API base (usa tu IP local en dispositivo físico)
EXPO_PUBLIC_API_URL=http://192.168.1.11:3000/api/v1
# Supabase (cliente)
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
APP_NAME=WODATES
APP_VERSION=0.1.0
```
> **Notas**:
> - La **Service Role Key** va **solo en backend**.
> - No comitees `.env` reales. Usa `.env.example`.

**Setup Backend**
```bash
cd backend-api
npm ci
npm run dev   # http://localhost:3000   (health: /api/v1/health)
```

**Setup Mobile (Expo)**
```bash
cd mobile-app
npm ci
npm start     # abre Metro/QR; usa A (Android), I (iOS) o W (web)
```
Asegura que `EXPO_PUBLIC_API_URL` es alcanzable desde el emulador/dispositivo.

---

## 2. Arquitectura del sistema
**2.1. Diagrama de arquitectura**
Justificación: **Clean Architecture** por mantenibilidad/testabilidad. Mobile y Backend comparten patrón por capas (app/data/domain). Supabase provee Auth, DB y Storage.

```mermaid
flowchart LR
  subgraph Mobile (Expo)
    direction TB
    MApp[UI & Navegación]
    MData[Servicios API / Storage]
    MDom[Entidades & Casos de uso]
  end
  subgraph Backend (Fastify)
    direction TB
    BApp[Rutas HTTP & Controllers]
    BData[Repos / Integraciones Supabase]
    BDom[Entidades & Casos de uso]
  end
  MApp --> MData --> MDom
  BApp --> BData --> BDom
  MData -. HTTPS .-> BApp
  BData -. supabase-js .-> Supabase[(Auth / DB / Storage)]
```

**2.2. Componentes principales**
- **Backend**: Fastify + TypeScript + Zod; CORS; rate-limit; Swagger; repos Supabase vía `@supabase/supabase-js` (service role). Rutas: `/health`, `/feed`, `/profile`, `/chats/:id/messages`, auth.
- **Mobile**: Expo + TS + Expo Router; estado global con **Zustand**; servicios API; subida de avatar (ImagePicker + Manipulator); AsyncStorage para token.
- **Supabase**: Auth (email/pass), Postgres (tablas `users`, `interactions`, `chats`, `chat_participants`, `messages`), Storage (bucket `avatars`).

**2.3. Estructura de ficheros (alto nivel)**
```
wodates/
├─ backend-api/
│  ├─ src/
│  │  ├─ app/     # rutas, controladores, middlewares
│  │  ├─ data/    # repositorios Supabase, mappers
│  │  └─ domain/  # entidades, casos de uso, contratos
│  ├─ tests/
│  └─ env.example
└─ mobile-app/
   ├─ app/        # Expo Router (auth/, app/)
   ├─ src/
   │  ├─ data/    # api clients, image service
   │  ├─ domain/  # stores Zustand, validaciones
   │  └─ components/
   └─ env.example
```

**2.4. Infraestructura y despliegue**
- Backend: servicio Node (Railway/Vercel/Render/EC2). HTTPS, variables de entorno, build `npm run build`.
- Mobile: build con **EAS** (APK/IPA), `EXPO_PUBLIC_API_URL` apuntando al dominio productivo.
- Supabase: proyecto gestionado; bucket público `avatars` con RLS para escritura por usuario.

**2.5. Seguridad**
- Auth con JWT en backend; verificación `Authorization: Bearer <token>`.
- **RLS** en `public.users` (select all; update/insert own) y en **Storage** (`avatars/uid/...`).
- Validación Zod, CORS controlado, rate-limit, logs con Pino.

**2.6. Tests**
- Unit tests (Vitest) para casos de uso: `LikeUser`, `SendMessage` con repos fakes.
- Pruebas manuales de integración: registro → like → match → chat.

---

## 3. Modelo de datos
**3.1. Diagrama (mermaid)**
```mermaid
erDiagram
  users ||--o{ interactions : "origina"
  users ||--o{ interactions : "recibe"
  users ||--o{ chat_participants : "participa"
  chats ||--o{ chat_participants : "tiene"
  chats ||--o{ messages : "contiene"
  users ||--o{ messages : "envía"

  users {
    uuid id PK
    date birth_date
    text location
    text gender
    text avatar_url
    timestamptz created_at
  }
  interactions {
    uuid id PK
    uuid from_user FK
    uuid to_user   FK
    varchar action
    timestamptz created_at
  }
  chats {
    uuid id PK
    timestamptz created_at
  }
  chat_participants {
    uuid chat_id FK
    uuid user_id FK
  }
  messages {
    uuid id PK
    uuid chat_id  FK
    uuid sender_id FK
    text content
    timestamptz created_at
  }
```

**3.2. Descripción de entidades principales**
- **users**: perfil extendido enlazado a `auth.users` (mismo `id`). Campos: `birth_date` (edad 18–99), `location`, `gender`, `avatar_url`, `created_at`.
- **interactions**: registro de `like` / `pass` entre usuarios (`from_user` → `to_user`). Único compuesto recomendado `(from_user, to_user, action)`.
- **chats** / **chat_participants**: materializan el match (2 participantes por chat).
- **messages**: mensajes de texto por chat (`content`, `created_at`). Índice sugerido `(chat_id, created_at)`.

---

## 4. Especificación de la API (3 endpoints)
**POST /api/v1/auth/register**  
Crea usuario (Supabase Auth) y perfil, retorna token JWT.
```json
{
  "email":"user@example.com",
  "password":"StrongPass123",
  "name":"Nombre",
  "birthDate":"1990-05-15"
}
```
**201**
```json
{
  "user": {"id":"<uuid>", "email":"user@example.com", "name":"Nombre"},
  "token":"<jwt>"
}
```

**GET /api/v1/feed?limit=10&offset=0**  
Lista perfiles sugeridos (excluye evaluados), con edad y avatar.
**200**
```json
{
  "users":[{"id":"<uuid>","name":"Ana","age":29,"bio":"Runner","photoUrl":"https://..."}],
  "pagination":{"limit":10,"offset":0,"hasMore":true}
}
```

**POST /api/v1/chats/{matchId}/messages**  
Envia mensaje en chat (requiere JWT; autoriza participación en chat).
```json
{"content":"¡Hola!"}
```
**200**
```json
{"message":{"id":"<uuid>","matchId":"<uuid>","senderId":"<uuid>","content":"¡Hola!","createdAt":"2025-10-15T10:22:34Z"}}
```

---

## 5. Historias de usuario
1) *Como* nuevo usuario, *quiero* registrarme con perfil y foto, *para* empezar a buscar compañeros.  
2) *Como* usuario, *quiero* evaluar perfiles con like/pass, *para* encontrar matches afines.  
3) *Como* usuario con match, *quiero* chatear dentro de la app, *para* coordinar entrenamientos.

---

## 6. Tickets de trabajo
- **Backend**: Mensajería 1:1 (modelo, casos de uso, endpoints, paginación, autorización por pertenencia al chat).
- **Frontend**: Subida de avatar en Expo (picker/cámara, compresión <500KB, subida a Supabase, actualización de perfil y UI).
- **DB**: Migrar `name/email` a `auth.users` y exponer perfil combinando datos (evitar duplicación).

---

## 7. Pull requests
1) **Initial MVP**: monorepo (backend-api, mobile-app), auth básica, feed, likes, chats stub, docs iniciales.  
2) **Avatar Upload**: integración `expo-image-picker` + `supabase-js`, bucket `avatars`, UI de registro/perfil, políticas RLS.  
3) **Refactor Modelo**: mover `name/email` a `auth.users` (metadata), servicios combinados, migraciones y actualización de endpoints.

---

> **Evidencia de despliegue**: añade capturas/links reales en `/docs/screenshots` y, si aplica, URL de preview (Expo/QR) y/o dominio del backend.

