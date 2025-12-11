# 3. Modelo de datos

## 3.1 Diagrama ER

```mermaid
erDiagram
  AUTH_USERS ||--|| USERS : "id = id"
  USERS ||--o{ INTERACTIONS : "relaciones usuario-usuario"
  USERS ||--o{ CHATS : "participación en chats"
  CHATS ||--o{ MESSAGES : "mensajes de chat"

  USERS {
    uuid id PK
    text email
    date birthDate
    user_gender gender
    looking_for_preference looking_for
    int min_age
    int max_age
    text bio
    text city
    text region
    text country
    text avatar_url
  }

  CHATS {
    uuid id PK
    timestamptz created_at
  }

  CHAT_PARTICIPANTS {
    uuid chat_id FK
    uuid user_id FK
  }

  MESSAGES {
    uuid id PK
    uuid chat_id FK
    uuid sender_id FK
    text content
    timestamptz created_at
  }

  INTERACTIONS {
    uuid id PK
    uuid from_user FK
    uuid to_user FK
    text type  -- like / pass
    timestamptz created_at
  }

  BLOCKED_USERS {
    uuid blocker_id FK
    uuid blocked_id FK
    timestamptz created_at
  }
```

## 3.2 Descripción
- **auth.users:** gestión de autenticación.  
- **public.users:** datos de perfil y filtros de matching.  
- **public.chats / chat_participants / messages:** comunicación entre usuarios.  
- **public.interactions:** registros de likes/passes que generan matches.  
- **public.blocked_users:** usuarios bloqueados.

