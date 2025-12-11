# WODATES Backend API

Clean Architecture Fastify server for the WODATES dating app.

## Quick Start

### Prerequisites
- Node.js 20+
- npm or yarn

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## API Documentation

Once the server is running, visit:
- **API Documentation**: http://localhost:3000/documentation
- **Health Check**: http://localhost:3000/health

## Environment Variables

Copy `env.example` to `.env` and configure:

```bash
cp env.example .env
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/logout` - Logout user

### Feed
- `GET /api/v1/feed` - Get feed users
- `POST /api/v1/likes` - Like a user
- `POST /api/v1/passes` - Pass on a user

### Chat
- `GET /api/v1/chats/:matchId/messages` - Get messages
- `POST /api/v1/chats/:matchId/messages` - Send message

### Admin (verificación manual)
- `GET /admin/verification` - Panel web protegido (Basic Auth o header `x-admin-secret`)
- `GET /admin/verification/next` - Obtiene la siguiente selfie pendiente
- `POST /admin/verification/:id/approve` - Aprueba y marca al usuario como `verified`
- `POST /admin/verification/:id/reject` - Rechaza y marca al usuario como `rejected`

#### Configuración de acceso
- Define `ADMIN_VERIFICATION_SECRET` **o** pareja `ADMIN_BASIC_USER` + `ADMIN_BASIC_PASSWORD`.
- Accede al panel en `http://localhost:3000/admin/verification`. El navegador usará Basic Auth; para scripts puedes enviar `x-admin-secret`.

## Architecture

```
src/
├── domain/          # Business logic (entities, use-cases, repositories)
├── data/           # Data layer (repositories, external integrations)
├── app/            # Application layer (routes, controllers, middleware)
└── tests/          # Test files
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Development

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run type-check
```

## #################################
# 💻 WODATES Backend – Guía rápida

## 📆 Día a día (desarrollo normal)
#1. Ir al backend (abrir carpeta)
cd C:\Projects\wodates\backend-api

#2. Arrancar en modo desarrollo (hot reload)
npm run dev

#3. Probar que está vivo
http://localhost:3000/health


## 🔄 Cuando se actualizan librerías o dependencias
#1. Ir al backend
cd C:\Projects\wodates\backend-api

#2. Borrar instalación previa (limpieza total)
rmdir -r -fo node_modules
del package-lock.json   # <-- borro lockfile para regenerar

#3. Instalar dependencias nuevas
npm install

#4. Copiar/actualizar variables de entorno
Copy-Item .\env.example .\.env

#5. Arrancar de nuevo
npm run dev

### 📝 Nota
- Usar `npm ci` cuando **quieres instalar exactamente lo que está en package-lock.json**  
  (ideal en CI/CD o si no has tocado versiones).  
- Usar `npm install` cuando **actualizas `package.json` o necesitas un nuevo lockfile**.  
  (es más largo porque resuelve todo el árbol de dependencias de cero).
