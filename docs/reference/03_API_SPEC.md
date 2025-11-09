# 4. Especificación de la API (Fastify)

```yaml
openapi: 3.0.3
info:
  title: Wodates API
  version: 1.0.0
servers:
  - url: http://localhost:3000
paths:
  /auth/login:
    post:
      summary: Iniciar sesión de usuario
  /auth/register:
    post:
      summary: Registrar nuevo usuario
  /users/me:
    get:
      summary: Obtener perfil del usuario autenticado
    patch:
      summary: Actualizar perfil (bio, preferencias, etc.)
  /users/me/avatar:
    post:
      summary: Subir avatar al bucket público
  /feed:
    get:
      summary: Obtener lista de usuarios según filtros de edad/género/preferencia
  /likes:
    post:
      summary: Dar "like" a otro usuario
  /passes:
    post:
      summary: Pasar usuario
  /matches:
    get:
      summary: Listar matches confirmados
  /chats/{matchId}/messages:
    get:
      summary: Obtener mensajes del chat
    post:
      summary: Enviar nuevo mensaje
```

**Base URL:** `http://localhost:3000`  
Documentación Swagger disponible en `/documentation`.

