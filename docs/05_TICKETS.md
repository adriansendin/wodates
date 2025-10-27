# 6. Tickets de trabajo

### Ticket 1 — Subida de avatar
**Backend:** endpoint `POST /users/me/avatar`.  
- Guardar imagen en bucket `avatars` (público).  
- Generar `avatar_url` y actualizar en `public.users`.

### Ticket 2 — Feed de usuarios
**Backend:** endpoint `GET /feed`.  
- Filtros: edad, género, looking_for.  
- Excluir usuarios ya “liked” o “passed”.  

### Ticket 3 — Chat y mensajes
**Backend:** endpoints `/chats/{matchId}/messages`.  
- Crear y listar mensajes.  
- Permitir solo a participantes del chat.