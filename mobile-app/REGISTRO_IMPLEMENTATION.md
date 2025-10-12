# Implementación del Flujo de Registro de 5 Pasos

> **⚠️ DOCUMENTO DESACTUALIZADO**  
> Este documento es histórico. El selector de fecha ha sido reemplazado por `BirthDatePicker`, un componente multiplataforma sin dependencias externas.  
> La dependencia `@react-native-community/datetimepicker` ha sido eliminada.

## 📋 Resumen

Se ha implementado un flujo completo de registro de usuarios en 5 pasos, siguiendo los principios de Clean Architecture y los estándares del proyecto Wodates.

## 🎯 Características Implementadas

### 1. Flujo de Registro Multi-Paso

El flujo de registro consiste en 5 pantallas secuenciales:

#### **Paso 1: Nombre y Email** (`step1.tsx`)
- Campos: nombre, email, contraseña
- Validaciones:
  - Nombre no vacío
  - Email con formato válido (regex)
  - Contraseña mínimo 6 caracteres

#### **Paso 2: Fecha de Nacimiento** (`step2.tsx`)
- Selector de fecha tipo calendario (DateTimePicker)
- Validación: edad mínima de 18 años
- Muestra la edad calculada en tiempo real
- Formato de fecha localizado en español

#### **Paso 3: Ubicación** (`step3.tsx`)
- Campo de texto simple para ciudad
- Campo opcional (puede continuar sin especificar)
- Placeholder sugerente: "Ej: Madrid, España"

#### **Paso 4: Género** (`step4.tsx`)
- Radio buttons con las opciones:
  - Sin especificar (valor vacío)
  - Hombre → "male"
  - Mujer → "female"
  - No binario → "non_binary"
  - Otro → "other"
  - Prefiero no decirlo → "prefer_not_to_say"

#### **Paso 5: A quién busca** (`step5.tsx`)
- Radio buttons con las opciones:
  - Sin preferencia (valor vacío)
  - Hombres → "male"
  - Mujeres → "female"
  - Ambos → "both"

### 2. Pantalla de Confirmación (`complete.tsx`)

- Muestra resumen del perfil creado
- Botón "Aceptar" para confirmar
- Al confirmar:
  1. Crea usuario en Supabase Auth
  2. Inserta registro en tabla `public.users` con todos los campos
  3. Guarda tokens en el authStore
  4. Redirige a `/(app)/profile`

### 3. Componentes y Arquitectura

#### **Store de Registro** (`registrationStore.ts`)
```typescript
interface RegistrationData {
  name: string;
  email: string;
  password: string;
  birthDate: Date | null;
  location: string;
  gender: GenderOption | '';
  lookingFor: LookingForOption | '';
}
```

Funciones:
- `nextStep()`: Avanza al siguiente paso
- `previousStep()`: Retrocede al paso anterior
- `updateData()`: Actualiza datos del formulario
- `resetRegistration()`: Limpia el estado

#### **Componente de Progreso** (`ProgressBar.tsx`)
- Barra de puntos indicadores (5 puntos)
- Actualización dinámica según paso actual
- Estilo minimalista con colores Wodates

#### **Nueva Entidad** (`LookingFor.ts`)
```typescript
export const LOOKING_FOR_OPTIONS = ['male', 'female', 'both'] as const;
export const LookingForSchema = z.enum(LOOKING_FOR_OPTIONS);
export type LookingForOption = (typeof LOOKING_FOR_OPTIONS)[number];
```

## 🎨 Diseño

### Paleta de Colores
- **Principal**: `#F45C5C` (coral pastel)
- **Fondo**: `#FAFAFA` (blanco suave)
- **Texto primario**: `#2C3E50`
- **Texto secundario**: `#7F8C8D`
- **Bordes**: `#E0E0E0`

### Estilo Minimalista
- Botones con bordes redondeados (12px)
- Espaciado consistente (gap de 12-16px)
- Inputs con fondo blanco y bordes suaves
- Radio buttons personalizados con estilo circular
- Feedback visual en selecciones (fondo #FFF5F5)

## 🔧 Actualizaciones del Backend

### Schema de Registro Actualizado
```typescript
export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(100),
  birthDate: z.string().datetime(),
  gender: z.enum(GENDER_VALUES).optional(),
  location: z.string().optional(),
  lookingFor: z.enum(LOOKING_FOR_VALUES).optional(),
});
```

### Servicio de Autenticación
- Actualizado para crear usuario en Auth y en `public.users`
- Maneja campos opcionales correctamente
- Inserta `gender`, `city` (location), y `looking_for` en la tabla de usuarios

## 📦 Dependencias Añadidas

```json
{
  "@react-native-community/datetimepicker": "^latest"
}
```

## 🚀 Uso

### Desde la Pantalla Principal
1. Usuario hace clic en "Crear una cuenta"
2. Navega a `/(auth)/register/step1`
3. Completa los 5 pasos secuenciales
4. Confirma en la pantalla final
5. Se crea la cuenta y redirige a perfil

### Navegación
```
index.tsx → /(auth)/register → step1 → step2 → step3 → step4 → step5 → complete → /(app)/profile
```

## ✅ Validaciones Implementadas

1. **Email**: Formato válido con regex
2. **Contraseña**: Mínimo 6 caracteres
3. **Nombre**: No vacío
4. **Edad**: Mínimo 18 años
5. **Género**: Opcional, valores predefinidos
6. **Looking For**: Opcional, valores predefinidos
7. **Ubicación**: Opcional, texto libre

## 🔐 Seguridad

- Contraseñas manejadas por Supabase Auth
- Tokens JWT almacenados de forma segura
- Validación de datos en frontend y backend
- Campos opcionales manejados correctamente (null en DB)

## 📱 Compatibilidad

- ✅ iOS
- ✅ Android  
- ✅ Web

## 🧪 Testing

Para probar el flujo:

1. Inicia la app: `npm start` en `mobile-app/`
2. Inicia el backend: `npm run dev` en `backend-api/`
3. Haz clic en "Crear una cuenta"
4. Completa los 5 pasos
5. Verifica que se cree el usuario en Supabase

## 📝 Notas Técnicas

- El flujo usa Zustand para gestionar el estado temporal del registro
- Los datos se persisten solo al final (al hacer clic en "Aceptar")
- Se puede retroceder en cualquier paso sin perder datos
- El DateTimePicker se adapta automáticamente a la plataforma (spinner en iOS, calendar en Android)
- Los radio buttons son componentes custom para mejor control visual

## 🐛 Troubleshooting

### El DateTimePicker no aparece
- Verifica que `@react-native-community/datetimepicker` esté instalado
- En iOS, el picker es siempre visible (spinner)
- En Android, aparece como modal al hacer clic

### Error al crear usuario
- Verifica que el backend esté corriendo
- Revisa las variables de entorno de Supabase
- Chequea los logs del backend para errores de validación

### Navegación no funciona
- Asegúrate de que todas las rutas estén bien configuradas en `app/(auth)/register/`
- Verifica que el `_layout.tsx` del registro esté presente

