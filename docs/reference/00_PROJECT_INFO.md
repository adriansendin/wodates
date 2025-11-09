# 0. Ficha del proyecto y 1. Descripción general del producto

## 0. Ficha del proyecto
- **Autor:** Adrián Sendín Martín  
- **Nombre del proyecto:** Wodates  
- **Descripción breve:** Aplicación de citas centrada en conexiones reales, con un sistema clásico de matching basado en edad, género y preferencias. Permite registro, edición de perfil, subida de avatar, navegación por un feed de usuarios y chat con matches.  
- **Repositorio:** [https://github.com/adriansendin/wodates](https://github.com/adriansendin/wodates)  
- **Ejecución local:** Frontend y backend se ejecutan en local (Expo + Fastify).  

## 1. Descripción general del producto

### 1.1 Objetivo
Facilitar conexiones significativas entre personas, priorizando compatibilidad por edad, género y preferencias, dentro de una experiencia moderna y sencilla.

### 1.2 Características principales
- Registro y autenticación de usuarios (Supabase Auth).  
- Gestión de perfil (bio, edad, género, preferencias, avatar).  
- Feed de usuarios filtrado por edad/género/preferencia.  
- Sistema de likes/passes y generación de matches.  
- Chat entre usuarios con match confirmado.  
- Subida de avatar a bucket público en Supabase Storage (`avatars`).  
- Desactivación de cuenta y cierre de sesión.  
- Backend Fastify con rutas REST documentadas por Swagger.  
- Tests unitarios, integración y E2E (Cypress).  

### 1.3 Diseño y experiencia
Interfaz mobile-first desarrollada en **React Native (Expo)**. Paleta coral (#F45C5C) sobre fondo claro. Flujo fluido: *Login → Onboarding → Feed → Match → Chat → Perfil*.  

### 1.4 Instalación y ejecución

#### Requisitos
- Node.js 20+  
- NPM o PNPM  
- Supabase project configurado (Auth + DB + Storage)  

#### Backend
```bash
cd backend-api
npm install
npm run dev
# Servidor en http://localhost:3000
```

#### Frontend
```bash
cd mobile-app
npm install
npx expo start -c
# Expo Go o navegador (http://localhost:8081)
```

#### Variables de entorno
`.env` en `mobile-app`:
```
EXPO_PUBLIC_SUPABASE_URL=<tu-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<tu-key>
EXPO_PUBLIC_API_URL=http://localhost:3000
```

### 1.5 Pruebas
Cypress configurado en `mobile-app/cypress/`.  
Ejecutar con:
```bash
cd mobile-app
npx cypress run
```

