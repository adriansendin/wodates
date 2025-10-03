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

The app communicates with the backend API through:

- `ApiClient`: Base HTTP client with error handling
- `AuthApi`: Authentication endpoints
- `FeedApi`: Feed and swiping endpoints
- `ChatApi`: Messaging endpoints

## Environment Variables

Copy `env.example` to `.env` and configure:

```bash
cp env.example .env
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
