# WODATES Mobile App

Clean Architecture React Native app for the WODATES dating platform.

## Quick Start

### Prerequisites
- Node.js 20+
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation
```bash
npm install
```

### Development
```bash
# Start the development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web
npm run web
```

### Testing
```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Architecture

```
src/
├── domain/          # Business logic (entities, stores, use-cases)
├── data/           # Data layer (API clients, repositories)
├── app/            # UI layer (screens, navigation, components)
└── tests/          # Test files
```

## Features

- **Authentication**: Login/register with JWT tokens
- **User Profile**: View and edit your profile information
- **Avatar Upload**: Upload profile pictures with automatic compression
  - Take photo with camera or select from gallery
  - Automatic compression for images > 500KB
  - Integrated in registration flow (Step 6)
  - Update anytime from profile screen
- **Feed**: Swipeable user cards with like/pass functionality
- **Matches**: View your matches and start conversations
- **Chat**: Real-time messaging with polling
- **Offline Support**: AsyncStorage for local data persistence

## State Management

The app uses Zustand for state management with the following stores:

- `authStore`: User authentication and tokens
- `feedStore`: Feed users and swiping state
- `matchesStore`: User matches and conversation previews
- `chatStore`: Messages and chat state

## API Integration

The app communicates with the backend API and Supabase through:

- `ApiClient`: Base HTTP client with error handling
- `AuthApi`: Authentication endpoints
- `FeedApi`: Feed and swiping endpoints
- `ChatApi`: Messaging endpoints
- `ProfileApi`: User profile management
- `imageService`: Image upload and compression (Supabase Storage)

## Environment Variables

Copy `env.example` to `.env` and configure:

```bash
cp env.example .env
```

Required variables:
```env
# API Configuration
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1

# Supabase Configuration (for avatar uploads)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Note**: For avatar uploads to work, you need to configure Supabase Storage. See `/docs/AVATAR_UPLOAD_SETUP.md` for detailed instructions.

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

## Building for Production

```bash
# Build for production
npm run build
```

## Testing

The app includes comprehensive tests for:

- Store functionality
- API integration
- Component rendering
- User interactions

Run tests with:
```bash
npm test
```



## ##################################
# 📱 WODATES Mobile App – Guía rápida

## 📆 Día a día (desarrollo normal)
#1. Ir al frontend
cd C:\Projects\wodates\mobile-app

#2. Arrancar en modo desarrollo (CLI de Expo)
npm start

#3. Elegir plataforma en la CLI
- w → web (Chrome)
- a → Android (emulador/dispositivo)
- i → iOS (solo en Mac con simulador)
- QR → escanear con Expo Go en el móvil

---

## 🔄 Cuando se actualizan librerías o package.json
#1. Ir al frontend
cd C:\Projects\wodates\mobile-app

#2. Borrar instalación previa (limpieza total)
rmdir -r -fo node_modules
del package-lock.json   # <-- se borrará para regenerar

#3. Instalar dependencias nuevas
npm install   # (esto regenera también package-lock.json)

#4. Arranque limpio (cache Metro)
npx expo start -c

---

### 📝 Nota
- Usa `npm ci` si quieres instalar **exactamente lo que marca el lockfile** (recomendado en CI/CD).  
- Usa `npm install` cuando has **cambiado `package.json`** o quieres regenerar el lockfile.  
- `npx expo start -c` borra la caché de Metro bundler y evita pantallas en blanco raras tras cambios grandes.
