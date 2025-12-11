# BirthDatePicker - Selector Multiplataforma de Fecha de Nacimiento

## 📋 Resumen

Componente personalizado para seleccionar fecha de nacimiento que funciona de manera consistente en **Web**, **Android** e **iOS** sin dependencias externas.

## 🎯 Características

### Funcionalidades Principales

- ✅ **Multiplataforma**: Funciona idénticamente en Web, Android e iOS
- ✅ **Sin dependencias externas**: No requiere librerías adicionales
- ✅ **Validación automática**: Verifica edad entre 18 y 99 años
- ✅ **Interfaz intuitiva**: Selectores separados para día, mes y año
- ✅ **Experiencia consistente**: Mismo look & feel en todas las plataformas
- ✅ **Manejo de errores**: Mensajes claros y bloqueo de continuación si hay errores
- ✅ **Cálculo automático de edad**: Muestra la edad en tiempo real

### Validaciones Implementadas

1. **Edad mínima**: 18 años
2. **Edad máxima**: 99 años
3. **Fecha futura**: No permite fechas futuras
4. **Días válidos**: Ajusta automáticamente según el mes (ej: 28/29 días en febrero)

## 🏗️ Arquitectura

### Ubicación del Componente

```
mobile-app/src/components/BirthDatePicker.tsx
```

### Props Interface

```typescript
interface BirthDatePickerProps {
  value: Date;                              // Fecha actual seleccionada
  onChange: (date: Date) => void;           // Callback cuando cambia la fecha
  onError?: (error: string | null) => void; // Callback para manejar errores
}
```

### Constantes

```typescript
const MIN_AGE = 18;  // Edad mínima permitida
const MAX_AGE = 99;  // Edad máxima permitida
```

## 💻 Implementación

### Uso Básico

```typescript
import { BirthDatePicker } from '../../../src/components/BirthDatePicker';

function MyComponent() {
  const [date, setDate] = useState<Date>(new Date(2000, 0, 1));
  const [error, setError] = useState<string | null>(null);

  return (
    <BirthDatePicker
      value={date}
      onChange={setDate}
      onError={setError}
    />
  );
}
```

### Integración en el Flujo de Registro

El componente está integrado en `step2.tsx` del flujo de registro:

```typescript
// mobile-app/app/(auth)/register/step2.tsx
export default function Step2Screen() {
  const [date, setDate] = useState<Date>(data.birthDate || new Date(2000, 0, 1));
  const [error, setError] = useState<string | null>(null);

  const handleDateChange = (newDate: Date) => {
    setDate(newDate);
    setError(null);
  };

  const handleError = (errorMessage: string | null) => {
    setError(errorMessage);
  };

  const handleNext = () => {
    const age = calculateAge(date);
    
    if (age < 18 || age > 99) {
      setError(age < 18 
        ? 'Debes tener al menos 18 años para registrarte'
        : 'La edad máxima permitida es 99 años'
      );
      return;
    }

    updateData({ birthDate: date });
    nextStep();
    router.push('/(auth)/register/step3');
  };

  return (
    <BirthDatePicker
      value={date}
      onChange={handleDateChange}
      onError={handleError}
    />
  );
}
```

## 🎨 Diseño

### Estilo Minimalista Wodates

El componente sigue la paleta de colores y el estilo minimalista de Wodates:

- **Color principal**: `#F45C5C` (coral pastel)
- **Fondo**: `#FAFAFA` y `#FFFFFF`
- **Texto primario**: `#2C3E50`
- **Texto secundario**: `#7F8C8D`
- **Bordes**: `#E0E0E0`
- **Error**: `#C62828` con fondo `#FFEBEE`

### Componentes Visuales

1. **Botón de Activación**
   - Muestra la fecha formateada en español
   - Hint: "Toca para cambiar"
   - Borde rojo si hay error de validación

2. **Indicador de Edad**
   - Muestra la edad calculada
   - Color rojo si está fuera del rango válido

3. **Modal de Selección**
   - Tres columnas scrolleables: Día, Mes, Año
   - Items seleccionados con fondo coral
   - Botones "Cancelar" y "Confirmar"
   - Mensaje de error si la fecha no es válida

## 🔄 Flujo de Interacción

1. Usuario toca el botón que muestra la fecha actual
2. Se abre un modal con tres selectores (Día, Mes, Año)
3. Usuario selecciona día, mes y año
4. Al tocar "Confirmar":
   - Se valida la edad
   - Si es válida: actualiza la fecha y cierra el modal
   - Si no es válida: muestra mensaje de error en el modal
5. Si hay error, el botón "Continuar" se deshabilita en la pantalla principal

## 🧩 Funciones Auxiliares

### `calculateAge(birthDate: Date): number`

Calcula la edad en años considerando mes y día actual.

