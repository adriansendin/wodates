# 2. Arquitectura del sistema

## 2.1 Diagrama de arquitectura

```mermaid
flowchart LR
  subgraph Frontend [Mobile/Web - React Native + Expo Router]
    UI[UI / Pantallas]
    API[API Client]
  end

  subgraph Backend [Fastify API]
    Routes[Rutas REST]
    Auth[Middleware de autenticación]
    Swagger[Swagger Docs]
    Supa[Supabase SDK]
  end

  subgraph Supabase [Supabase (Auth + DB + Storage)]
    AuthDB[auth.users]
    PubUsers[public.users]
    Chats[public.chats]
    Interactions[public.interactions]
    Avatars[(Bucket avatars)]
  end

  UI --> API
  API --> Backend
  Backend --> Supabase
  Supabase --> Storage
```

## 2.2 Componentes principales
- **Frontend (Expo):** Registro, perfil, feed, likes, chat. Llama a backend API y usa Supabase solo para cerrar sesión.  
- **Backend (Fastify):** Rutas `/auth`, `/users`, `/feed`, `/likes`, `/passes`, `/matches`, `/chats`.  
- **Supabase:** Maneja autenticación, base de datos y almacenamiento.  

## 2.3 Infraestructura y despliegue
- **Local:** Backend en `http://localhost:3000`, frontend en `http://localhost:8081`.  
- **Prod:** No desplegado aún (ejecución local).  

## 2.4 Seguridad (RLS)
- **public.users:** SELECT libre; UPDATE/INSERT restringido a `auth.uid() = id`.  
- **public.chats:** Solo visibles por usuarios participantes (`chat_participants`).  
- **public.interactions:** Solo `from_user` o `to_user` pueden leer/modificar.  

## 2.5 Tests
- **Unitarios e integración:** Jest/TSX en backend.  
- **E2E:** Cypress (auth, registro, chat, feed).

