import { Redirect } from 'expo-router';

export default function RegisterIndex() {
  // Redirigir automáticamente al primer paso (selección de ciudad)
  return <Redirect href="/(auth)/register/step3" />;
}