```typescript
const calculateAge = (birthDate: Date): number => {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};
```

### `validateDate(date: Date): string | null`

Valida que la fecha cumpla con los requisitos:
- Edad entre 18 y 99 años
- No fecha futura

Retorna `null` si es válida, o el mensaje de error si no.

### `formatDate(date: Date): string`

Formatea la fecha en español: "01 de enero de 2000"

## ✅ Ventajas sobre DateTimePicker

| Característica | DateTimePicker | BirthDatePicker |
|----------------|----------------|-----------------|
| Dependencias externas | Sí (@react-native-community) | No |
| Consistencia multiplataforma | No (diferente en cada OS) | Sí (idéntico en todos) |
| Conflictos de versión | Sí (requiere Expo 52+) | No |
| Validación integrada | No | Sí (18-99 años) |
| Personalización UI | Limitada | Total |
| Tamaño del bundle | Mayor | Menor |
| Mantenimiento | Dependencia externa | Control total |

## 🐛 Manejo de Errores

### Errores Posibles

1. **Menor de 18 años**: "Debes tener al menos 18 años para registrarte"
2. **Mayor de 99 años**: "La edad máxima permitida es 99 años"
3. **Fecha futura**: "No puedes seleccionar una fecha futura"

### Estados Visuales de Error

- Botón de activación con borde rojo
- Texto de edad en rojo
- Banner de error en el modal
- Botón "Continuar" deshabilitado en la pantalla principal

## 📱 Compatibilidad

- ✅ **Web**: Chrome, Firefox, Safari, Brave, Edge
- ✅ **iOS**: iPhone y iPad (iOS 13+)
- ✅ **Android**: Todos los dispositivos (API 21+)
- ✅ **Expo Go**: Funciona sin build nativo

## 🚀 Testing

### Casos de Prueba

1. **Edad válida (18-99 años)**: Debe permitir continuar
2. **Menor de 18**: Debe mostrar error y bloquear
3. **Mayor de 99**: Debe mostrar error y bloquear
4. **Fecha futura**: Debe mostrar error y bloquear
5. **29 de febrero en año no bisiesto**: Debe ajustar a 28
6. **Cambio de mes con día inválido**: Debe ajustar automáticamente

### Prueba Manual

```bash
# Terminal 1: Backend
cd backend-api
npm run dev

# Terminal 2: Mobile App
cd mobile-app
npm start

# Luego:
# 1. Abrir en navegador (presiona 'w')
# 2. Abrir en Android (presiona 'a')
# 3. Abrir en iOS (presiona 'i')
# 4. Navegar a registro → paso 2
# 5. Probar selector de fecha
```

## 🔐 Seguridad

- No almacena información sensible
- Validación en frontend y backend
- Fecha guardada como ISO string en la base de datos
- Cálculo de edad siempre basado en fecha actual

## 📝 Notas Técnicas

- Usa `ScrollView` para los selectores (mejor UX en móvil que FlatList)
- Ajuste automático de días válidos con `useEffect`
- Modal con overlay semitransparente
- Soporte para accesibilidad (accessibilityLabel y accessibilityHint)
- Sombras condicionales según plataforma (boxShadow en web, elevation en Android)

## 🔄 Migración desde DateTimePicker

### Cambios Realizados

1. **Eliminada dependencia**:
   ```diff
   - "@react-native-community/datetimepicker": "^8.4.5"
   ```

2. **Importación actualizada**:
   ```diff
   - import DateTimePicker from '@react-native-community/datetimepicker';
   - import { WebDatePicker } from '../../../src/components/WebDatePicker';
   + import { BirthDatePicker } from '../../../src/components/BirthDatePicker';
   ```

3. **Uso simplificado**:
   ```diff
   - {Platform.OS === 'web' ? (
   -   <WebDatePicker ... />
   - ) : (
   -   <DateTimePicker ... />
   - )}
   + <BirthDatePicker
   +   value={date}
   +   onChange={handleDateChange}
   +   onError={handleError}
   + />
   ```

### Archivos Eliminados

- `mobile-app/src/components/WebDatePicker.tsx` (reemplazado por BirthDatePicker)

## 🎓 Principios de Diseño Aplicados

- **KISS**: Componente simple sin dependencias innecesarias
- **DRY**: Funciones reutilizables (calculateAge, validateDate, formatDate)
- **Single Responsibility**: El componente solo maneja selección y validación de fecha
- **Separation of Concerns**: Lógica de presentación separada de lógica de negocio
- **Clean Architecture**: Sin dependencias directas a servicios externos

## 📚 Referencias

- [React Native Modal](https://reactnative.dev/docs/modal)
- [React Native ScrollView](https://reactnative.dev/docs/scrollview)
- [JavaScript Date](https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Global_Objects/Date)

