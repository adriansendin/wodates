# 7. Pull Requests (ejemplos representativos)

1. **Feature:** Sistema de matching y feed básico  
   - Nuevas tablas: `public.interactions`, `public.matches`.  
   - Endpoint `GET /feed`.  

2. **Feature:** Chat y mensajería  
   - Endpoints `/chats`, `/messages`.  
   - Integración con RLS (solo participantes).  

3. **Feature:** Subida de avatar pública  
   - Endpoint `/users/me/avatar`.  
   - Integración con Supabase Storage bucket `avatars`.