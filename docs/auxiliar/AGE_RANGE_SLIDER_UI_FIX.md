# Fix: Slider "Salta" de Vuelta a la Posición Original

## Problema

Al arrastrar las bolitas del range slider, estas volvían a su posición original después de un segundo, haciendo imposible cambiar el rango de edad.

## Causa Raíz

El componente `MultiSlider` estaba usando directamente las props `minAge` y `maxAge` que venían del estado del padre (`profile.tsx`). 

**Flujo problemático:**
1. Usuario arrastra el slider → `onValuesChangeFinish` se ejecuta
2. Se llama a `handleMinAgeChange` y `handleMaxAgeChange`
3. Estos actualizan el estado del formulario
4. Se dispara `autoSaveAgeRange` con **debouncing de 800ms**
5. Durante esos 800ms, el componente se re-renderiza con los valores antiguos
6. El slider "salta" de vuelta porque recibe las props antiguas

**Diagrama del problema:**
```
Usuario arrastra slider (25-35)
    ↓
onValuesChangeFinish ejecuta
    ↓
Estado padre actualiza (25-35)
    ↓
autoSaveAgeRange espera 800ms (debouncing)
    ↓
Componente re-renderiza con props (18-99) ← PROPS ANTIGUAS
    ↓
Slider salta de vuelta a (18-99) ❌
    ↓
Después de 800ms guarda en BD
    ↓
Props actualizan a (25-35)
    ↓
Slider vuelve a (25-35)
```

## Solución: Estado Local + Sincronización

### Implementación

```typescript
// Estado local para interacción inmediata
const [localMinAge, setLocalMinAge] = useState(minAge);
const [localMaxAge, setLocalMaxAge] = useState(maxAge);

// Sincronizar con props cuando la BD confirma
useEffect(() => {
  setLocalMinAge(minAge);
  setLocalMaxAge(maxAge);
}, [minAge, maxAge]);

// MultiSlider usa estado local
<MultiSlider
  values={[localMinAge, localMaxAge]}  // ✅ Estado local
  onValuesChange={(values) => {
    // Actualizar estado local inmediatamente
    setLocalMinAge(min);
    setLocalMaxAge(max);
  }}
  onValuesChangeFinish={(values) => {
    // Notificar al padre solo al terminar
    onMinAgeChange(min);
    onMaxAgeChange(max);
  }}
/>
```

### Flujo Correcto

```
Usuario arrastra slider (25-35)
    ↓
onValuesChange ejecuta continuamente
    ↓
Estado LOCAL actualiza inmediatamente (25-35) ✅
    ↓
Slider muestra (25-35) - UI FLUIDA ✅
    ↓
Usuario suelta el slider
    ↓
onValuesChangeFinish ejecuta
    ↓
Notifica al padre (25-35)
    ↓
autoSaveAgeRange espera 800ms
    ↓
Componente re-renderiza pero usa estado LOCAL (25-35) ✅
    ↓
Slider sigue mostrando (25-35) ✅
    ↓
Después de 800ms guarda en BD
    ↓
Props actualizan a (25-35)
    ↓
useEffect sincroniza estado local (25-35)
    ↓
TODO SINCRONIZADO ✅
```

## Patrón: Controlled Component con Estado Local

Este es un patrón común en React para componentes que necesitan:
1. **Interacción inmediata** (estado local)
2. **Sincronización con fuente de verdad** (props/BD)

### Ventajas

✅ **UI Responsiva**: El slider responde inmediatamente al arrastre
✅ **Sin saltos**: El estado local mantiene la posición durante el debouncing
✅ **Sincronización**: El `useEffect` actualiza cuando la BD confirma
✅ **Optimistic UI**: El usuario ve el cambio antes de que se guarde

### Cuándo usar este patrón

- Inputs con debouncing
- Sliders con auto-save
- Componentes con validación asíncrona
- Cualquier UI que necesite respuesta inmediata pero guardado diferido

## Código Completo

```typescript:mobile-app/src/components/AgeRangePicker.tsx
export const AgeRangePicker: React.FC<AgeRangePickerProps> = ({
  minAge,
  maxAge,
  onMinAgeChange,
  onMaxAgeChange,
  disabled = false,
  style,
}) => {
  // 1. Estado local para interacción fluida
  const [localMinAge, setLocalMinAge] = useState(minAge);
  const [localMaxAge, setLocalMaxAge] = useState(maxAge);

  // 2. Sincronizar cuando las props cambian (desde BD)
  useEffect(() => {
    setLocalMinAge(minAge);
    setLocalMaxAge(maxAge);
  }, [minAge, maxAge]);

  if (Platform.OS !== 'web') {
    return (
      <MultiSlider
        values={[localMinAge, localMaxAge]}  // 3. Usar estado local
        onValuesChange={(values) => {
          const [min, max] = values;
          // 4. Actualizar estado local inmediatamente
          setLocalMinAge(min);
          setLocalMaxAge(max);
        }}
        onValuesChangeFinish={(values) => {
          const [min, max] = values;
          // 5. Notificar al padre solo al terminar
          onMinAgeChange(min);
          onMaxAgeChange(max);
        }}
      />
    );
  }
  // ... resto del código
};
```

## Testing

Para verificar que funciona:

1. **Arrastrar el slider rápidamente**
   - ✅ Debe moverse suavemente sin saltos
   - ✅ Debe mantener la posición mientras arrastras

2. **Soltar el slider**
   - ✅ Debe mantener la posición (no volver atrás)
   - ✅ Después de 800ms debe guardar en BD

3. **Verificar en consola**
   ```
   [Profile] Auto-saving age range: {min_age: 25, max_age: 35}
   [Profile] Age range saved successfully: {min_age: 25, max_age: 35}
   ```

4. **Verificar en Supabase**
   - ✅ Los valores deben coincidir con lo que muestra el slider

## Lecciones Aprendidas

1. **Controlled components con async updates necesitan estado local**
2. **Debouncing + controlled components = UI que salta**
3. **Solución: Estado local + sincronización con useEffect**
4. **Optimistic UI mejora la experiencia del usuario**

## Fecha de Fix

22 de octubre de 2025 - Fix adicional para UI fluida

